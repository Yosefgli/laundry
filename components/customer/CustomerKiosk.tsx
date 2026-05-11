"use client";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CustomerInfoForm } from "@/components/customer/CustomerInfoForm";
import { ServiceSelector } from "@/components/customer/ServiceSelector";
import { DegradedModeBanner, ReconnectingBanner } from "@/components/ui/DegradedModeBanner";
import { useSessionChannel } from "@/hooks/useSessionChannel";
import { SessionEvent } from "@/lib/realtime/events";
import { formatCurrency, isRTL, type Locale } from "@/lib/i18n";
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

  function handleInfoSubmitted() {
    publish(SessionEvent.CUSTOMER_INFO_SUBMITTED, { sessionId });
    setStep("services");
  }

  function handleOrderConfirmed(finalTotal: number) {
    setTotal(finalTotal);
    publish(SessionEvent.ORDER_CONFIRMED, { orderId: order.id, total: finalTotal });
    void fetch(`/api/sessions/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    })
      .then(() => {
        publish(SessionEvent.SESSION_COMPLETED, { sessionId, orderId: order.id });
      })
      .catch(() => undefined);
    setStep("confirmed");
  }

  const items = order.order_items ?? [];

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      {connState === "reconnecting" && <ReconnectingBanner message={t["common.reconnecting"]} />}
      {connState === "degraded"     && <DegradedModeBanner message={t["common.degraded_mode"]} />}

      {/* Kiosk header */}
      <header className="bg-brand-600 text-white px-6 py-4">
        <div className="max-w-lg mx-auto">
          <h1 className="font-bold text-lg">{t["customer.welcome"]}</h1>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {/* Progress indicator */}
        {step !== "cancelled" && step !== "confirmed" && (
          <div className="flex gap-1">
            {(["info", "services"] as const).map((s) => (
              <div
                key={s}
                className={`flex-1 h-1.5 rounded-full ${
                  step === s || (s === "info" && step === "services")
                    ? "bg-brand-600"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
        )}

        {/* Step: customer info */}
        {step === "info" && (
          <div className="bg-white rounded-xl border p-6 space-y-4">
            <h2 className="text-xl font-bold">{t["customer.your_name"]}</h2>
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
            <h2 className="text-xl font-bold">{t["customer.select_services"]}</h2>
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
          <div className="bg-white rounded-xl border p-8 text-center space-y-4">
            <div className="text-5xl">✓</div>
            <h2 className="text-2xl font-bold text-green-600">{t["customer.thank_you"]}</h2>
            <p className="text-gray-600">{t["customer.order_confirmed"]}</p>
            <div className="text-3xl font-black text-brand-700">
              {order.order_number}
            </div>
            <div className="text-xl font-bold">{t["customer.total"]}: {formatCurrency(total, locale)}</div>
          </div>
        )}

        {/* Step: cancelled */}
        {step === "cancelled" && (
          <div className="bg-white rounded-xl border p-8 text-center space-y-4">
            <div className="text-5xl">✗</div>
            <h2 className="text-2xl font-bold text-red-600">{t["status.cancelled"]}</h2>
            <p className="text-gray-500 text-sm">{t["customer.cancelled_help"]}</p>
          </div>
        )}
      </main>
    </div>
  );
}
