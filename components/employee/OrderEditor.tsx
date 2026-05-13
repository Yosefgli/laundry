"use client";
import { useEffect, useState } from "react";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { CombinedOrderPrint } from "@/components/printing/CombinedOrderPrint";
import { formatCurrency, formatWeight, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";

type OrderItemService = Database["public"]["Tables"]["order_item_services"]["Row"] & {
  service_type?: { id: string; code: string } | null;
};
type OrderItemWithServices = Database["public"]["Tables"]["order_items"]["Row"] & {
  order_item_services?: OrderItemService[];
};
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: OrderItemWithServices[];
};
type OrderStatus = Database["public"]["Enums"]["order_status"];

const ORDER_STATUSES: OrderStatus[] = [
  "draft",
  "weighed",
  "confirmed",
  "washing",
  "drying",
  "ironing",
  "ready",
  "delivered",
  "cancelled",
  "void",
];

interface OrderEditorProps {
  order: Order;
  translations: Record<string, string>;
  locale: Locale;
  onBack: () => void;
  onReload: () => Promise<Order | null>;
  onOrderUpdated: (order: Order) => void;
}

export function OrderEditor({
  order,
  translations: t,
  locale,
  onBack,
  onReload,
  onOrderUpdated,
}: OrderEditorProps) {
  const [customerName, setCustomerName] = useState(order.customer_name ?? "");
  const [customerPhone, setCustomerPhone] = useState(order.customer_phone ?? "");
  const [customerNotes, setCustomerNotes] = useState(order.customer_notes ?? "");
  const [totalWeightKg, setTotalWeightKg] = useState(String(Number(order.total_weight_kg)));
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCustomerName(order.customer_name ?? "");
    setCustomerPhone(order.customer_phone ?? "");
    setCustomerNotes(order.customer_notes ?? "");
    setTotalWeightKg(String(Number(order.total_weight_kg)));
    setSelectedStatus(order.status);
  }, [order]);

  async function reloadOrder() {
    const refreshed = await onReload();
    if (refreshed) onOrderUpdated(refreshed);
  }

  async function saveDetails() {
    const parsedWeight = Number(totalWeightKg);
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setError(t["employee.order_edit_error"]);
      return;
    }

    setSavingDetails(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_details",
          customerName,
          customerPhone: customerPhone.replace(/\s/g, "") || null,
          customerNotes,
          totalWeightKg: parsedWeight,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error ?? t["common.error"]);
      await reloadOrder();
      setMessage(t["employee.order_saved"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t["common.error"]);
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveStatus() {
    setSavingStatus(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selectedStatus, force: true }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error ?? t["common.error"]);
      await reloadOrder();
      setMessage(t["employee.order_saved"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t["common.error"]);
    } finally {
      setSavingStatus(false);
    }
  }

  async function markPaid() {
    setMarkingPaid(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": `pay-${order.id}-${Date.now()}`,
        },
        body: JSON.stringify({ orderId: order.id, amount: Number(order.total_amount) }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) throw new Error(json.error ?? t["common.error"]);
      await reloadOrder();
      setMessage(t["employee.order_saved"]);
    } catch (err) {
      setError(err instanceof Error ? err.message : t["common.error"]);
    } finally {
      setMarkingPaid(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="me-2 h-4 w-4" aria-hidden="true" />
          {t["employee.back_dashboard"]}
        </Button>
        <CombinedOrderPrint
          order={order}
          translations={t}
          printLabel={t["print.print_all"]}
          className="w-full sm:w-auto"
        />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-lg font-bold">{order.order_number}</div>
            <div className="text-sm text-gray-500">
              {formatWeight(Number(order.total_weight_kg), locale, t["unit.kg"])} / {formatCurrency(Number(order.total_amount), locale)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OrderStatusBadge status={order.status} label={t[`status.${order.status}`] ?? order.status} />
            <PaymentStatusBadge status={order.payment_status} label={t[`payment.${order.payment_status}`] ?? order.payment_status} />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="font-semibold">{t["employee.edit_order"]}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label={t["common.customer"]}
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
          />
          <Input
            label={t["customer.phone"]}
            type="tel"
            value={customerPhone}
            onChange={(event) => setCustomerPhone(event.target.value)}
          />
          <Input
            label={t["employee.weight_kg"]}
            type="number"
            min="0.1"
            max="999"
            step="0.001"
            value={totalWeightKg}
            onChange={(event) => setTotalWeightKg(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="customer-notes" className="text-sm font-medium text-gray-700">
            {t["customer.notes"]}
          </label>
          <textarea
            id="customer-notes"
            className="min-h-20 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={customerNotes}
            onChange={(event) => setCustomerNotes(event.target.value)}
          />
        </div>
        <Button onClick={saveDetails} loading={savingDetails} className="w-full sm:w-auto">
          <Save className="me-2 h-4 w-4" aria-hidden="true" />
          {t["common.save"]}
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="font-semibold">{t["employee.edit_status"]}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <select
            className="block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand-500"
            value={selectedStatus}
            onChange={(event) => setSelectedStatus(event.target.value as OrderStatus)}
          >
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t[`status.${status}`] ?? status}
              </option>
            ))}
          </select>
          <Button onClick={saveStatus} loading={savingStatus} disabled={selectedStatus === order.status}>
            {t["common.save"]}
          </Button>
        </div>
        {order.payment_status === "pending" && Number(order.total_amount) > 0 && (
          <Button variant="secondary" onClick={markPaid} loading={markingPaid}>
            {t["employee.mark_paid"]}
          </Button>
        )}
      </div>

      {message && <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
