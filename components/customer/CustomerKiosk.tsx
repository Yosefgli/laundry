"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerInfoForm } from "@/components/customer/CustomerInfoForm";
import { ServiceSelector } from "@/components/customer/ServiceSelector";
import { DegradedModeBanner, ReconnectingBanner } from "@/components/ui/DegradedModeBanner";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import { SessionEvent } from "@/lib/realtime/events";
import { formatCurrency, isRTL, type Locale } from "@/lib/i18n";
import type { CustomerInfoInput } from "@/lib/schemas/order";
import type { Database } from "@/lib/db/database.types";

type ServiceType = Database["public"]["Tables"]["service_types"]["Row"] & {
  pricing_rules?: Database["public"]["Tables"]["pricing_rules"]["Row"][];
};

type Order = {
  id: string;
  order_number: string;
  status: string;
  total_weight_kg: number;
  order_items?: Array<{ id: string; weight_kg: number; notes?: string | null }>;
};

type Step = "info" | "services" | "confirmed" | "cancelled";
const CONFIRMATION_RETURN_DELAY_MS = 5000;

interface CustomerKioskProps {
  sessionId: string;
  order: Order;
  serviceTypes: ServiceType[];
  translations: Record<string, string>;
  locale: Locale;
}

export function CustomerKiosk({
  sessionId,
  order,
  serviceTypes,
  translations: t,
  locale,
}: CustomerKioskProps) {
  const [step, setStep] = useState<Step>("info");
  const [total, setTotal] = useState(0);
  const [connState, setConnState] = useState<"connecting" | "connected" | "reconnecting" | "degraded" | "error">("connecting");
  const router = useRouter();
  const dir = isRTL(locale) ? "rtl" : "ltr";

  const handleEvent = useCallback(
    (envelope: { type: SessionEvent }) => {
      if (envelope.type === SessionEvent.SESSION_CANCELLED) {
        setStep("cancelled");
      }
    },
    []
  );

  const { publish } = useSessionChannel({
    sessionId,
    onEvent: handleEvent,
    onStateChange: setConnState,
  });

  useEffect(() => {
    if (step !== "confirmed") return;

    const timeout = window.setTimeout(() => {
      router.replace("/customer");
    }, CONFIRMATION_RETURN_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [router, step]);

  function handleInfoSubmitted(info: CustomerInfoInput) {
    void publish(SessionEvent.CUSTOMER_INFO_SUBMITTED, { sessionId, ...info });
    setStep("services");
  }

  async function handleOrderConfirmed(finalTotal: number) {
    setTotal(finalTotal);
    await publish(SessionEvent.ORDER_CONFIRMED, { orderId: order.id, total: finalTotal });

    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete" }),
      });
      await publish(SessionEvent.SESSION_COMPLETED, { sessionId, orderId: order.id });
    } catch {
      // The order was already confirmed; keep the customer flow moving.
    } finally {
      setStep("confirmed");
    }
  }

  const items = order.order_items ?? [];

  return (
    <div className="min-h-screen bg-[#f8fefe]" dir={dir}>
      {connState === "reconnecting" && <ReconnectingBanner message={t["common.reconnecting"]} />}
      {connState === "degraded"     && <DegradedModeBanner message={t["common.degraded_mode"]} />}

      {/* Kiosk header */}
      <header className="bg-gradient-to-br from-brand-500 to-brand-700 text-white px-6 py-5 shadow-sm">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 44 44" fill="none">
              <rect x="4" y="8" width="36" height="32" rx="4" stroke="white" strokeWidth="2.5" fill="none"/>
              <rect x="4" y="8" width="36" height="9" rx="4" fill="white" fillOpacity="0.3"/>
              <circle cx="32" cy="12.5" r="2" fill="white"/>
              <circle cx="37" cy="12.5" r="2" fill="white"/>
              <circle cx="22" cy="28" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
              <circle cx="7" cy="4" r="2" fill="white" fillOpacity="0.7"/>
            </svg>
          </div>
          <div>
            <h1 className="font-black text-lg leading-none">Laundry <span className="font-light">by Chabad</span></h1>
            <p className="text-white/70 text-xs mt-0.5">{t["customer.welcome"]}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {/* Progress indicator */}
        {step !== "cancelled" && step !== "confirmed" && (
          <div className="flex gap-2">
            {(["info", "services"] as const).map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-colors duration-300 ${
                  step === s || (s === "info" && step === "services")
                    ? "bg-brand-500"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step: customer info */}
        {step === "info" && (
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

        {/* Step: service selection */}
        {step === "services" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-gray-900">{t["customer.select_services"]}</h2>
            <ServiceSelector
              orderId={order.id}
              serviceTypes={serviceTypes}
              initialItems={items.map((i) => ({ id: i.id, weightKg: Number(i.weight_kg) }))}
              translations={t}
              locale={locale}
              onConfirmed={handleOrderConfirmed}
            />
          </div>
        )}

        {/* Step: confirmed */}
        {step === "confirmed" && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center space-y-5">
            <div className="mx-auto w-20 h-20 bg-brand-500 rounded-full flex items-center justify-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="text-2xl font-black text-gray-900">{t["customer.thank_you"]}</h2>
            <p className="text-gray-500">{t["customer.order_confirmed"]}</p>
            <div className="inline-block bg-brand-50 border-2 border-brand-200 rounded-2xl px-6 py-3">
              <span className="text-3xl font-black text-brand-700">{order.order_number}</span>
            </div>
            <div className="text-xl font-bold text-gray-900">{t["customer.total"]}: {formatCurrency(total, locale)}</div>
          </div>
        )}

        {/* Step: cancelled */}
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
    </div>
  );
}
