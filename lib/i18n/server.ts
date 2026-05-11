import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/supabase/server";
import {
  DEFAULT_LOCALE,
  I18N_COOKIE,
  isRTL,
  mergeTranslations,
  normalizeLocale,
  type Locale,
  type TranslationMap,
} from "@/lib/i18n";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = normalizeLocale(cookieStore.get(I18N_COOKIE)?.value);
  if (cookieStore.has(I18N_COOKIE)) return cookieLocale;

  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", "default_locale")
      .single();
    return normalizeLocale(data?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

export async function getServerTranslations(locale: Locale): Promise<TranslationMap> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("translations")
      .select("key, value")
      .eq("locale", locale);
    const dbTranslations = Object.fromEntries((data ?? []).map((row) => [row.key, row.value]));
    return mergeTranslations(locale, dbTranslations);
  } catch {
    return mergeTranslations(locale);
  }
}

export async function getI18n() {
  const locale = await getRequestLocale();
  const translations = await getServerTranslations(locale);
  return {
    locale,
    translations,
    dir: isRTL(locale) ? "rtl" : "ltr",
  };
}
