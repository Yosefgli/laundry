"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { sendToPrinter } from "@/lib/print-client";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface BagLabelProps {
  order: Order;
  translations: Record<string, string>;
  printLabel?: string;
}

export function BagLabel({ order, translations: t, printLabel }: BagLabelProps) {
  const [status, setStatus] = useState<"idle" | "printing" | "error">("idle");

  async function handlePrint() {
    setStatus("printing");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, type: "label" }),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("error"); return; }
      if (data.clientPrint) await sendToPrinter(data.printerUrl, data.xml);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handlePrint}
      disabled={status === "printing"}
    >
      {status === "printing"
        ? "..."
        : status === "error"
        ? (t["print.error"] ?? "Print Error")
        : (printLabel ?? t["print.print_label"])}
    </Button>
  );
}
