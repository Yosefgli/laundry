import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { WorkstationManager } from "@/components/admin/WorkstationManager";

export default async function WorkstationsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: workstations } = await supabase
    .from("workstations")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Workstations & Printers</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <WorkstationManager workstations={workstations ?? []} />
      </main>
    </div>
  );
}
