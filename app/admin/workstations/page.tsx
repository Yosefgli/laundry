import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { WorkstationManager } from "@/components/admin/WorkstationManager";
import { getI18n } from "@/lib/i18n/server";

export default async function WorkstationsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { translations } = await getI18n();

  const { data: workstations } = await supabase
    .from("workstations")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{translations["admin.workstations_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {translations["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <WorkstationManager workstations={workstations ?? []} translations={translations} />
      </main>
    </div>
  );
}
