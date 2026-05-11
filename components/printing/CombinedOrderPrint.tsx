"use client";
import { useRef } from "react";
import { Printer } from "lucide-react";
import { Barcode } from "@/components/printing/Barcode";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";
import { formatCurrency, formatWeight, localeToIntl, type Locale } from "@/lib/i18n";

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

interface CombinedOrderPrintProps {
  order: Order;
  locale: Locale;
  translations: Record<string, string>;
  shopName: string;
  shopAddress?: string;
  taxId?: string;
  printLabel?: string;
  className?: string;
}

function isString(value: string | null | undefined): value is string {
  return Boolean(value);
}

export function CombinedOrderPrint({
  order,
  locale,
  translations: t,
  shopName,
  shopAddress,
  taxId,
  printLabel,
  className,
}: CombinedOrderPrintProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!printRef.current) return;

    const cleanup = () => {
      document.body.classList.remove("printing-combined-order");
      window.removeEventListener("afterprint", cleanup);
    };

    document.body.classList.add("printing-combined-order");
    window.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 50);
  }

  const serviceCodes = order.order_items
    ?.flatMap((item) => item.order_item_services?.map((service) => service.service_type?.code) ?? [])
    .filter(isString);
  const uniqueServices = [...new Set(serviceCodes)];

  return (
    <>
      <Button variant="secondary" size="lg" onClick={handlePrint} className={className}>
        <Printer className="me-2 h-4 w-4" aria-hidden="true" />
        {printLabel ?? t["print.print_all"]}
      </Button>

      <div ref={printRef} className="combined-print-layout hidden">
        <style>{`
          @media print {
            body.printing-combined-order * {
              visibility: hidden !important;
            }

            body.printing-combined-order .combined-print-layout,
            body.printing-combined-order .combined-print-layout * {
              visibility: visible !important;
            }

            body.printing-combined-order .combined-print-layout {
              display: block !important;
              position: absolute;
              inset-block-start: 0;
              inset-inline-start: 0;
              width: 80mm;
              color: #000;
              background: #fff;
            }

            body.printing-combined-order .combined-print-section {
              width: 80mm;
              break-after: page;
              page-break-after: always;
            }

            body.printing-combined-order .combined-print-section:last-child {
              break-after: auto;
              page-break-after: auto;
            }
          }
        `}</style>

        <section className="combined-print-section font-mono text-[10pt] text-black">
          <div className="mb-1 text-center text-base font-bold">{shopName}</div>
          {shopAddress && <div className="mb-1 text-center text-xs">{shopAddress}</div>}
          {taxId && <div className="mb-2 text-center text-xs">{t["print.receipt_title"]} | {taxId}</div>}

          <hr className="my-1 border-dashed" />

          <div className="flex justify-between">
            <span>{t["print.order_number"]}</span>
            <span className="font-bold">{order.order_number}</span>
          </div>
          <div className="flex justify-between">
            <span>{t["print.weight"]}</span>
            <span>{formatWeight(Number(order.total_weight_kg), locale, t["unit.kg"])}</span>
          </div>

          <hr className="my-1 border-dashed" />

          {order.order_items?.map((item, idx) => (
            <div key={item.id} className="mb-1">
              <div className="font-medium">
                {t["customer.bag"]} {idx + 1} - {formatWeight(Number(item.weight_kg), locale, t["unit.kg"])}
              </div>
              {item.order_item_services?.map((service) => (
                <div key={service.id} className="flex justify-between ps-2 text-xs">
                  <span>{t[`service.${service.service_type?.code}`] ?? service.service_type?.code}</span>
                  <span>{formatCurrency(Number(service.line_total), locale)}</span>
                </div>
              ))}
            </div>
          ))}

          <hr className="my-1 border-dashed" />

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

          <hr className="my-2 border-dashed" />

          <div className="flex justify-center">
            <Barcode value={order.id} width={200} height={60} />
          </div>
          <div className="mt-1 text-center text-xs">{order.id.slice(0, 8).toUpperCase()}</div>
        </section>

        <section className="combined-print-section w-[80mm] text-center font-mono text-[12pt] font-bold text-black">
          <div className="mb-2 text-2xl font-black">{order.order_number}</div>
          <div className="mb-2 flex justify-center">
            <Barcode value={order.id} width={220} height={80} />
          </div>
          <div className="text-sm font-bold">{order.customer_name ?? "-"}</div>
          <div className="mt-1 text-xs">
            {uniqueServices.map((service) => t[`service.${service}`] ?? service).join(" / ")}
          </div>
          {order.customer_notes && (
            <div className="mt-1 border-t pt-1 text-xs">{order.customer_notes}</div>
          )}
          <div className="mt-1 text-xs">
            {new Date(order.created_at).toLocaleDateString(localeToIntl(locale))}
          </div>
        </section>
      </div>
    </>
  );
}
