import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { translations: t } = await getI18n();

  const { data: services } = await supabase
    .from("service_types")
    .select("*")
    .order("display_order");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.services_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {t["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{t["common.name"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["common.code"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["admin.service_order"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["common.active"]}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(services ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{t[`service.${s.code}`] ?? s.code}</td>
                  <td className="px-4 py-2 font-mono">{s.code}</td>
                  <td className="px-4 py-2">{s.display_order}</td>
                  <td className="px-4 py-2">{s.is_active ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          {t["admin.service_types_note"]}
        </p>
      </main>
    </div>
  );
}
