import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AuditLogPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: emp } = await supabase.from("employees").select("role").eq("user_id", user.id).single();
  if (emp?.role !== "admin") redirect("/employee");

  const { data: logs } = await supabase
    .from("audit_logs")
    .select(`
      id, action, entity_type, entity_id, new_values, old_values, created_at,
      employee:employees(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Audit Log</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Time</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Action</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Entity</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Employee</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(logs ?? []).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                  <td className="px-4 py-2 text-xs">
                    {log.entity_type}
                    {log.entity_id && (
                      <span className="text-gray-400 ml-1">{log.entity_id.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {(log.employee as { full_name?: string } | null)?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">
                    {log.new_values ? JSON.stringify(log.new_values) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
