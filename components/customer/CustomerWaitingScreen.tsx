"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TranslationMap } from "@/lib/i18n";

interface CustomerWaitingScreenProps {
  employeeName: string;
  translations: TranslationMap;
}

type ActiveSessionResponse = {
  data: { id: string; customerDeviceId: string } | null;
  error: string | null;
};

export function CustomerWaitingScreen({ employeeName, translations: t }: CustomerWaitingScreenProps) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

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
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void checkForSession();
    const interval = window.setInterval(checkForSession, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center text-center">
        <div className="w-full rounded-xl border bg-white p-8 shadow-sm">
          <div className="mx-auto mb-5 h-12 w-12 rounded-full border-4 border-brand-100 border-t-brand-600 animate-spin" />
          <h1 className="text-2xl font-bold text-gray-900">{t["customer.waiting_title"]}</h1>
          <p className="mt-2 text-sm text-gray-500">{t["customer.waiting_subtitle"]}</p>
          <p className="mt-5 text-xs text-gray-400">
            {t["customer.signed_in_as"]}: {employeeName}
          </p>
          {checking && <span className="sr-only">{t["common.loading"]}</span>}
        </div>
      </main>
    </div>
  );
}
