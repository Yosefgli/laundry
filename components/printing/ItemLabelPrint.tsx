"use client";
import { useState } from "react";
import { Tag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendToPrinter } from "@/lib/print-client";

interface ItemLabelPrintProps {
  orderId: string;
  itemId: string;
  translations: Record<string, string>;
  className?: string;
}

export function ItemLabelPrint({ orderId, itemId, translations: t, className }: ItemLabelPrintProps) {
  const [status, setStatus] = useState<"idle" | "printing" | "error">("idle");

  async function handlePrint() {
    setStatus("printing");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type: "label", itemId }),
      });
      const data = await res.json() as { clientPrint?: boolean; printerUrl?: string; xml?: string };
      if (!res.ok) { setStatus("error"); return; }
      if (data.clientPrint) await sendToPrinter(data.printerUrl!, data.xml!);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePrint}
      disabled={status === "printing"}
      className={className}
    >
      <Tag className="me-2 h-3.5 w-3.5" aria-hidden="true" />
      {status === "printing"
        ? "..."
        : status === "error"
        ? (t["print.error_short"] ?? "שגיאה")
        : (t["print.label"] ?? "הדפסת תווית")}
    </Button>
  );
}
