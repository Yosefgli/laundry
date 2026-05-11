"use client";
import { useState, useCallback } from "react";
import { NewOrderForm } from "@/components/employee/NewOrderForm";
import { SessionPanel } from "@/components/employee/SessionPanel";
import { ScanInput } from "@/components/employee/ScanInput";
import { OrderEditor } from "@/components/employee/OrderEditor";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { CombinedOrderPrint } from "@/components/printing/CombinedOrderPrint";
import { formatCurrency, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";
import { createClient } from "@/lib/supabase/client";

type Employee = { id: string; full_name: string; role: string };
type OrderItemService = Database["public"]["Tables"]["order_item_services"]["Row"] & {
  service_type?: { id: string; code: string } | null;
};
type OrderItemWithServices = Database["public"]["Tables"]["order_items"]["Row"] & {
  order_item_services?: OrderItemService[];
};
type Order = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: OrderItemWithServices[];
};
type OrderItemQueryRow = Database["public"]["Tables"]["order_items"]["Row"] & {
  order_item_services?: OrderItemService | OrderItemService[] | null;
};
type OrderQueryRow = Database["public"]["Tables"]["orders"]["Row"] & {
  order_items?: OrderItemQueryRow | OrderItemQueryRow[] | null;
};
type RecentOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  customer_name: string | null;
  total_amount: number;
  created_at: string;
};

interface EmployeeDashboardProps {
  employee: Employee;
  translations: Record<string, string>;
  locale: Locale;
  workstationId?: string;
  workstationName: string;
  recentOrders: RecentOrder[];
}

type View = "dashboard" | "new_order" | "active_session" | "scan" | "order_detail";

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeOrder(order: OrderQueryRow): Order {
  return {
    ...order,
    order_items: toArray(order.order_items).map((item) => ({
      ...item,
      order_item_services: toArray(item.order_item_services),
    })),
  };
}

