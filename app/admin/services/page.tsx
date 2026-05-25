import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { ServicesManager } from "@/components/admin/ServicesManager";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { translations: t } = await getI18n();

  // Load service types
  const { data: services } = await supabase
    .from("service_types")
    .select("id, code, display_order, is_active")
    .order("display_order");

  // Load all translation values for service names
  const codes = (services ?? []).map((s) => `service.${s.code}`);
  const { data: transRows } = await supabase
    .from("translations")
    .select("key, locale, value")
    .in("key", codes.length > 0 ? codes : ["__none__"]);

  // Build enriched service rows with name translations merged in
  const translationMap = Object.fromEntries(
    (transRows ?? []).map((r) => [`${r.key}::${r.locale}`, r.value])
  );
  const enrichedServices = (services ?? []).map((s) => ({
    ...s,
    name_en: translationMap[`service.${s.code}::en`] ?? t[`service.${s.code}`] ?? s.code,
    name_he: translationMap[`service.${s.code}::he`] ?? t[`service.${s.code}`] ?? s.code,
    name_my: translationMap[`service.${s.code}::my`] ?? "",
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.services_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← {t["nav.back_admin"]}
        </Link>
      </header>
      <main className="max-w-4xl mx-auto p-6">
        <ServicesManager services={enrichedServices} translations={t} />
      </main>
    </div>
  );
}
