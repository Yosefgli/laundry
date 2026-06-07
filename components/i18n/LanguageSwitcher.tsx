"use client";

import { Globe2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  I18N_COOKIE,
  LANGUAGE_LABELS,
  LOCALES,
  type Locale,
  type TranslationMap,
} from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LanguageSwitcherProps {
  locale: Locale;
  translations: TranslationMap;
}

export function LanguageSwitcher({ locale, translations: t }: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function changeLocale(nextLocale: Locale) {
    const cookiePath = pathname.startsWith("/customer")
      ? "/customer"
      : pathname.startsWith("/employee")
        ? "/employee"
        : "/";
    document.cookie = `${I18N_COOKIE}=${nextLocale}; path=${cookiePath}; max-age=31536000; SameSite=Lax`;

    const params = new URLSearchParams(searchParams.toString());
    params.delete("locale");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
    router.refresh();
  }

  return (
    <div className="fixed bottom-4 end-4 z-40 print:hidden">
      <div className="flex items-center gap-1 rounded-lg border bg-white/95 p-1 shadow-sm backdrop-blur">
        <div
          className="flex h-8 w-8 items-center justify-center text-gray-500"
          title={t["common.language"]}
          aria-hidden="true"
        >
          <Globe2 className="h-4 w-4" />
        </div>
        {LOCALES.map((loc) => (
          <button
            key={loc}
            type="button"
            title={LANGUAGE_LABELS[loc]}
            aria-pressed={locale === loc}
            onClick={() => changeLocale(loc)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-semibold transition-colors",
              locale === loc
                ? "bg-brand-600 text-white"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
