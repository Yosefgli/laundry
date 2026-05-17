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
      // The Vercel server cannot reach private LAN IPs (192.168.x.x).
      // Return the XML to the browser so the tablet — which is on the local
      // network — can POST directly to the printer via lib/print-client.ts.
      const eposUrl = `http://${printerIp}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
      const xml = buildEposXml({ type, order, t, locale, shopName, shopAddress, taxId });
      return NextResponse.json({ clientPrint: true, printerUrl: eposUrl, xml });
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
    if (!isAuth) console.error("[print] Unhandled error:", err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: isAuth ? "Unauthorized" : `Internal error: ${detail}` },
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

// Remove Unicode BiDi control characters that confuse LTR-only printers
function stripBidi(s: string): string {
  return s.replace(/[‎‏‪-‮⁦-⁩]/g, "");
}

// Reverse string for RTL display on an LTR-only thermal printer.
// When the printer outputs characters left-to-right, reversing the string
// makes Hebrew read correctly right-to-left on the physical paper.
function reverseRtl(s: string): string {
  return [...s].reverse().join("");
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
  const isRtl = loc === "he";
  const SEP = "-".repeat(EPOS_WIDTH) + "\n";
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];

  // Escape + reverse for RTL if needed
  const te = (s: string) => esc(isRtl ? reverseRtl(stripBidi(s)) : s);
  // Currency/weight without bidi marks
  const cur = (n: number) => stripBidi(formatCurrency(n, loc));
  const wt = (kg: number) => stripBidi(formatWeight(kg, loc, t["unit.kg"]));
  // Padded row: RTL flips positions so label ends up on the right (RTL-readable side)
  const pr = (label: string, value: string) =>
    isRtl ? padRow(value, reverseRtl(stripBidi(label))) : padRow(label, value);

  const itemLines = items
    .map((item, idx) => {
      const services = (item.order_item_services as Array<Record<string, unknown>>) ?? [];
      const bagHeader = isRtl
        ? reverseRtl(`${t["customer.bag"]} ${idx + 1} — ${wt(Number(item.weight_kg))}`)
        : `${t["customer.bag"]} ${idx + 1} — ${wt(Number(item.weight_kg))}`;
      const serviceLines = services
        .map((s) => {
          const code = (s.service_type as Record<string, string> | null)?.code ?? "";
          const label = `  ${t[`service.${code}`] ?? code}`;
          const price = cur(Number(s.line_total));
          return (isRtl ? padRow(price, reverseRtl(label)) : padRow(label, price)) + "\n";
        })
        .join("");
      return bagHeader + "\n" + serviceLines;
    })
    .join("");

  return [
    `<text align="center" width="2" height="2">${te(shopName)}\n</text>`,
    shopAddress ? `<text align="center" width="1" height="1">${esc(shopAddress)}\n</text>` : "",
    taxId ? `<text align="center">${te(`${t["print.receipt_title"]} | ${taxId}`)}\n</text>` : "",
    `<text align="left">${SEP}</text>`,
    `<text>${esc(pr(t["print.order_number"] ?? "Order", String(order.order_number ?? "")))}\n</text>`,
    `<text>${esc(pr(t["print.weight"] ?? "Weight", wt(Number(order.total_weight_kg))))}\n</text>`,
    `<text>${SEP}</text>`,
    `<text>${esc(itemLines)}</text>`,
    `<text>${SEP}</text>`,
    `<text>${esc(pr(t["print.subtotal"] ?? "Subtotal", cur(Number(order.subtotal))))}\n</text>`,
    `<text>${esc(pr(t["print.tax"] ?? "Tax", cur(Number(order.tax_amount))))}\n</text>`,
    `<text>${esc(pr(t["print.total"] ?? "Total", cur(Number(order.total_amount))))}\n</text>`,
    `<text>${esc(pr(t["print.payment_status"] ?? "Payment", t[`payment.${order.payment_status}`] ?? String(order.payment_status)))}\n</text>`,
    `<text>${SEP}</text>`,
    `<barcode type="code128" align="center" width="3" height="100">{B}${String(order.order_number ?? "")}</barcode>`,
    `<text align="center">${esc(String(order.order_number ?? ""))}\n</text>`,
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
  const isRtl = loc === "he";
  const te = (s: string) => esc(isRtl ? reverseRtl(stripBidi(s)) : s);
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
    `<text align="center" width="2" height="2">${esc(String(order.order_number ?? ""))}\n</text>`,
    `<barcode type="code128" align="center" width="3" height="100">{B}${String(order.order_number ?? "")}</barcode>`,
    `<text align="center" width="1" height="1">${esc(String(order.order_number ?? ""))}\n</text>`,
    order.customer_name ? `<text align="center">${te(String(order.customer_name))}\n</text>` : "",
    servicesLabel ? `<text align="center">${te(servicesLabel)}\n</text>` : "",
    order.customer_notes ? `<text align="center">${te(String(order.customer_notes))}\n</text>` : "",
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
