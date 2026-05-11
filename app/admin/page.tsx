import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { formatCurrency } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

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

  const [{ locale, translations: t }, stats] = await Promise.all([getI18n(), getStats()]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">{t["admin.title"]}</h1>
        <Link href="/employee" className="text-sm text-brand-600 hover:underline">← {t["nav.back_employee"]}</Link>
      </header>

      <main className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label={t["admin.orders_today"]} value={stats.ordersToday} />
          <StatCard label={t["admin.revenue_today"]} value={formatCurrency(stats.revenueToday, locale)} />
          <StatCard label={t["admin.active_orders"]} value={stats.activeOrders} />
        </div>

        {/* Navigation */}
        <div className="grid grid-cols-2 gap-4">
          <AdminNavCard href="/admin/orders" title={t["admin.orders"]} desc={t["admin.orders_desc"]} />
          <AdminNavCard href="/admin/pricing" title={t["admin.pricing"]} desc={t["admin.pricing_desc"]} />
          <AdminNavCard href="/admin/services" title={t["admin.services"]} desc={t["admin.services_desc"]} />
          <AdminNavCard href="/admin/workstations" title={t["admin.workstations"]} desc={t["admin.workstations_desc"]} />
          <AdminNavCard href="/admin/employees" title={t["admin.employees"]} desc={t["admin.employees_desc"]} />
          <AdminNavCard href="/admin/settings" title={t["admin.settings"]} desc={t["admin.settings_desc"]} />
          <AdminNavCard href="/admin/translations" title={t["admin.translations"]} desc={t["admin.translations_desc"]} />
          <AdminNavCard href="/admin/audit" title={t["admin.audit"]} desc={t["admin.audit_desc"]} />
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
