"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerInfoForm } from "@/components/customer/CustomerInfoForm";
import { DegradedModeBanner, ReconnectingBanner } from "@/components/ui/DegradedModeBanner";
import { Button } from "@/components/ui/Button";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import {
  SessionEvent,
  type BagColorType,
  type KioskWorkflowStep,
  type BagWeightEnteredPayload,
} from "@/lib/realtime/events";
import { formatCurrency, formatWeight, isRTL, type Locale } from "@/lib/i18n";
import type { CustomerInfoInput } from "@/lib/schemas/order";
import type { Database } from "@/lib/db/database.types";

type ServiceType = Database["public"]["Tables"]["service_types"]["Row"] & {
  pricing_rules?: Database["public"]["Tables"]["pricing_rules"]["Row"][];
};

type OrderItem = {
  id: string;
  weight_kg: number;
  bag_number: number;
  color_type: string | null;
  notes?: string | null;
  order_item_services?: Array<{
    id: string;
    service_type_id: string;
    line_total: number;
    service_type?: { id: string; code: string } | null;
  }>;
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_weight_kg: number;
  total_amount: number;
  order_items?: OrderItem[];
};

// Local bag state (augmented as customer selects services)
type BagState = {
  id: string;
  bagNumber: number;
  weightKg: number;
  serviceTypeId?: string;
  serviceCode?: string;
  colorType?: BagColorType;
  lineTotal?: number;
};

interface CustomerKioskProps {
  sessionId: string;
  initialWorkflowStep: string;
  pendingItemId: string | null;
  order: Order;
  serviceTypes: ServiceType[];
  translations: Record<string, string>;
  locale: Locale;
  onReturnToPriceList?: () => void;
}

const CELEBRATION_RETURN_DELAY_MS = 8000;

