"use client";
import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import {
  SessionEvent,
  type BroadcastEnvelope,
  type BagServiceConfirmedPayload,
  type OrderFinalizedPayload,
} from "@/lib/realtime/events";
import { formatCurrency, formatWeight, type Locale } from "@/lib/i18n";
import { sendToPrinter } from "@/lib/print-client";
import type { Database } from "@/lib/db/database.types";

type Order = Database["public"]["Tables"]["orders"]["Row"];

interface SessionPanelProps {
  sessionId: string;
  order: Order;
  initialWorkflowStep?: string;
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
  initialWorkflowStep = "customer_info",
  translations: t,
  locale,
  onStatusAdvanced,
  onMarkPaid,
  onCancelSession,
  onOrderRefresh,
}: SessionPanelProps) {
  const [advancing, setAdvancing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [workflowStep, setWorkflowStep] = useState(initialWorkflowStep);
  const [addingBagWeight, setAddingBagWeight] = useState("");
  const [addingBag, setAddingBag] = useState(false);
  const [addBagError, setAddBagError] = useState<string | null>(null);
  const printingRef = useRef(false);

  async function triggerLabelPrint(itemId: string) {
    if (printingRef.current) return;
    printingRef.current = true;
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, type: "label", itemId }),
      });
      const json = await res.json();
      if (json.clientPrint && json.printerUrl && json.xml) {
        await sendToPrinter(json.printerUrl, json.xml);
      }
    } catch { /* silent — print errors shouldn't block flow */ } finally {
      printingRef.current = false;
    }
  }

  async function triggerReceiptPrint() {
    if (printingRef.current) return;
    printingRef.current = true;
    try {
      const res = await fetch("/api/print", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, type: "receipt" }),
      });
      const json = await res.json();
      if (json.clientPrint && json.printerUrl && json.xml) {
        await sendToPrinter(json.printerUrl, json.xml);
      }
    } catch { /* silent */ } finally {
      printingRef.current = false;
    }
  }

  const handleEvent = useCallback((envelope: BroadcastEnvelope) => {
    if (envelope.type === SessionEvent.CUSTOMER_BAG_SERVICE_CONFIRMED) {
      const p = envelope.payload as BagServiceConfirmedPayload;
      void triggerLabelPrint(p.itemId);
      setWorkflowStep("bag_summary");
      onOrderRefresh();
    }
    if (envelope.type === SessionEvent.CUSTOMER_ADD_BAG_REQUESTED) {
      setWorkflowStep("waiting_for_weight");
    }
    if (envelope.type === SessionEvent.CUSTOMER_ORDER_FINALIZED) {
      const p = envelope.payload as OrderFinalizedPayload;
      void triggerReceiptPrint();
      onStatusAdvanced("confirmed");
      onOrderRefresh();
      void p;
    }
    if (envelope.type === SessionEvent.ORDER_CONFIRMED) {
      onStatusAdvanced("confirmed");
      onOrderRefresh();
    }
    if ([
      SessionEvent.CUSTOMER_INFO_SUBMITTED,
      SessionEvent.WORKFLOW_STEP_CHANGED,
    ].includes(envelope.type)) {
      onOrderRefresh();
    }
  }, [onOrderRefresh, onStatusAdvanced]); // eslint-disable-line react-hooks/exhaustive-deps

  const { publish } = useSessionChannel({
    sessionId,
    onEvent: handleEvent,
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

  async function handleAddBagWeight() {
    const kg = parseFloat(addingBagWeight);
    if (!kg || kg <= 0) {
      setAddBagError(t["employee.invalid_weight"] ?? "Invalid weight");
      return;
    }
    setAddingBag(true);
    setAddBagError(null);
    try {
      const res = await fetch(`/api/orders/${order.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weightKg: kg }),
      });
      const json = await res.json();
      if (!json.data) throw new Error(json.error ?? "Error adding bag");

      const newItem = json.data as { id: string; bag_number: number; weight_kg: number };
      setAddingBagWeight("");
      setWorkflowStep("bag_service_selection");

      publish(SessionEvent.EMPLOYEE_BAG_WEIGHT_ENTERED, {
        itemId: newItem.id,
        bagNumber: newItem.bag_number,
        weightKg: Number(newItem.weight_kg),
      });

      onOrderRefresh();
    } catch (err) {
      setAddBagError(err instanceof Error ? err.message : t["common.error"]);
    } finally {
      setAddingBag(false);
    }
  }

  const nextStatus = NEXT_STATUS[order.status];

  // Labels for workflow step
  const stepLabels: Record<string, string> = {
    customer_info:         t["employee.step_customer_info"] ?? "Customer info",
    bag_service_selection: t["employee.step_bag_service"] ?? "Customer selecting service",
    bag_summary:           t["employee.step_bag_summary"] ?? "Customer reviewing summary",
    waiting_for_weight:    t["employee.step_waiting_weight"] ?? "Waiting: add next bag",
    order_confirmed:       t["employee.step_order_confirmed"] ?? "Order confirmed",
  };

  return (
    <div className="space-y-4">
      {/* Order header */}
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

        {/* Workflow step indicator */}
        {["customer_info", "bag_service_selection", "bag_summary", "waiting_for_weight"].includes(workflowStep) && (
          <div className="text-xs bg-brand-50 text-brand-700 rounded-lg px-3 py-1.5 font-medium">
            {stepLabels[workflowStep] ?? workflowStep}
          </div>
        )}
      </div>

      {/* Add bag weight input (shown when customer pressed "add bag") */}
      {workflowStep === "waiting_for_weight" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
          <div className="font-semibold text-amber-800">
            {t["employee.add_next_bag"] ?? "הוסף שקית נוספת — הכנס משקל"}
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              step="0.001"
              min="0.1"
              max="999"
              placeholder={t["employee.weight_kg"]}
              value={addingBagWeight}
              onChange={(e) => setAddingBagWeight(e.target.value)}
              className="flex-1"
            />
            <Button
              loading={addingBag}
              onClick={handleAddBagWeight}
              disabled={!addingBagWeight}
            >
              {t["common.confirm"]}
            </Button>
          </div>
          {addBagError && <p className="text-sm text-red-600">{addBagError}</p>}
        </div>
      )}

      {/* Status actions (after order is confirmed) */}
      {!["customer_info", "bag_service_selection", "bag_summary", "waiting_for_weight"].includes(workflowStep) && (
        <div className="flex flex-wrap gap-2">
          {order.payment_status === "pending" && !["cancelled", "void", "delivered"].includes(order.status) && (
            <Button onClick={onMarkPaid} variant="primary" size="lg">
              {t["employee.mark_paid"]}
            </Button>
          )}

          {nextStatus && (nextStatus !== "delivered" || order.payment_status === "paid") && (
            <Button onClick={advanceStatus} loading={advancing} variant="primary" size="lg">
              {t["employee.advance_status"]}: {t[`status.${nextStatus}`] ?? nextStatus}
            </Button>
          )}
        </div>
      )}

      {/* Cancel session */}
      <Button
        onClick={cancelSession}
        loading={cancelling}
        variant="danger"
        size="md"
      >
        {t["employee.cancel_session"]}
      </Button>
    </div>
  );
}