export function EmployeeDashboard({
  employee,
  translations: t,
  locale,
  workstationId,
  workstationName,
  recentOrders: initialOrders,
}: EmployeeDashboardProps) {
  const supabase = createClient();
  const [view, setView] = useState<View>("dashboard");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [scanResult, setScanResult] = useState<Order | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [recentOrders, setRecentOrders] = useState(initialOrders);

  const deviceId = `employee-${employee.id}-${workstationId ?? "default"}`;

  function handleOrderCreated(orderId: string, sessionId: string) {
    setActiveOrderId(orderId);
    setActiveSessionId(sessionId);
    fetchOrder(orderId);
    setView("active_session");
  }

  async function fetchOrder(orderId: string): Promise<Order | null> {
    const { data } = await supabase
      .from("orders")
      .select(`*, order_items(*, order_item_services(*, service_type:service_types(id, code)))`)
      .eq("id", orderId)
      .single();
    if (data) {
      const order = normalizeOrder(data);
      setActiveOrder(order);
      upsertRecentOrder(order);
      return order;
    }
    return null;
  }

  const handleOrderRefresh = useCallback(() => {
    if (activeOrderId) fetchOrder(activeOrderId);
  }, [activeOrderId]); // eslint-disable-line react-hooks/exhaustive-deps

  function upsertRecentOrder(order: Order) {
    setRecentOrders((prev) => {
      if (["delivered", "void"].includes(order.status)) {
        return prev.filter((item) => item.id !== order.id);
      }

      const summary: RecentOrder = {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        payment_status: order.payment_status,
        customer_name: order.customer_name,
        total_amount: Number(order.total_amount),
        created_at: order.created_at,
      };
      const withoutCurrent = prev.filter((item) => item.id !== order.id);
      return [summary, ...withoutCurrent].slice(0, 20);
    });
  }

  async function openOrder(orderId: string) {
    setActiveOrderId(orderId);
    setActiveSessionId(null);
    setScanError(null);
    const order = await fetchOrder(orderId);
    if (order) setView("order_detail");
  }

  async function handleScan(barcode: string) {
    setScanError(null);
    setScanResult(null);
    const res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ barcode }),
    });
    const json = await res.json();
    if (json.data) {
      setScanResult(normalizeOrder(json.data));
    } else {
      setScanError(json.error ?? t["common.not_available"]);
    }
  }

  async function handleMarkPaid() {
    if (!activeOrderId) return;
    const idempotencyKey = `pay-${activeOrderId}`;
    await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ orderId: activeOrderId, amount: activeOrder?.total_amount ?? 0 }),
    });
    handleOrderRefresh();
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">Laundry Ops</h1>
          <p className="text-xs text-gray-500">{workstationName} · {employee.full_name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("scan")}>{t["employee.scan_barcode"]}</Button>
          {employee.role === "admin" && (
            <Button variant="ghost" size="sm" onClick={() => window.location.href = "/admin"}>{t["nav.admin"]}</Button>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout}>{t["nav.logout"]}</Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Navigation tabs */}
        {view !== "active_session" && view !== "order_detail" && (
          <div className="flex gap-2">
            <Button
              variant={view === "dashboard" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("dashboard")}
            >
              {t["employee.dashboard"]}
            </Button>
            <Button
              variant={view === "new_order" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("new_order")}
            >
              {t["employee.new_order"]}
            </Button>
            <Button
              variant={view === "scan" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setView("scan")}
            >
              {t["employee.scan_barcode"]}
            </Button>
          </div>
        )}

        {/* Dashboard */}
        {view === "dashboard" && (
          <div className="space-y-3">
              <Button size="xl" className="w-full" onClick={() => setView("new_order")}>
                + {t["employee.new_order"]}
              </Button>
              <div className="bg-white rounded-xl border">
              <div className="p-3 border-b font-semibold text-sm text-gray-700">{t["employee.active_orders"]}</div>
              {recentOrders.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">{t["employee.no_active_orders"]}</p>
              ) : (
                <ul className="divide-y">
                  {recentOrders.map((order) => (
                    <li key={order.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold text-sm">{order.order_number}</div>
                        <div className="text-xs text-gray-500">{order.customer_name ?? "—"}</div>
                      </div>
                      <div className="flex flex-wrap justify-end gap-1">
                        <div className="flex gap-1">
                          <OrderStatusBadge
                            status={order.status as Parameters<typeof OrderStatusBadge>[0]["status"]}
                            label={t[`status.${order.status}`] ?? order.status}
                          />
                          <PaymentStatusBadge
                            status={order.payment_status as Parameters<typeof PaymentStatusBadge>[0]["status"]}
                            label={t[`payment.${order.payment_status}`] ?? order.payment_status}
                          />
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => openOrder(order.id)}>
                          {t["employee.open_order"]}
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* New Order */}
        {view === "new_order" && (
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <h2 className="font-semibold">{t["employee.new_order"]}</h2>
            <NewOrderForm
              translations={t}
              workstationId={workstationId}
              employeeDeviceId={deviceId}
              customerDeviceId={`customer-${employee.id}`}
              onCreated={handleOrderCreated}
            />
          </div>
        )}

        {/* Active Session */}
        {view === "active_session" && activeSessionId && activeOrder && (
          <div>
            <SessionPanel
              sessionId={activeSessionId}
              order={activeOrder}
              translations={t}
              locale={locale}
              onStatusAdvanced={(s) => setActiveOrder((o) => o ? { ...o, status: s as Order["status"] } : o)}
              onMarkPaid={handleMarkPaid}
              onCancelSession={() => { setView("dashboard"); setActiveOrder(null); }}
              onOrderRefresh={handleOrderRefresh}
            />
            {activeOrder && (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <CombinedOrderPrint
                  order={activeOrder}
                  locale={locale}
                  translations={t}
                  shopName="Laundry Pro"
                  printLabel={t["print.print_all"]}
                  className="w-full sm:w-auto"
                />
                <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={() => setView("dashboard")}>
                  {t["employee.back_dashboard"]}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Order Detail */}
        {view === "order_detail" && activeOrder && (
          <OrderEditor
            order={activeOrder}
            translations={t}
            locale={locale}
            onBack={() => setView("dashboard")}
            onReload={() => activeOrderId ? fetchOrder(activeOrderId) : Promise.resolve(null)}
            onOrderUpdated={(order) => {
              setActiveOrder(order);
              upsertRecentOrder(order);
            }}
          />
        )}

        {/* Scan */}
        {view === "scan" && (
          <div className="space-y-4">
            <ScanInput
              onScan={handleScan}
              placeholder={t["employee.scan_ready"]}
              cameraLabel={t["employee.open_camera"]}
              stopCameraLabel={t["employee.stop_camera"]}
              manualLabel={t["employee.scan_manual"]}
              cameraErrorLabel={t["employee.camera_unavailable"]}
              autoStartCamera
            />
            {scanError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {scanError}
              </div>
            )}
            {scanResult && (
              <div className="bg-white rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{scanResult.order_number}</span>
                  <OrderStatusBadge
                    status={scanResult.status as Parameters<typeof OrderStatusBadge>[0]["status"]}
                    label={t[`status.${scanResult.status}`] ?? scanResult.status}
                  />
                </div>
                <div className="text-sm">
                  {scanResult.customer_name ?? t["common.not_available"]} · {scanResult.customer_phone ?? t["common.not_available"]}
                </div>
                <div className="text-sm font-semibold">{formatCurrency(Number(scanResult.total_amount), locale)}</div>
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full"
                  onClick={() => {
                    setActiveOrderId(scanResult.id);
                    setActiveSessionId(null);
                    setActiveOrder(scanResult);
                    setView("order_detail");
                  }}
                >
                  {t["employee.open_order"]}
                </Button>
                {scanResult.status === "ready" && scanResult.payment_status === "paid" && (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={async () => {
                      await fetch(`/api/orders/${scanResult.id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "delivered" }),
                      });
                      setScanResult((r) => r ? { ...r, status: "delivered" } : r);
                    }}
                  >
                    {t[`status.delivered`]}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
