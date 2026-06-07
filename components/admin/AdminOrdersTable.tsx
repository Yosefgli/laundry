"use client";
import { useState } from "react";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { OrderEditor } from "@/components/employee/OrderEditor";
import { formatCurrency, formatDate, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/client";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  customer_name: string | null;
  customer_phone: string | null;
  total_weight_kg: number;
  total_amount: number;
  created_at: string;
  employee: { full_name?: string } | null;
};

type OrderDetail = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: Array<
    Database["public"]["Tables"]["order_items"]["Row"] & {
      order_item_services?: Array<
        Database["public"]["Tables"]["order_item_services"]["Row"] & {
          service_type?: { id: string; code: string } | null;
        }
      >;
    }
  >;
};

interface AdminOrdersTableProps {
  orders: OrderRow[];
  translations: Record<string, string>;
  locale: Locale;
}

export function AdminOrdersTable({ orders: initialOrders, translations: t, locale }: AdminOrdersTableProps) {
  const supabase = createClient();
  const [orders, setOrders] = useState<OrderRow[]>(initialOrders);
  const [editingOrder, setEditingOrder] = useState<OrderDetail | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function openEdit(orderId: string) {
    const { data } = await supabase
      .from("orders")
      .select(`*, order_items(*, order_item_services(*, service_type:service_types(id, code)))`)
      .eq("id", orderId)
      .single();
    if (data) setEditingOrder(data as unknown as OrderDetail);
  }

  async function reloadOrder(orderId: string): Promise<OrderDetail | null> {
    const { data } = await supabase
      .from("orders")
      .select(`*, order_items(*, order_item_services(*, service_type:service_types(id, code)))`)
      .eq("id", orderId)
      .single();
    return (data as unknown as OrderDetail | null) ?? null;
  }

  function handleOrderUpdated(updated: OrderDetail) {
    setEditingOrder(updated);
    setOrders((prev) =>
      prev.map((o) =>
        o.id === updated.id
          ? {
              ...o,
              status: updated.status,
              payment_status: updated.payment_status,
              customer_name: updated.customer_name,
              customer_phone: updated.customer_phone,
              total_amount: Number(updated.total_amount),
              total_weight_kg: Number(updated.total_weight_kg),
            }
          : o
      )
    );
  }

  async function deleteOrder(id: string) {
    if (!confirm(t["employee.confirm_cancel"] ?? "Are you sure?")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/orders/${id}`, { method: "DELETE" });
      setOrders((prev) => prev.filter((o) => o.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  if (editingOrder) {
    return (
      <OrderEditor
        order={editingOrder}
        translations={t}
        locale={locale}
        isAdmin={true}
        onBack={() => setEditingOrder(null)}
        onReload={() => reloadOrder(editingOrder.id)}
        onOrderUpdated={handleOrderUpdated}
      />
    );
  }

  return (
    <div className="bg-white rounded-xl border overflow-x-auto">
      <table className="w-full text-sm min-w-[700px]">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["admin.order_number"]}</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.customer"]}</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.status"]}</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.payment"]}</th>
            <th className="text-right px-4 py-2 font-semibold text-gray-600">{t["common.total"]}</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.created"]}</th>
            <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.employee"]}</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((order) => (
            <tr key={order.id} className="hover:bg-gray-50">
              <td className="px-4 py-2 font-mono font-medium">{order.order_number}</td>
              <td className="px-4 py-2">{order.customer_name ?? "—"}</td>
              <td className="px-4 py-2">
                <OrderStatusBadge
                  status={order.status as Parameters<typeof OrderStatusBadge>[0]["status"]}
                  label={t[`status.${order.status}`] ?? order.status}
                />
              </td>
              <td className="px-4 py-2">
                <PaymentStatusBadge
                  status={order.payment_status as Parameters<typeof PaymentStatusBadge>[0]["status"]}
                  label={t[`payment.${order.payment_status}`] ?? order.payment_status}
                />
              </td>
              <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(order.total_amount), locale)}</td>
              <td className="px-4 py-2 text-gray-500 text-xs">{formatDate(order.created_at)}</td>
              <td className="px-4 py-2 text-gray-500 text-xs">
                {order.employee?.full_name ?? "—"}
              </td>
              <td className="px-4 py-2">
                <div className="flex gap-1 justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openEdit(order.id)}
                  >
                    {t["common.edit"]}
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={deletingId === order.id}
                    onClick={() => deleteOrder(order.id)}
                  >
                    {t["common.delete"]}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && (
        <p className="p-6 text-sm text-gray-400 text-center">{t["employee.no_active_orders"]}</p>
      )}
    </div>
  );
}
