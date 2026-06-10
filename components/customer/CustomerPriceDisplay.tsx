"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CustomerInfoForm } from "@/components/customer/CustomerInfoForm";
import { formatCurrency, formatWeight, isRTL, type Locale, type TranslationMap } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import {
  channelName,
  customerDeviceChannelName,
  makeEnvelope,
  SessionEvent,
  type BroadcastEnvelope,
  type SessionStartedPayload,
} from "@/lib/realtime/events";
import type { Database } from "@/lib/db/database.types";
import type { CustomerInfoInput } from "@/lib/schemas/order";

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
  data: {
    id: string;
    customerDeviceId: string;
    order: {
      id: string;
      orderNumber: string;
      totalWeightKg: number;
    } | null;
  } | null;
  error: string | null;
};

type CustomerHandoff = SessionStartedPayload & {
  customerDeviceId: string;
};

const SESSION_READY_RETRY_ATTEMPTS = 50;
const SESSION_READY_RETRY_MS = 200;
const HANDOFF_BROADCAST_TIMEOUT_MS = 1500;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getOrCreateInstanceId(): string {
  try {
    const key = "customerInstanceId";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function activeRule(service: ServiceType) {
  return service.pricing_rules?.find((rule) => rule.is_active) ?? service.pricing_rules?.[0] ?? null;
}

interface PendingCustomerHandoffProps {
  handoff: CustomerHandoff;
  translations: TranslationMap;
  locale: Locale;
  onSessionReady: (sessionId: string) => Promise<boolean>;
  onNavigate: (sessionId: string, deviceId: string) => boolean;
}

function PendingCustomerHandoff({
  handoff,
  translations: t,
  locale,
  onSessionReady,
  onNavigate,
}: PendingCustomerHandoffProps) {
  const dir = isRTL(locale) ? "rtl" : "ltr";
  const [submitted, setSubmitted] = useState(false);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(handoff.isReady === true);

  useEffect(() => {
    let cancelled = false;

    if (handoff.isReady === true) {
      setSessionReady(true);
      setReadyError(null);
      return;
    }

    setSessionReady(false);
    setReadyError(null);

    async function prepareSession() {
      while (!cancelled) {
        const ready = await onSessionReady(handoff.sessionId);
        if (cancelled) return;

        if (ready) {
          setSessionReady(true);
          setReadyError(null);
          return;
        }

        setReadyError(t["common.reconnecting"] ?? t["common.error"]);
        await wait(SESSION_READY_RETRY_MS);
      }
    }

    void prepareSession();

    return () => {
      cancelled = true;
    };
  }, [handoff.isReady, handoff.sessionId, onSessionReady, t]);

  async function publishCustomerInfoEvents(info: CustomerInfoInput) {
    const supabase = createClient();
    const channel = supabase.channel(channelName(handoff.sessionId), {
      config: { broadcast: { self: false, ack: true } },
    });

    await channel
      .httpSend(
        SessionEvent.CUSTOMER_INFO_SUBMITTED,
        makeEnvelope(SessionEvent.CUSTOMER_INFO_SUBMITTED, { sessionId: handoff.sessionId, ...info }),
        { timeout: HANDOFF_BROADCAST_TIMEOUT_MS }
      )
      .catch(() => ({ success: false as const }));

    await channel
      .httpSend(
        SessionEvent.WORKFLOW_STEP_CHANGED,
        makeEnvelope(SessionEvent.WORKFLOW_STEP_CHANGED, {
          step: "bag_service_selection",
          orderId: handoff.orderId,
        }),
        { timeout: HANDOFF_BROADCAST_TIMEOUT_MS }
      )
      .catch(() => ({ success: false as const }));

    await supabase.removeChannel(channel);
  }

  async function handleInfoSubmitted(info: CustomerInfoInput) {
    setReadyError(null);

    const ready = sessionReady || await onSessionReady(handoff.sessionId);
    if (!ready) {
      setReadyError(t["common.reconnecting"] ?? t["common.error"]);
      return;
    }

    setSessionReady(true);
    setSubmitted(true);
    await publishCustomerInfoEvents(info);
    onNavigate(handoff.sessionId, handoff.customerDeviceId);
  }

  return (
    <div className="min-h-screen bg-[#f8fefe]" dir={dir}>
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
            <h1 className="font-black text-sm leading-none">Laundry POS</h1>
            <p className="text-white/50 font-light text-xs leading-none">by Chabad</p>
            <p className="text-white/70 text-xs mt-0.5">{t["customer.welcome"]}</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-6 space-y-6">
        {handoff.totalWeightKg !== undefined && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-5">
            <div className="text-sm font-semibold text-brand-600 mb-1">
              {t["employee.weight_kg"]}
            </div>
            <div className="text-2xl font-black text-gray-900">
              {formatWeight(handoff.totalWeightKg, locale, t["unit.kg"])}
            </div>
          </div>
        )}

        {submitted ? (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-10 text-center space-y-4">
            <div className="mx-auto w-10 h-10 rounded-full border-4 border-brand-200 border-t-brand-600 animate-spin" />
            <p className="text-gray-400 text-sm">{t["common.loading"]}</p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-7 space-y-5">
            <h2 className="text-xl font-bold text-gray-900">{t["customer.your_name"]}</h2>
            {readyError && <p className="text-sm text-red-600">{readyError}</p>}
            <CustomerInfoForm
              orderId={handoff.orderId}
              translations={t}
              locale={locale}
              onSubmitted={handleInfoSubmitted}
              disabled={!sessionReady}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export function CustomerPriceDisplay({
  customerDeviceId,
  serviceTypes,
  translations: t,
  locale,
}: CustomerPriceDisplayProps) {
  const router = useRouter();
  const dir = isRTL(locale) ? "rtl" : "ltr";
  // Tracks whether this tab is the "primary" instance among all tabs/devices
  // sharing the same customerDeviceId. Last-joined wins via presence timestamps.
  const isPrimaryRef = useRef<boolean>(true);
  const navigatedRef = useRef<boolean>(false);
  const activeSessionCheckInFlightRef = useRef(false);
  const [pendingHandoff, setPendingHandoff] = useState<CustomerHandoff | null>(null);
  const pendingHandoffRef = useRef<CustomerHandoff | null>(null);

  useEffect(() => {
    pendingHandoffRef.current = pendingHandoff;
  }, [pendingHandoff]);

  const navigateToSession = useCallback(
    (sessionId: string, deviceId: string) => {
      if (!isPrimaryRef.current || navigatedRef.current) return false;
      navigatedRef.current = true;
      const params = new URLSearchParams({ device: deviceId });
      router.replace(`/customer/${sessionId}?${params.toString()}`);
      return true;
    },
    [router]
  );

  const waitForSessionReady = useCallback(
    async (sessionId: string) => {
      for (let attempt = 1; attempt <= SESSION_READY_RETRY_ATTEMPTS; attempt += 1) {
        const res = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/auth/login");
          return false;
        }
        if (res.ok) return true;
        if (attempt < SESSION_READY_RETRY_ATTEMPTS) await wait(SESSION_READY_RETRY_MS);
      }

      return false;
    },
    [router]
  );

  useEffect(() => {
    const instanceId = getOrCreateInstanceId();
    const myJoinedAt = Date.now();
    let cancelled = false;
    const supabase = createClient();

    function mergePendingHandoff(session: SessionStartedPayload) {
      const handoff = {
        ...session,
        customerDeviceId: session.customerDeviceId ?? customerDeviceId,
      };
      setPendingHandoff((current) => {
        if (current?.sessionId !== handoff.sessionId) return handoff;
        return {
          ...current,
          ...handoff,
          isReady: current.isReady === true ? true : handoff.isReady,
        };
      });
    }

    async function checkForSession() {
      if (!isPrimaryRef.current) return;
      if (activeSessionCheckInFlightRef.current) return;
      activeSessionCheckInFlightRef.current = true;
      try {
        const res = await fetch("/api/sessions/active?target=customer", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/auth/login");
          return;
        }
        const json = (await res.json()) as ActiveSessionResponse;
        if (json.data?.id) {
          const activeDeviceId = json.data.customerDeviceId ?? customerDeviceId;
          const pending = pendingHandoffRef.current;
          if (pending?.sessionId === json.data.id) {
            setPendingHandoff((current) =>
              current
                ? {
                    ...current,
                    isReady: true,
                    customerDeviceId: activeDeviceId,
                    orderNumber: json.data?.order?.orderNumber ?? current.orderNumber,
                    totalWeightKg: json.data?.order?.totalWeightKg ?? current.totalWeightKg,
                  }
                : current
            );
            return;
          }
          if (!cancelled) navigateToSession(json.data.id, activeDeviceId);
        }
      } catch {
        // Keep the price list visible if the fallback check fails.
      } finally {
        activeSessionCheckInFlightRef.current = false;
      }
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

        if (session.isReady === false) {
          mergePendingHandoff(session);
          return;
        }

        const pending = pendingHandoffRef.current;
        if (pending?.sessionId === session.sessionId) {
          mergePendingHandoff({ ...session, isReady: true });
          return;
        }

        if (!cancelled) navigateToSession(session.sessionId, session.customerDeviceId ?? customerDeviceId);
      })
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ instanceId: string; joinedAt: number }>();
        const allInstances = Object.values(state).flat();
        // Primary = the instance with the highest joinedAt (most recently connected).
        // Tiebreak by instanceId string comparison so exactly one tab is primary.
        const isPrimary = !allInstances.some(
          (p) =>
            p.joinedAt > myJoinedAt ||
            (p.joinedAt === myJoinedAt && p.instanceId > instanceId)
        );
        isPrimaryRef.current = isPrimary;
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ instanceId, joinedAt: myJoinedAt });
          void checkForSession();
        }
      });

    void checkForSession();
    const interval = window.setInterval(checkForSession, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [customerDeviceId, navigateToSession, router]);

  const activeServices = serviceTypes.filter((service) => service.is_active);

  if (pendingHandoff) {
    return (
      <PendingCustomerHandoff
        handoff={pendingHandoff}
        translations={t}
        locale={locale}
        onSessionReady={waitForSessionReady}
        onNavigate={navigateToSession}
      />
    );
  }

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
              <h1 className="text-3xl font-black">{t["customer.price_list_title"]}</h1>
              <p className="text-xs font-light text-white/50 mt-0.5">Laundry by Chabad</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white/15 px-4 py-2.5 text-sm font-semibold backdrop-blur-sm border border-white/20">
            {t["customer.price_list_ready"]}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        {/* Instruction banner */}
        <div className="flex items-start gap-3 rounded-2xl bg-brand-50 border border-brand-200 px-5 py-4">
          <div className="mt-0.5 w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 8v4m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-brand-800 leading-snug">
            {t["customer.approach_laundress"] ?? "לתחילת התהליך אנא פנה לכובסת לשקילה"}
          </p>
        </div>

        {activeServices.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center text-gray-400 shadow-sm">
            {t["customer.no_prices"]}
          </div>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2">
            {activeServices.map((service) => {
              const rule = activeRule(service);
              const flatFee = Number(rule?.flat_fee ?? 0);
              const minimumCharge = Number(rule?.minimum_charge ?? 0);

              return (
                <div key={service.id} className="rounded-2xl border border-gray-100 bg-white px-5 py-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 shrink-0" />
                    <h2 className="text-base font-bold text-gray-800">
                      {t[`service.${service.code}`] ?? service.code}
                    </h2>
                  </div>

                  {rule ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="flex items-baseline justify-between gap-3 border-b border-gray-50 pb-2">
                        <span className="text-gray-500">{t["customer.price_per_kg"]}</span>
                        <span className="font-black text-xl text-brand-600 whitespace-nowrap">
                          {formatCurrency(Number(rule.price_per_kg), locale)}
                        </span>
                      </div>
                      {flatFee > 0 && (
                        <div className="flex justify-between gap-3 text-gray-500">
                          <span>{t["customer.flat_fee"]}</span>
                          <span className="font-semibold text-gray-700">{formatCurrency(flatFee, locale)}</span>
                        </div>
                      )}
                      {minimumCharge > 0 && (
                        <div className="flex justify-between gap-3 text-gray-500">
                          <span>{t["customer.minimum_charge"]}</span>
                          <span className="font-semibold text-gray-700">{formatCurrency(minimumCharge, locale)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">{t["common.not_available"]}</p>
                  )}
                </div>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}
