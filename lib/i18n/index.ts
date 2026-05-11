export type Locale = "en" | "he" | "my";

export const LOCALES: Locale[] = ["en", "he", "my"];

export const RTL_LOCALES: Locale[] = ["he"];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

export type TranslationMap = Record<string, string>;

/** Client-side t() — receives pre-loaded map from server. */
export function makeTranslator(map: TranslationMap) {
  return function t(key: string, fallback?: string): string {
    return map[key] ?? fallback ?? key;
  };
}

/** Format currency using locale-aware formatter. */
export function formatCurrency(amount: number, locale: Locale): string {
  const localeCode = locale === "he" ? "he-IL" : locale === "my" ? "my-MM" : "en-US";
  const currency   = locale === "he" ? "ILS"   : locale === "my" ? "MMK"   : "USD";

  return new Intl.NumberFormat(localeCode, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format weight with locale-aware decimal separator. */
export function formatWeight(kg: number, locale: Locale): string {
  const localeCode = locale === "he" ? "he-IL" : "en-US";
  return new Intl.NumberFormat(localeCode, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 3,
  }).format(kg) + " kg";
}
