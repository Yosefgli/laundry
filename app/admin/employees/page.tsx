import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { localeToIntl } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export default async function EmployeesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { locale, translations: t } = await getI18n();
  const intlLocale = localeToIntl(locale);

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.employees_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {t["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">{t["common.name"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["common.role"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["common.active"]}</th>
                <th className="text-left px-4 py-2 font-semibold">{t["common.joined"]}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(employees ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-medium">{e.full_name}</td>
                  <td className="px-4 py-2 capitalize">{e.role === "admin" ? t["nav.admin"] : t["nav.employee"]}</td>
                  <td className="px-4 py-2">{e.is_active ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(e.created_at).toLocaleDateString(intlLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          {t["admin.employees_note"]}
        </p>
      </main>
    </div>
  );
}