export function CustomerKiosk({
  sessionId,
  initialWorkflowStep,
  pendingItemId: initialPendingItemId,
  order,
  serviceTypes,
  translations: t,
  locale,
  onReturnToPriceList,
}: CustomerKioskProps) {
  const [step, setStep] = useState<KioskWorkflowStep>(
    initialWorkflowStep as KioskWorkflowStep ?? "customer_info"
  );
  const [pendingItemId, setPendingItemId] = useState<string | null>(initialPendingItemId);
  const [bags, setBags] = useState<BagState[]>(
    (order.order_items ?? []).map((item) => ({
      id: item.id,
      bagNumber: item.bag_number,
      weightKg: Number(item.weight_kg),
      serviceTypeId: item.order_item_services?.[0]?.service_type_id,
      serviceCode: item.order_item_services?.[0]?.service_type?.code,
      colorType: item.color_type as BagColorType | undefined,
      lineTotal: item.order_item_services?.[0]?.line_total,
    }))
  );
  const [orderTotal, setOrderTotal] = useState(order.total_amount ?? 0);
  const [connState, setConnState] = useState<"connecting" | "connected" | "reconnecting" | "degraded" | "error">("connecting");
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<BagColorType | "">("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const dir = isRTL(locale) ? "rtl" : "ltr";

  const handleEvent = useCallback(
    (envelope: { type: SessionEvent; payload: unknown }) => {
      if (envelope.type === SessionEvent.SESSION_CANCELLED) {
        setStep("cancelled");
      }
      if (envelope.type === SessionEvent.EMPLOYEE_BAG_WEIGHT_ENTERED) {
        const p = envelope.payload as BagWeightEnteredPayload;
        setPendingItemId(p.itemId);
        setBags((prev) => {
          if (prev.some((b) => b.id === p.itemId)) return prev;
          return [...prev, { id: p.itemId, bagNumber: p.bagNumber, weightKg: p.weightKg }];
        });
        setSelectedServiceId("");
        setSelectedColor("");
        setStep("bag_service_selection");
      }
    },
    []
  );

  const { publish } = useSessionChannel({
    sessionId,
    onEvent: handleEvent,
    onStateChange: setConnState,
  });

  // Return to price list after celebration
  useEffect(() => {
    if (step !== "order_confirmed") return;
    const timeout = window.setTimeout(() => {
      if (onReturnToPriceList) {
        onReturnToPriceList();
      } else {
        router.replace("/customer");
      }
    }, CELEBRATION_RETURN_DELAY_MS);
    return () => window.clearTimeout(timeout);
  }, [onReturnToPriceList, router, step]);

  async function handleInfoSubmitted(info: CustomerInfoInput) {
    void publish(SessionEvent.CUSTOMER_INFO_SUBMITTED, { sessionId, ...info });
    setSelectedServiceId("");
    setSelectedColor("");
    setStep("bag_service_selection");
  }

  async function handleBagServiceConfirm() {
    if (!selectedServiceId || !selectedColor || !pendingItemId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm_bag_service",
          itemId: pendingItemId,
          serviceTypeId: selectedServiceId,
          colorType: selectedColor,
        }),
      });
      const json = await res.json();
      if (!json.data) throw new Error(json.error ?? t["common.error"]);

      const serviceCode = json.data.serviceCode as string;
      const lineTotal = json.data.lineTotal as number;
      const newTotal = (json.data.order as { total_amount: number }).total_amount;

      setBags((prev) =>
        prev.map((b) =>
          b.id === pendingItemId
            ? { ...b, serviceTypeId: selectedServiceId, serviceCode, colorType: selectedColor as BagColorType, lineTotal }
            : b
        )
      );
      setOrderTotal(newTotal);
      setPendingItemId(null);

      void publish(SessionEvent.CUSTOMER_BAG_SERVICE_CONFIRMED, {
        itemId: pendingItemId,
        bagNumber: bags.find((b) => b.id === pendingItemId)?.bagNumber ?? 1,
        serviceTypeId: selectedServiceId,
        serviceCode,
        colorType: selectedColor,
        lineTotal,
      });

      setStep("bag_summary");
    } catch {
      // keep on service selection if error
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAddBag() {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request_add_bag" }),
      });
      void publish(SessionEvent.CUSTOMER_ADD_BAG_REQUESTED, {
        orderId: order.id,
        bagsCompleted: bags.filter((b) => b.serviceTypeId).length,
      });
      setStep("waiting_for_weight");
    } catch { /* ignore */ }
  }

  async function handleFinalizeOrder() {
    setSubmitting(true);
    try {
      // Advance order to confirmed (already done per bag, just ensure)
      await fetch(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      }).catch(() => undefined);

      // Complete session
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });

      void publish(SessionEvent.CUSTOMER_ORDER_FINALIZED, {
        orderId: order.id,
        orderNumber: order.order_number,
        total: orderTotal,
        bagCount: bags.length,
      });
      void publish(SessionEvent.SESSION_COMPLETED, { sessionId, orderId: order.id });

      setStep("order_confirmed");
    } catch { /* keep on summary */ } finally {
      setSubmitting(false);
    }
  }

  const pendingBag = bags.find((b) => b.id === pendingItemId);
  const completedBags = bags.filter((b) => b.serviceTypeId);
  const activeServices = serviceTypes.filter((s) => s.is_active);
  const shopName = "המכבסה By Chabad";

  return (
    <div className="min-h-screen bg-[#f8fefe]" dir={dir}>
      {connState === "reconnecting" && <ReconnectingBanner message={t["common.reconnecting"]} />}
      {connState === "degraded"     && <DegradedModeBanner message={t["common.degraded_mode"]} />}

      {/* Header */}
      <header className="bg-gradient-to-br from-brand-500 to-brand-700 text-white px-6 py-5 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
              <rect x="4" y="8" width="36" height="32" rx="4" stroke="white" strokeWidth="2.5" fill="none"/>
              <rect x="4" y="8" width="36" height="9" rx="4" fill="white" fillOpacity="0.3"/>
              <circle cx="32" cy="12.5" r="2" fill="white"/>
              <circle cx="37" cy="12.5" r="2" fill="white"/>
              <circle cx="22" cy="28" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
            </svg>
          </div>
          <div>
            <h1 className="font-black text-lg leading-none">{shopName}</h1>
            <p className="text-white/70 text-xs mt-0.5">{t["customer.welcome"]}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">

        {/* ── Step: customer info ─────────────────────────────────── */}
        {step === "customer_info" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7 space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{t["customer.your_name"]}</h2>
            <CustomerInfoForm
              orderId={order.id}
              translations={t}
              locale={locale}
              onSubmitted={handleInfoSubmitted}
            />
          </div>
        )}

        {/* ── Step: bag service selection ─────────────────────────── */}
        {step === "bag_service_selection" && pendingBag && (
          <div className="space-y-5">
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
              <div className="text-sm font-semibold text-brand-600 mb-1">
                {t["customer.bag"]} {pendingBag.bagNumber}
              </div>
              <div className="text-2xl font-black text-gray-900">
                {formatWeight(pendingBag.weightKg, locale, t["unit.kg"])}
              </div>
            </div>

            {/* Service type */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-900">{t["customer.select_services"]}</h3>
              <div className="grid grid-cols-1 gap-2">
                {activeServices.map((service) => {
                  const price = service.pricing_rules?.[0];
                  const selected = selectedServiceId === service.id;
                  return (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => setSelectedServiceId(service.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all text-left ${
                        selected
                          ? "border-brand-600 bg-brand-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className="font-semibold text-gray-900">
                        {t[`service.${service.code}`] ?? service.code}
                      </span>
                      {price && (
                        <span className="text-sm text-gray-500">
                          {formatCurrency(Number(price.price_per_kg), locale)}/kg
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color selection */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5 space-y-3">
              <h3 className="font-bold text-gray-900">{t["customer.select_color"] ?? "סוג כביסה"}</h3>
              <div className="grid grid-cols-3 gap-3">
                {(["white", "colorful", "dark"] as const).map((color) => {
                  const colorDot: Record<string, string> = {
                    white: "bg-white border-2 border-gray-300",
                    colorful: "bg-gradient-to-br from-pink-400 via-yellow-300 to-blue-400",
                    dark: "bg-gray-800",
                  };
                  const selected = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${
                        selected
                          ? "border-brand-600 bg-brand-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full ${colorDot[color]}`} />
                      <span className="text-xs font-medium text-gray-700">
                        {t[`color.${color}`] ?? color}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              size="xl"
              className="w-full"
              disabled={!selectedServiceId || !selectedColor}
              loading={submitting}
              onClick={handleBagServiceConfirm}
            >
              {t["common.confirm"]}
            </Button>
          </div>
        )}

        {/* ── Step: bag summary ───────────────────────────────────── */}
        {step === "bag_summary" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{t["customer.order_summary"] ?? "סיכום הזמנה"}</h2>

            {completedBags.map((bag) => (
              <div key={bag.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900">
                    {t["customer.bag"]} {bag.bagNumber} — {formatWeight(bag.weightKg, locale, t["unit.kg"])}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {bag.serviceCode ? (t[`service.${bag.serviceCode}`] ?? bag.serviceCode) : ""}
                    {bag.colorType ? ` · ${t[`color.${bag.colorType}`] ?? bag.colorType}` : ""}
                  </div>
                </div>
                <div className="text-brand-700 font-bold">
                  {bag.lineTotal !== undefined ? formatCurrency(bag.lineTotal, locale) : ""}
                </div>
              </div>
            ))}

            <div className="bg-brand-50 rounded-2xl border border-brand-200 p-4 flex items-center justify-between">
              <span className="font-bold text-gray-900">{t["customer.total"]}</span>
              <span className="text-2xl font-black text-brand-700">{formatCurrency(orderTotal, locale)}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button
                size="xl"
                variant="secondary"
                className="w-full"
                onClick={handleAddBag}
              >
                {t["customer.add_bag"] ?? "+ הוסף שקית"}
              </Button>
              <Button
                size="xl"
                className="w-full"
                loading={submitting}
                onClick={handleFinalizeOrder}
              >
                {t["customer.confirm_final"] ?? "אישור סופי"}
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: waiting for weight ────────────────────────────── */}
        {step === "waiting_for_weight" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="animate-pulse">
                <circle cx="12" cy="6" r="3" stroke="#0ea5e9" strokeWidth="2" fill="none"/>
                <path d="M3 20c0-4.418 4.03-8 9-8s9 3.582 9 8" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round" fill="none"/>
                <path d="M12 13v4M10 15h4" stroke="#0ea5e9" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">{t["customer.waiting_for_weight"] ?? "ממתין לשקילה…"}</h2>
            <p className="text-gray-500 text-sm">{t["customer.waiting_for_weight_desc"] ?? "העבר את השקית הבאה לעובדת"}</p>
          </div>
        )}

        {/* ── Step: celebration ───────────────────────────────────── */}
        {step === "order_confirmed" && (
          <div className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white rounded-3xl border border-brand-100 shadow-sm p-10 text-center space-y-5 min-h-[400px]">
            {/* Bubbles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {Array.from({ length: 18 }).map((_, i) => {
                const size = 20 + (i % 5) * 12;
                const left = (i * 37 + 5) % 95;
                const delay = (i * 0.4) % 3.5;
                const duration = 3 + (i % 4);
                return (
                  <div
                    key={i}
                    className="absolute rounded-full opacity-30"
                    style={{
                      width: size,
                      height: size,
                      left: `${left}%`,
                      bottom: "-20%",
                      background: `hsl(${180 + i * 15}, 70%, 65%)`,
                      animationName: "bubbleFloat",
                      animationDuration: `${duration}s`,
                      animationDelay: `${delay}s`,
                      animationTimingFunction: "ease-in-out",
                      animationIterationCount: "infinite",
                    }}
                  />
                );
              })}
            </div>

            <div className="relative z-10 space-y-5">
              <div className="mx-auto w-24 h-24 bg-brand-500 rounded-full flex items-center justify-center shadow-lg">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>

              <div className="inline-block bg-white border-2 border-brand-200 rounded-2xl px-6 py-3 shadow-sm">
                <span className="text-3xl font-black text-brand-700">{order.order_number}</span>
              </div>

              <h2 className="text-2xl font-black text-gray-900">{shopName}</h2>

              <div className="text-xl font-bold text-gray-700">
                {formatCurrency(orderTotal, locale)}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 text-amber-800 font-semibold text-sm">
                {t["print.pay_at_store"] ?? "יש לגשת לחנות לביצוע התשלום"}
              </div>
            </div>
          </div>
        )}

        {/* ── Step: cancelled ─────────────────────────────────────── */}
        {step === "cancelled" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 bg-red-100 rounded-full flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M6 18L18 6M6 6l12 12" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900">{t["status.cancelled"]}</h2>
            <p className="text-gray-400 text-sm">{t["customer.cancelled_help"]}</p>
          </div>
        )}
      </main>

      <style>{`
        @keyframes bubbleFloat {
          0%   { transform: translateY(0) scale(1); opacity: 0.3; }
          50%  { opacity: 0.5; }
          100% { transform: translateY(-110vh) scale(1.1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
