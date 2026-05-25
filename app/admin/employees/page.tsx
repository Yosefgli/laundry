import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { EmployeesManager } from "@/components/admin/EmployeesManager";

export default async function EmployeesPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { locale, translations: t } = await getI18n();

  const { data: employees } = await supabase
    .from("employees")
    .select("id, user_id, full_name, role, is_active, email, created_at")
    .order("full_name");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.employees_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← {t["nav.back_admin"]}
        </Link>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <EmployeesManager
          employees={employees ?? []}
          translations={t}
          locale={locale}
        />
      </main>
    </div>
  );
}
