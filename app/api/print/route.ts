import { NextRequest, NextResponse } from "next/server";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bwipjs = require("bwip-js") as { toBuffer: (opts: Record<string, unknown>) => Promise<Buffer> };
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { formatCurrency, formatWeight, localeToIntl } from "@/lib/i18n";

export async function POST(request: NextRequest) {
  try {
    await requireEmployee();

    const { orderId, type = "combined" } = (await request.json()) as {
      orderId: string;
      type?: "receipt" | "label" | "combined";
    };

    const supabase = createServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select(
        `*, workstation:workstations(printer_http_url), order_items(*, order_item_services(*, service_type:service_types(id, code)))`
      )
      .eq("id", orderId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const workstation = order.workstation as { printer_http_url: string | null } | null;
    const printUrl = workstation?.printer_http_url ?? process.env.PRINT_SERVER_URL;
    if (!printUrl) {
      return NextResponse.json(
        { error: "No printer configured for this workstation" },
        { status: 422 }
      );
    }

    const { locale, translations: t } = await getI18n();

    const qrPng = await bwipjs.toBuffer({
      bcid: "qrcode",
      text: order.id,
      scale: 4,
      backgroundcolor: "ffffff",
    });
    const qrDataUrl = `data:image/png;base64,${qrPng.toString("base64")}`;

    const shopName = process.env.NEXT_PUBLIC_SHOP_NAME ?? "";
    const shopAddress = process.env.NEXT_PUBLIC_SHOP_ADDRESS ?? "";
    const taxId = process.env.NEXT_PUBLIC_TAX_ID ?? "";

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

    const printRes = await fetch(printUrl, {
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
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];
  const itemsHtml = items
    .map((item, idx) => {
      const services = (
        item.order_item_services as Array<Record<string, unknown>>
      ) ?? [];
      const servicesHtml = services
        .map((s) => {
          const code = (s.service_type as Record<string, string> | null)?.code ?? "";
          return `<div class="row xs"><span>${t[`service.${code}`] ?? code}</span><span>${formatCurrency(Number(s.line_total), locale as "en" | "he" | "my")}</span></div>`;
        })
        .join("");
      return `<div style="margin-bottom:3px"><div class="bold">${t["customer.bag"]} ${idx + 1} — ${formatWeight(Number(item.weight_kg), locale as "en" | "he" | "my", t["unit.kg"])}</div>${servicesHtml}</div>`;
    })
    .join("");

  return `<div class="page">
  <div class="center bold" style="font-size:12pt">${shopName}</div>
  ${shopAddress ? `<div class="center xs">${shopAddress}</div>` : ""}
  ${taxId ? `<div class="center xs">${t["print.receipt_title"]} | ${taxId}</div>` : ""}
  <hr/>
  <div class="row"><span>${t["print.order_number"]}</span><span class="bold">${order.order_number}</span></div>
  <div class="row"><span>${t["print.weight"]}</span><span>${formatWeight(Number(order.total_weight_kg), locale as "en" | "he" | "my", t["unit.kg"])}</span></div>
  <hr/>
  ${itemsHtml}
  <hr/>
  <div class="row"><span>${t["print.subtotal"]}</span><span>${formatCurrency(Number(order.subtotal), locale as "en" | "he" | "my")}</span></div>
  <div class="row"><span>${t["print.tax"]}</span><span>${formatCurrency(Number(order.tax_amount), locale as "en" | "he" | "my")}</span></div>
  <div class="row bold"><span>${t["print.total"]}</span><span>${formatCurrency(Number(order.total_amount), locale as "en" | "he" | "my")}</span></div>
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
  const items = (order.order_items as Array<Record<string, unknown>>) ?? [];
  const serviceCodes = items
    .flatMap((i) =>
      (i.order_item_services as Array<Record<string, unknown>>)?.map(
        (s) => (s.service_type as Record<string, string> | null)?.code
      ) ?? []
    )
    .filter(Boolean) as string[];
  const uniqueServices = [...new Set(serviceCodes)];
  const servicesLabel = uniqueServices
    .map((s) => t[`service.${s}`] ?? s)
    .join(" · ");

  const date = new Date(order.created_at as string).toLocaleDateString(
    localeToIntl(locale as "en" | "he" | "my")
  );

  return `<div class="page center" style="font-size:12pt;font-weight:bold">
  <div style="font-size:20pt;font-weight:900;margin-bottom:6px">${order.order_number}</div>
  <div><img class="qr" style="width:140px;height:140px" src="${qrDataUrl}" alt="QR"/></div>
  <div style="font-size:10pt;font-weight:bold;margin-top:4px">${order.customer_name ?? "—"}</div>
  <div class="xs" style="margin-top:2px">${servicesLabel}</div>
  ${order.customer_notes ? `<div class="xs" style="border-top:1px solid #000;margin-top:4px;padding-top:4px">${order.customer_notes}</div>` : ""}
  <div class="xs" style="margin-top:2px">${date}</div>
</div>`;
}
