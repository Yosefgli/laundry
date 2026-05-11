import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { TranslationsManager } from "@/components/admin/TranslationsManager";
import { FALLBACK_TRANSLATIONS, LOCALES } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export default async function TranslationsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { translations: uiTranslations } = await getI18n();

  const { data: translations } = await supabase
    .from("translations")
    .select("*")
    .order("key")
    .order("locale");

  const rows = [...(translations ?? [])];
  const existing = new Set(rows.map((row) => `${row.key}::${row.locale}`));
  const fallbackKeys = new Set(
    LOCALES.flatMap((locale) => Object.keys(FALLBACK_TRANSLATIONS[locale]))
  );

  for (const key of fallbackKeys) {
    for (const locale of LOCALES) {
      const rowKey = `${key}::${locale}`;
      if (existing.has(rowKey)) continue;
      rows.push({
        id: "",
        key,
        locale,
        value: FALLBACK_TRANSLATIONS[locale][key] ?? FALLBACK_TRANSLATIONS.en[key] ?? "",
        created_at: "",
        updated_at: "",
      });
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{uiTranslations["admin.translations_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {uiTranslations["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <TranslationsManager translations={rows} uiTranslations={uiTranslations} />
      </main>
    </div>
  );
}
