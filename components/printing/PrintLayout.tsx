"use client";
import { useRef } from "react";
import { Barcode } from "@/components/printing/Barcode";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";
import { formatCurrency, formatWeight } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Array<
    Database["public"]["Tables"]["order_items"]["Row"] & {
      order_item_services?: Array<
        Database["public"]["Tables"]["order_item_services"]["Row"] & {
          service_type?: { code: string } | null;
        }
      >;
    }
  >;
};

interface PrintLayoutProps {
  order: Order;
  locale: Locale;
  translations: Record<string, string>;
  shopName: string;
  shopAddress?: string;
  taxId?: string;
  printLabel?: string;
}

export function PrintLayout({
  order,
  locale,
  translations: t,
  shopName,
  shopAddress,
  taxId,
  printLabel = "Print Receipt",
}: PrintLayoutProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!printRef.current) return;
    window.print();
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handlePrint}>
        {printLabel}
      </Button>

      {/* Visible only in @media print */}
      <div ref={printRef} className="print-layout hidden print:block">
        <style>{`
          @media print {
            body > *:not(.print-layout) { display: none !important; }
            .print-layout { display: block !important; }
          }
          .print-layout {
            width: 80mm;
            font-family: monospace;
            font-size: 10pt;
            color: #000;
          }
        `}</style>

        <div className="text-center font-bold text-base mb-1">{shopName}</div>
        {shopAddress && <div className="text-center text-xs mb-1">{shopAddress}</div>}
        {taxId && <div className="text-center text-xs mb-2">{t["print.receipt_title"]} | {taxId}</div>}

        <hr className="border-dashed my-1" />

        <div className="flex justify-between">
          <span>{t["print.order_number"]}</span>
          <span className="font-bold">{order.order_number}</span>
        </div>
        <div className="flex justify-between">
          <span>{t["print.weight"]}</span>
          <span>{formatWeight(Number(order.total_weight_kg), locale, t["unit.kg"])}</span>
        </div>

        <hr className="border-dashed my-1" />

        {order.order_items?.map((item, idx) => (
          <div key={item.id} className="mb-1">
            <div className="font-medium">
              {t["customer.bag"]} {idx + 1} — {formatWeight(Number(item.weight_kg), locale, t["unit.kg"])}
            </div>
            {item.order_item_services?.map((ois) => (
              <div key={ois.id} className="flex justify-between pl-2 text-xs">
                <span>{t[`service.${ois.service_type?.code}`] ?? ois.service_type?.code}</span>
                <span>{formatCurrency(Number(ois.line_total), locale)}</span>
              </div>
            ))}
          </div>
        ))}

        <hr className="border-dashed my-1" />

        <div className="flex justify-between">
          <span>{t["print.subtotal"]}</span>
          <span>{formatCurrency(Number(order.subtotal), locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t["print.tax"]}</span>
          <span>{formatCurrency(Number(order.tax_amount), locale)}</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>{t["print.total"]}</span>
          <span>{formatCurrency(Number(order.total_amount), locale)}</span>
        </div>
        <div className="flex justify-between">
          <span>{t["print.payment_status"]}</span>
          <span>{t[`payment.${order.payment_status}`] ?? order.payment_status}</span>
        </div>

        <hr className="border-dashed my-2" />

        <div className="flex justify-center">
          <Barcode value={order.id} width={200} height={60} />
        </div>

        <div className="text-center text-xs mt-1">{order.id.slice(0, 8).toUpperCase()}</div>
      </div>
    </>
  );
}
