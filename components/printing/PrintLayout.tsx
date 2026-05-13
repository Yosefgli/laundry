"use client";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface PrintLayoutProps {
  order: Order;
  translations: Record<string, string>;
  printLabel?: string;
}

export function PrintLayout({ order, translations: t, printLabel }: PrintLayoutProps) {
  const [status, setStatus] = useState<"idle" | "printing" | "error">("idle");

  async function handlePrint() {
    setStatus("printing");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, type: "receipt" }),
      });
      setStatus(res.ok ? "idle" : "error");
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
        ? "שגיאת הדפסה"
        : (printLabel ?? t["print.print_receipt"])}
    </Button>
  );
}
