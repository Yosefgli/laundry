import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

async function getAdminEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("user_id", user.id)
    .single();
  return data?.role === "admin" ? data : null;
}

async function getStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [orders, payments] = await Promise.all([
    supabase
      .from("orders")
      .select("id, status, total_amount, created_at")
      .gte("created_at", `${today}T00:00:00Z`),
    supabase
      .from("payments")
      .select("amount")
      .gte("created_at", `${today}T00:00:00Z`),
  ]);

  return {
    ordersToday: orders.data?.length ?? 0,
    revenueToday: payments.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0,
    activeOrders: orders.data?.filter((o) =>
      !["delivered", "void", "cancelled"].includes(o.status)
    ).length ?? 0,
  };
}

export default async function AdminPage() {
  const employee = await getAdminEmployee();
  if (!employee) redirect("/employee");

  const stats = await getStats();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">Admin — Laundry Ops</h1>
        <Link href="/employee" className="text-sm text-brand-600 hover:underline">← Employee</Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Orders Today" value={stats.ordersToday} />
          <StatCard label="Revenue Today" value={`₪${stats.revenueToday.toFixed(2)}`} />
          <StatCard label="Active Orders" value={stats.activeOrders} />
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-4">
          <AdminNavCard href="/admin/orders"    title="Orders"       desc="View and manage all orders" />
          <AdminNavCard href="/admin/pricing"   title="Pricing"      desc="Manage service pricing rules" />
          <AdminNavCard href="/admin/services"  title="Services"     desc="Manage laundry service types" />
          <AdminNavCard href="/admin/workstations" title="Workstations" desc="Configure workstations & printers" />
          <AdminNavCard href="/admin/employees" title="Employees"    desc="Manage employee accounts" />
          <AdminNavCard href="/admin/settings"  title="Settings"     desc="System-wide configuration" />
          <AdminNavCard href="/admin/translations" title="Translations" desc="Manage UI text & languages" />
          <AdminNavCard href="/admin/audit"     title="Audit Log"    desc="View all operational actions" />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function AdminNavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="bg-white rounded-xl border p-5 hover:border-brand-400 hover:shadow-sm transition-all block">
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
