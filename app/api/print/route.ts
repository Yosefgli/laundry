import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require("bwip-js") as { toBuffer: (opts: Record<string, unknown>) => Promise<Buffer> };
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { formatCurrency, formatWeight, localeToIntl } from "@/lib/i18n";

const EPOS_WIDTH = 42; // characters at default font on 80mm paper

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee();

    const { orderId, type = "combined" } = (await request.json()) as {
      orderId: string;
      type?: "receipt" | "label" | "combined";
    };

    const supabase = createServiceClient();

    const [orderResult, printerResult] = await Promise.all([
      supabase
        .from("orders")
        .select(
          `*, workstation:workstations(printer_http_url), order_items(*, order_item_services(*, service_type:service_types(id, code)))`
        )
        .eq("id", orderId)
        .single(),
      supabase
        .from("printer_employees")
        .select("printers(ip_address)")
        .eq("employee_id", employee.id)
        .limit(1)
        .maybeSingle(),
    ]);

    if (orderResult.error || !orderResult.data) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderResult.data;
    const workstation = order.workstation as { printer_http_url: string | null } | null;

    // Resolve printer: employee-assigned printer (ePOS) → workstation URL (legacy HTML) → env fallback
    const printerIp = (printerResult.data?.printers as { ip_address: string } | null)?.ip_address ?? null;
    const legacyPrintUrl = workstation?.printer_http_url ?? process.env.PRINT_SERVER_URL ?? null;

    if (!printerIp && !legacyPrintUrl) {
      return NextResponse.json(
        { error: "No printer configured. Assign a printer to this employee in Admin → Printers." },
        { status: 422 }
      );
    }

    const { locale, translations: t } = await getI18n();
    const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "";
    const shopAddress = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? "";
    const taxId = process.env.NEXT_PUBLIC_TAX_ID ?? "";

    if (printerIp) {
      // ─── ePOS-Print path (EPSON network printers) ────────────────────────
      const eposUrl = `http://${printerIp}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
      const xml = buildEposXml({ type, order, t, locale, shopName, shopAddress, taxId });

      const printRes = await fetch(eposUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/xml; charset=utf-8",
          SOAPAction: '""',
        },
        body: xml,
      });

      if (!printRes.ok) {
        return NextResponse.json(
          { error: `Printer responded ${printRes.status}. Check IP address and that ePOS-Print is enabled on the printer.` },
          { status: 502 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // ─── Legacy HTML POST path (print server) ────────────────────────────────
    const qrPng = await bwipjs.toBuffer({
      bcid: "qrcode",
      text: order.id,
      scale: 4,
      backgroundcolor: "ffffff",
    });
    const qrDataUrl = `data:image/png;base64,${qrPng.toString("base64")}`;

    const receiptHtml =
      type === "receipt" || type === "combined"
        ? buildReceiptHtml({ order, t, locale, shopName, shopAddress, taxId, qrDataUrl })
        : "";

    const labelHtml =
      type === "label" || type === "combined"
        ? buildLabelHtml({ order, t, locale, qrDataUrl })
        : "";

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { margin: 0; font-family: monospace; }
  .page { width: 80mm; page-break-after: always; padding: 4mm; box-sizing: border-box; }
  .page:last-child { page-break-after: auto; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .row { display: flex; justify-content: space-between; }
  .xs { font-size: 8pt; }
  hr { border: none; border-top: 1px dashed #000; margin: 3px 0; }
  img.qr { width: 120px; height: 120px; display: block; margin: 4px auto; }
</style></head>
<body>${receiptHtml}${labelHtml}</body>
</html>`;

    const printRes = await fetch(legacyPrintUrl!, {
      method: "POST",
      headers: { "Content-Type": "text/html; charset=utf-8" },
      body: html,
    });

    if (!printRes.ok) {
      return NextResponse.json(
        { error: `Print server responded ${printRes.status}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const isAuth = err instanceof Error && err.message === "Unauthorized";
    return NextResponse.json(
      { error: isAuth ? "Unauthorized" : "Internal error" },
      { status: isAuth ? 401 : 500 }
    );
  }
}

// ─── ePOS-Print XML builder ───────────────────────────────────────────────────

function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function padRow(left: string, right: string, width = EPOS_WIDTH): string {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + " ".repeat(spaces) + right;
}

function buildEposXml({
  type,
  order,
  t,
  locale,
  shopName,
  shopAddress,
  taxId,
}: {
  type: "receipt" | "label" | "combined";
  order: Record<string, unknown>;
  t: Record<string, string>;
  locale: string;
  shopName: string;
  shopAddress: string;
  taxId: string;
}): string {
  const parts: string[] = [];

  if (type === "receipt" || type === "combined") {
    parts.push(buildEposReceipt({ order, t, locale, shopName, shopAddress, taxId }));
  }
  if (type === "label" || type === "combined") {
    parts.push(buildEposLabel({ order, t, locale }));
  }

  return `<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">${parts.join("")}</epos-print></s:Body></s:Envelope>`;
}

function buildEposReceipt({
  order,
  t,
  locale,
  shopName,
  shopAddress,
  taxId,
}: {
  order: Record<string, unknown>;
  t: Record<string, string>;
  locale: string;
  shopName: string;
  shopAddress: string;
  taxId: string;
}): string {
  const loc = locale as "en" | "he" | "my";
  const SEP = "-".repeat(EPOS_WIDTH) + "\n";
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];

  const itemLines = items
    .map((item, idx) => {
      const services = (item.order_item_services as Array<Record<string, unknown>>) ?? [];
      const serviceLines = services
        .map((s) => {
          const code = (s.service_type as Record<string, string> | null)?.code ?? "";
          return padRow(`  ${esc(t[`service.${code}`] ?? code)}`, esc(formatCurrency(Number(s.line_total), loc))) + "\n";
        })
        .join("");
      return (
        `${esc(t["customer.bag"])} ${idx + 1} — ${esc(formatWeight(Number(item.weight_kg), loc, t["unit.kg"]))}\n` +
        serviceLines
      );
    })
    .join("");

  return [
    `<text align="center" bold="true" dw="true" dh="true">${esc(shopName)}\n</text>`,
    shopAddress ? `<text align="center" bold="false" dw="false" dh="false">${esc(shopAddress)}\n</text>` : "",
    taxId ? `<text align="center">${esc(t["print.receipt_title"])} | ${esc(taxId)}\n</text>` : "",
    `<text align="left" bold="false">${SEP}</text>`,
    `<text>${esc(padRow(t["print.order_number"] ?? "Order", String(order.order_number ?? "")))}\n</text>`,
    `<text>${esc(padRow(t["print.weight"] ?? "Weight", formatWeight(Number(order.total_weight_kg), loc, t["unit.kg"])))}\n</text>`,
    `<text>${SEP}</text>`,
    `<text>${esc(itemLines)}</text>`,
    `<text>${SEP}</text>`,
    `<text>${esc(padRow(t["print.subtotal"] ?? "Subtotal", formatCurrency(Number(order.subtotal), loc)))}\n</text>`,
    `<text>${esc(padRow(t["print.tax"] ?? "Tax", formatCurrency(Number(order.tax_amount), loc)))}\n</text>`,
    `<text bold="true">${esc(padRow(t["print.total"] ?? "Total", formatCurrency(Number(order.total_amount), loc)))}\n</text>`,
    `<text bold="false">${esc(padRow(t["print.payment_status"] ?? "Payment", t[`payment.${order.payment_status}`] ?? String(order.payment_status)))}\n</text>`,
    `<text>${SEP}</text>`,
    `<symbol type="qrcode" level="0" width="5" height="0">${esc(String(order.id))}</symbol>`,
    `<text align="center">${esc((String(order.id)).slice(0, 8).toUpperCase())}\n</text>`,
    `<feed line="3"/>`,
    `<cut type="feed"/>`,
  ].join("");
}

function buildEposLabel({
  order,
  t,
  locale,
}: {
  order: Record<string, unknown>;
  t: Record<string, string>;
  locale: string;
}): string {
  const loc = locale as "en" | "he" | "my";
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];
  const serviceCodes = items
    .flatMap((i) =>
      ((i.order_item_services as Array<Record<string, unknown>>) ?? []).map(
        (s) => (s.service_type as Record<string, string> | null)?.code
      )
    )
    .filter(Boolean) as string[];
  const uniqueServices = [...new Set(serviceCodes)];
  const servicesLabel = uniqueServices.map((s) => t[`service.${s}`] ?? s).join(" · ");
  const date = new Date(order.created_at as string).toLocaleDateString(localeToIntl(loc));

  return [
    `<text align="center" bold="true" dw="true" dh="true">${esc(String(order.order_number ?? ""))}\n</text>`,
    `<symbol type="qrcode" level="0" width="6" height="0">${esc(String(order.id))}</symbol>`,
    order.customer_name ? `<text align="center" bold="false" dw="false" dh="false">${esc(String(order.customer_name))}\n</text>` : "",
    servicesLabel ? `<text align="center">${esc(servicesLabel)}\n</text>` : "",
    order.customer_notes ? `<text align="center">${esc(String(order.customer_notes))}\n</text>` : "",
    `<text align="center">${esc(date)}\n</text>`,
    `<feed line="3"/>`,
    `<cut type="feed"/>`,
  ].join("");
}

// ─── Legacy HTML builders (for non-ePOS print servers) ───────────────────────

function buildReceiptHtml({
  order,
  t,
  locale,
  shopName,
  shopAddress,
  taxId,
  qrDataUrl,
}: {
  order: Record<string, unknown>;
  t: Record<string, string>;
  locale: string;
  shopName: string;
  shopAddress: string;
  taxId: string;
  qrDataUrl: string;
}): string {
  const loc = locale as "en" | "he" | "my";
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];
  const itemsHtml = items
    .map((item, idx) => {
      const services = (item.order_item_services as Array<Record<string, unknown>>) ?? [];
      const servicesHtml = services
        .map((s) => {
          const code = (s.service_type as Record<string, string> | null)?.code ?? "";
          return `<div class="row xs"><span>${t[`service.${code}`] ?? code}</span><span>${formatCurrency(Number(s.line_total), loc)}</span></div>`;
        })
        .join("");
      return `<div style="margin-bottom:3px"><div class="bold">${t["customer.bag"]} ${idx + 1} — ${formatWeight(Number(item.weight_kg), loc, t["unit.kg"])}</div>${servicesHtml}</div>`;
    })
    .join("");

  return `<div class="page">
  <div class="center bold" style="font-size:12pt">${shopName}</div>
  ${shopAddress ? `<div class="center xs">${shopAddress}</div>` : ""}
  ${taxId ? `<div class="center xs">${t["print.receipt_title"]} | ${taxId}</div>` : ""}
  <hr/>
  <div class="row"><span>${t["print.order_number"]}</span><span class="bold">${order.order_number}</span></div>
  <div class="row"><span>${t["print.weight"]}</span><span>${formatWeight(Number(order.total_weight_kg), loc, t["unit.kg"])}</span></div>
  <hr/>
  ${itemsHtml}
  <hr/>
  <div class="row"><span>${t["print.subtotal"]}</span><span>${formatCurrency(Number(order.subtotal), loc)}</span></div>
  <div class="row"><span>${t["print.tax"]}</span><span>${formatCurrency(Number(order.tax_amount), loc)}</span></div>
  <div class="row bold"><span>${t["print.total"]}</span><span>${formatCurrency(Number(order.total_amount), loc)}</span></div>
  <div class="row"><span>${t["print.payment_status"]}</span><span>${t[`payment.${order.payment_status}`] ?? order.payment_status}</span></div>
  <hr/>
  <div class="center"><img class="qr" src="${qrDataUrl}" alt="QR"/></div>
  <div class="center xs">${(order.id as string).slice(0, 8).toUpperCase()}</div>
</div>`;
}

