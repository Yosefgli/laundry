import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";

export default async function ServicesPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: services } = await supabase
    .from("service_types")
    .select("*")
    .order("display_order");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Service Types</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Code</th>
                <th className="text-left px-4 py-2 font-semibold">Order</th>
                <th className="text-left px-4 py-2 font-semibold">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(services ?? []).map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-mono">{s.code}</td>
                  <td className="px-4 py-2">{s.display_order}</td>
                  <td className="px-4 py-2">{s.is_active ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Service types are managed via database migrations. Contact your administrator to add new services.
        </p>
      </main>
    </div>
  );
}
