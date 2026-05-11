"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, isRTL, type Locale, type TranslationMap } from "@/lib/i18n";
import type { Database } from "@/lib/db/database.types";

type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
type ServiceType = Database["public"]["Tables"]["service_types"]["Row"] & {
  pricing_rules?: PricingRule[];
};

interface CustomerPriceDisplayProps {
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
  serviceTypes,
  translations: t,
  locale,
}: CustomerPriceDisplayProps) {
  const router = useRouter();
  const dir = isRTL(locale) ? "rtl" : "ltr";

  useEffect(() => {
    let cancelled = false;

    async function checkForSession() {
      try {
        const res = await fetch("/api/sessions/active", { cache: "no-store" });
        if (res.status === 401) {
          router.replace("/auth/login");
          return;
        }

        const json = (await res.json()) as ActiveSessionResponse;
        if (!cancelled && json.data?.id) {
          router.replace(`/customer/${json.data.id}?device=${encodeURIComponent(json.data.customerDeviceId)}`);
        }
      } catch {
        // Keep the price list visible if the short polling check fails.
      }
    }

    void checkForSession();
    const interval = window.setInterval(checkForSession, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  const activeServices = serviceTypes.filter((service) => service.is_active);

  return (
    <div className="min-h-screen bg-gray-50" dir={dir}>
      <header className="bg-brand-600 px-6 py-5 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white/75">Laundry Ops</p>
            <h1 className="text-3xl font-black">{t["customer.price_list_title"]}</h1>
          </div>
          <div className="rounded-lg bg-white/15 px-3 py-2 text-sm font-semibold">
            {t["customer.price_list_ready"]}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {activeServices.length === 0 ? (
          <div className="rounded-xl border bg-white p-8 text-center text-gray-500">
            {t["customer.no_prices"]}
          </div>
        ) : (
          <section className="grid gap-3 sm:grid-cols-2">
            {activeServices.map((service) => {
              const rule = activeRule(service);
              const flatFee = Number(rule?.flat_fee ?? 0);
              const minimumCharge = Number(rule?.minimum_charge ?? 0);

              return (
                <article key={service.id} className="rounded-xl border bg-white p-5 shadow-sm">
                  <h2 className="text-lg font-bold text-gray-900">
                    {t[`service.${service.code}`] ?? service.code}
                  </h2>

                  {rule ? (
                    <>
                      <div className="mt-4 flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium text-gray-500">
                          {t["customer.price_per_kg"]}
                        </span>
                        <span className="whitespace-nowrap text-2xl font-black text-brand-700">
                          {formatCurrency(Number(rule.price_per_kg), locale)}
                        </span>
                      </div>

                      {(flatFee > 0 || minimumCharge > 0) && (
                        <div className="mt-3 space-y-1 text-sm text-gray-500">
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
                    <p className="mt-4 text-sm text-gray-500">{t["common.not_available"]}</p>
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
