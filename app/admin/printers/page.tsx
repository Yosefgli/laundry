import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { PrinterManager } from "@/components/admin/PrinterManager";
import { getI18n } from "@/lib/i18n/server";

export default async function PrintersPage() {
  await requireAdmin();
  const supabase = createServiceClient();
  const { translations: t } = await getI18n();

  const [{ data: printers }, { data: employees }] = await Promise.all([
    supabase
      .from("printers")
      .select("id, name, ip_address, is_active, printer_employees(employee_id)")
      .order("name"),
    supabase
      .from("employees")
      .select("id, full_name, is_active")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">מדפסות</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {t["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <PrinterManager
          printers={(printers ?? []).map((p) => ({
            ...p,
            employee_ids: ((p.printer_employees ?? []) as Array<{ employee_id: string }>).map((pe) => pe.employee_id),
          }))}
          employees={employees ?? []}
        />
      </main>
    </div>
  );
}
