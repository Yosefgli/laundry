"use client";
import { useRef } from "react";
import { Barcode } from "@/components/printing/Barcode";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Array<
    Database["public"]["Tables"]["order_items"]["Row"] & {
      order_item_services?: Array<{
        service_type?: { code: string } | null;
      }>;
    }
  >;
};

interface BagLabelProps {
  order: Order;
  translations: Record<string, string>;
  printLabel?: string;
}

export function BagLabel({ order, translations: t, printLabel = "Print Label" }: BagLabelProps) {
  const printRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!printRef.current) return;
    window.print();
  }

  const servicesCodes = order.order_items
    ?.flatMap((i) => i.order_item_services?.map((s) => s.service_type?.code) ?? [])
    .filter(Boolean);
  const uniqueServices = [...new Set(servicesCodes)];

  return (
    <>
      <Button variant="secondary" size="sm" onClick={handlePrint}>
        {printLabel}
      </Button>

      <div ref={printRef} className="bag-label-layout hidden print:block">
        <style>{`
          @media print {
            body > *:not(.bag-label-layout) { display: none !important; }
            .bag-label-layout { display: block !important; }
          }
          .bag-label-layout {
            width: 80mm;
            font-family: monospace;
            font-size: 12pt;
            font-weight: bold;
            color: #000;
            text-align: center;
          }
        `}</style>

        <div className="text-2xl font-black mb-2">{order.order_number}</div>
        <div className="flex justify-center mb-2">
          <Barcode value={order.id} width={220} height={80} />
        </div>
        <div className="text-sm font-bold">{order.customer_name ?? "—"}</div>
        <div className="text-xs mt-1">
          {uniqueServices.map((s) => t[`service.${s}`] ?? s).join(" · ")}
        </div>
        {order.customer_notes && (
          <div className="text-xs mt-1 border-t pt-1">{order.customer_notes}</div>
        )}
        <div className="text-xs mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
      </div>
    </>
  );
}
