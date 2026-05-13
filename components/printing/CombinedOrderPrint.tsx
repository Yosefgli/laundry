"use client";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface CombinedOrderPrintProps {
  order: Order;
  translations: Record<string, string>;
  printLabel?: string;
  className?: string;
}

export function CombinedOrderPrint({
  order,
  translations: t,
  printLabel,
  className,
}: CombinedOrderPrintProps) {
  const [status, setStatus] = useState<"idle" | "printing" | "error">("idle");

  async function handlePrint() {
    setStatus("printing");
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, type: "combined" }),
      });
      setStatus(res.ok ? "idle" : "error");
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
        ? "שגיאת הדפסה"
        : (printLabel ?? t["print.print_all"])}
    </Button>
  );
}
