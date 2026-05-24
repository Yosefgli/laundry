"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { sendToPrinter } from "@/lib/print-client";

interface ReceiptPrintProps {
  orderId: string;
  translations: Record<string, string>;
  className?: string;
}

export function ReceiptPrint({ orderId, translations: t, className }: ReceiptPrintProps) {
  const [status, setStatus] = useState<"idle" | "printing" | "error">("idle");

  async function handlePrint() {
    setStatus("printing");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type: "receipt" }),
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
      variant="secondary"
      size="lg"
      onClick={handlePrint}
      disabled={status === "printing"}
      className={className}
    >
      <Printer className="me-2 h-4 w-4" aria-hidden="true" />
      {status === "printing"
        ? "..."
        : status === "error"
        ? (t["print.error"] ?? "שגיאת הדפסה")
        : (t["print.receipt"] ?? "הדפסת קבלה")}
    </Button>
  );
}
