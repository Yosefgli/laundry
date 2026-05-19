"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, isRTL, type Locale, type TranslationMap } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { CustomerKiosk } from "@/components/customer/CustomerKiosk";
import {
  customerDeviceChannelName,
  SessionEvent,
  type BroadcastEnvelope,
  type SessionStartedPayload,
} from "@/lib/realtime/events";
import type { Database } from "@/lib/db/database.types";

type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type ServiceType = Database["public"]["Tables"]["service_types"]["Row"] & {
  pricing_rules?: PricingRule[];
};

interface CustomerPriceDisplayProps {
  customerDeviceId: string;
  serviceTypes: ServiceType[];
  translations: TranslationMap;
  locale: Locale;
}

type ActiveSessionResponse = {
  data: { id: string; customerDeviceId: string } | null;
  error: string | null;
};

function activeRule(service: ServiceType) {
  return service.pricing_rules?.find((rule) => rule.is_active) ?? service.pricing_rules?.[0] ?? null;
}

export function CustomerPriceDisplay({
  customerDeviceId,
  serviceTypes,
  translations: t,
  locale,
}: CustomerPriceDisplayProps) {
  const router = useRouter();
  const dir = isRTL(locale) ? "rtl" : "ltr";
  const openedSessionRef = useRef<string | null>(null);
  const [activeSession, setActiveSession] = useState<SessionStartedPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    function openSession(session: SessionStartedPayload, deviceId = customerDeviceId) {
      const sessionId = session.sessionId;
      if (cancelled || openedSessionRef.current === sessionId) return;
      openedSessionRef.current = sessionId;

      if (session.orderNumber && session.totalWeightKg !== undefined) {
        setActiveSession(session);
        return;
      }

      router.replace(`/customer/${sessionId}?device=${encodeURIComponent(deviceId)}`);
    }

    const channel = supabase
      .channel(customerDeviceChannelName(customerDeviceId), {
        config: { broadcast: { self: false, ack: true } },
      })
      .on("broadcast", { event: SessionEvent.SESSION_STARTED }, ({ payload }) => {
        const envelope = payload as Partial<BroadcastEnvelope<SessionStartedPayload>>;
        const session = envelope.payload ?? (payload as SessionStartedPayload);
        if (!session?.sessionId) return;
        if (session.customerDeviceId && session.customerDeviceId !== customerDeviceId) return;
        openSession(session, session.customerDeviceId);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sessions",
          filter: `customer_device_id=eq.${customerDeviceId}`,
        },
        (payload) => {
          const session = payload.new as {
            id?: string;
            status?: string;
            customer_device_id?: string | null;
          };
          if (session.status !== "active" || !session.id) return;
          openSession(
            {
              sessionId: session.id,
              orderId: "",
              workflowStep: "customer_info",
              customerDeviceId: session.customer_device_id ?? customerDeviceId,
            },
            session.customer_device_id ?? customerDeviceId
          );
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void checkForSession();
        }
      });

    async function checkForSession() {
      try {
        const res = await fetch("/api/sessions/active", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/auth/login");
          return;
        }

        const json = (await res.json()) as ActiveSessionResponse;
        if (!cancelled && json.data?.id) {
          openSession(
            {
              sessionId: json.data.id,
              orderId: "",
              workflowStep: "customer_info",
              customerDeviceId: json.data.customerDeviceId,
            },
            json.data.customerDeviceId
          );
        }
      } catch {
        // Keep the price list visible if the fallback check fails.
      }
    }

    void checkForSession();
    const interval = window.setInterval(checkForSession, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [customerDeviceId, router]);

  if (activeSession?.orderNumber && activeSession.totalWeightKg !== undefined) {
    return (
      <CustomerKiosk
        sessionId={activeSession.sessionId}
        order={{
          id: activeSession.orderId,
          order_number: activeSession.orderNumber,
          status: "weighed",
          total_weight_kg: activeSession.totalWeightKg,
          order_items: [{ id: "bag-0", weight_kg: activeSession.totalWeightKg }],
        }}
        serviceTypes={serviceTypes}
        translations={t}
        locale={locale}
        onReturnToPriceList={() => {
          openedSessionRef.current = null;
          setActiveSession(null);
        }}
      />
    );
  }

  const activeServices = serviceTypes.filter((service) => service.is_active);

  return (
    <div className="min-h-screen bg-[#f8fefe]" dir={dir}>
      <header className="bg-gradient-to-br from-brand-500 to-brand-700 px-6 py-8 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <svg width="32" height="32" viewBox="0 0 44 44" fill="none">
                <rect x="4" y="8" width="36" height="32" rx="4" stroke="white" strokeWidth="2.5" fill="none"/>
                <rect x="4" y="8" width="36" height="9" rx="4" fill="white" fillOpacity="0.25"/>
                <circle cx="32" cy="12.5" r="2" fill="white"/>
                <circle cx="37" cy="12.5" r="2" fill="white"/>
                <circle cx="22" cy="28" r="10" stroke="white" strokeWidth="2.5" fill="none"/>
                <circle cx="7" cy="4" r="2" fill="white" fillOpacity="0.7"/>
                <circle cx="3" cy="8" r="1.5" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white/70">Laundry <span className="font-light">by Chabad</span></p>
              <h1 className="text-3xl font-black">{t["customer.price_list_title"]}</h1>
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm border border-white/20">
            {t["customer.price_list_ready"]}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {activeServices.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-400 shadow-sm">
            {t["customer.no_prices"]}
          </div>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2">
            {activeServices.map((service) => {
              const rule = activeRule(service);
              const flatFee = Number(rule?.flat_fee ?? 0);
              const minimumCharge = Number(rule?.minimum_charge ?? 0);

              return (
                <article key={service.id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm hover:shadow-md hover:border-brand-200 transition-all duration-150">
                  <h2 className="text-lg font-bold text-gray-900">
                    {t[`service.${service.code}`] ?? service.code}
                  </h2>

                  {rule ? (
                    <>
                      <div className="mt-4 flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-gray-500">
                          {t["customer.price_per_kg"]}
                        </span>
                        <span className="whitespace-nowrap text-2xl font-black text-brand-600">
                          {formatCurrency(Number(rule.price_per_kg), locale)}
                        </span>
                      </div>

                      {(flatFee > 0 || minimumCharge > 0) && (
                        <div className="mt-3 space-y-1 text-sm text-gray-500 border-t border-gray-50 pt-3">
                          {flatFee > 0 && (
                            <div className="flex justify-between gap-3">
                              <span>{t["customer.flat_fee"]}</span>
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(flatFee, locale)}
                              </span>
                            </div>
                          )}
                          {minimumCharge > 0 && (
                            <div className="flex justify-between gap-3">
                              <span>{t["customer.minimum_charge"]}</span>
                              <span className="font-semibold text-gray-700">
                                {formatCurrency(minimumCharge, locale)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-gray-400">{t["common.not_available"]}</p>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
