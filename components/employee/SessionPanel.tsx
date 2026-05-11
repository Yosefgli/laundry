"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { DegradedModeBanner, ReconnectingBanner } from "@/components/ui/DegradedModeBanner";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import { SessionEvent, type BroadcastEnvelope } from "@/lib/realtime/events";
import { formatCurrency, formatWeight, type Locale } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface SessionPanelProps {
  sessionId: string;
  order: Order;
  translations: Record<string, string>;
  locale: Locale;
  onStatusAdvanced: (newStatus: string) => void;
  onMarkPaid: () => void;
  onCancelSession: () => void;
  onOrderRefresh: () => void;
}

const NEXT_STATUS: Record<string, string> = {
  confirmed: "washing",
  washing:   "drying",
  drying:    "ironing",
  ironing:   "ready",
  ready:     "delivered",
};

export function SessionPanel({
  sessionId,
  order,
  translations: t,
  locale,
  onStatusAdvanced,
  onMarkPaid,
  onCancelSession,
  onOrderRefresh,
}: SessionPanelProps) {
  const [connState, setConnState] = useState<"connecting" | "connected" | "reconnecting" | "degraded" | "error">("connecting");
  const [advancing, setAdvancing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleEvent = useCallback((envelope: BroadcastEnvelope) => {
    if (envelope.type === SessionEvent.ORDER_CONFIRMED) {
      onStatusAdvanced("confirmed");
    }
    onOrderRefresh();
  }, [onOrderRefresh, onStatusAdvanced]);

  const { publish } = useSessionChannel({
    sessionId,
    onEvent: handleEvent,
    onStateChange: setConnState,
  });

  async function advanceStatus() {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setAdvancing(true);
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (json.data) {
        onStatusAdvanced(next);
        publish(SessionEvent.ORDER_STATUS_CHANGED, {
          orderId: order.id,
          status: next,
          previousStatus: order.status,
        });
      }
    } finally {
      setAdvancing(false);
    }
  }

  async function cancelSession() {
    if (!confirm(t["employee.confirm_cancel"])) return;
    setCancelling(true);
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      publish(SessionEvent.SESSION_CANCELLED, {});
      onCancelSession();
    } finally {
      setCancelling(false);
    }
  }

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="space-y-4">
      {connState === "reconnecting" && <ReconnectingBanner message={t["common.reconnecting"]} />}
      {connState === "degraded"     && <DegradedModeBanner message={t["common.degraded_mode"]} />}

      <div className="bg-white rounded-xl border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg">{order.order_number}</span>
          <div className="flex gap-2">
            <OrderStatusBadge
              status={order.status}
              label={t[`status.${order.status}`] ?? order.status}
            />
            <PaymentStatusBadge
              status={order.payment_status}
              label={t[`payment.${order.payment_status}`] ?? order.payment_status}
            />
          </div>
        </div>

        {order.customer_name && (
          <div className="text-sm text-gray-600">
            {order.customer_name} · {order.customer_phone}
          </div>
        )}

        <div className="text-sm text-gray-700">
          {formatWeight(Number(order.total_weight_kg), locale, t["unit.kg"])} · {formatCurrency(Number(order.total_amount), locale)}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {order.payment_status === "pending" && order.status === "confirmed" && (
          <Button onClick={onMarkPaid} variant="primary" size="lg">
            {t["employee.mark_paid"]}
          </Button>
        )}

        {nextStatus && order.payment_status === "paid" && (
          <Button onClick={advanceStatus} loading={advancing} variant="primary" size="lg">
            {t["employee.advance_status"]}: {t[`status.${nextStatus}`] ?? nextStatus}
          </Button>
        )}

        <Button
          onClick={cancelSession}
          loading={cancelling}
          variant="danger"
          size="md"
        >
          {t["employee.cancel_session"]}
        </Button>
      </div>
    </div>
  );
}