function buildLabelHtml({
  order,
  t,
  locale,
  qrDataUrl,
}: {
  order: Record<string, unknown>;
  t: Record<string, string>;
  locale: string;
  qrDataUrl: string;
}): string {
  const loc = locale as "en" | "he" | "my";
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];
  const serviceCodes = items
    .flatMap((i) =>
      ((i.order_item_services as Array<Record<string, unknown>>) ?? []).map(
        (s) => (s.service_type as Record<string, string> | null)?.code
      )
    )
    .filter(Boolean) as string[];
  const uniqueServices = [...new Set(serviceCodes)];
  const servicesLabel = uniqueServices.map((s) => t[`service.${s}`] ?? s).join(" · ");
  const date = new Date(order.created_at as string).toLocaleDateString(localeToIntl(loc));

  return `<div class="page center" style="font-size:12pt;font-weight:bold">
  <div style="font-size:20pt;font-weight:900;margin-bottom:6px">${order.order_number}</div>
  <div><img class="qr" style="width:140px;height:140px" src="${qrDataUrl}" alt="QR"/></div>
  <div style="font-size:10pt;font-weight:bold;margin-top:4px">${order.customer_name ?? "—"}</div>
  <div class="xs" style="margin-top:2px">${servicesLabel}</div>
  ${order.customer_notes ? `<div class="xs" style="border-top:1px solid #000;margin-top:4px;padding-top:4px">${order.customer_notes}</div>` : ""}
  <div class="xs" style="margin-top:2px">${date}</div>
</div>`;
}
