import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function EmployeesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: emp } = await supabase.from("employees").select("role").eq("user_id", user.id).single();
  if (emp?.role !== "admin") redirect("/employee");

  const { data: employees } = await supabase
    .from("employees")
    .select("id, full_name, role, is_active, created_at")
    .order("full_name");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Employees</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <div className="bg-white rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold">Name</th>
                <th className="text-left px-4 py-2 font-semibold">Role</th>
                <th className="text-left px-4 py-2 font-semibold">Active</th>
                <th className="text-left px-4 py-2 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(employees ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 font-medium">{e.full_name}</td>
                  <td className="px-4 py-2 capitalize">{e.role}</td>
                  <td className="px-4 py-2">{e.is_active ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(e.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Employees are created when users sign up via Supabase Auth with a full_name in metadata.
        </p>
      </main>
    </div>
  );
}
