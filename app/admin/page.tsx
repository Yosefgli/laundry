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
    <div className="min-h-screen bg-[#f8fefe]">
      <header className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 text-white">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <svg width="22" height="22" viewBox="0 0 52 52" fill="none">
              <circle cx="7" cy="7" r="5" stroke="white" strokeWidth="1.8" fill="none"/>
              <circle cx="3" cy="16" r="3.5" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="15" cy="3" r="3" stroke="white" strokeWidth="1.5" fill="none"/>
              <circle cx="4" cy="24" r="2" stroke="white" strokeWidth="1.2" fill="none"/>
              <rect x="14" y="10" width="34" height="38" rx="5" stroke="white" strokeWidth="2.5" fill="none"/>
              <rect x="14" y="10" width="34" height="10" rx="5" fill="white" fillOpacity="0.25"/>
              <circle cx="40" cy="15" r="2" fill="white"/>
              <circle cx="45" cy="15" r="2" fill="white"/>
              <circle cx="31" cy="34" r="11" stroke="white" strokeWidth="2.5" fill="none"/>
              <path d="M25 31 Q31 27 37 31" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="text-xl font-black leading-none">Laundry</div>
            <div className="text-xs text-white/55 font-light leading-tight">By Chabad</div>
            <p className="text-xs text-white/70 mt-0.5">{t["admin.title"]}</p>
          </div>
        </div>
        <Link href="/employee" className="text-sm text-white/80 hover:text-white font-medium transition-colors">← {t["nav.back_employee"]}</Link>
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
          <AdminNavCard href="/admin/printers" title="מדפסות" desc="הגדר מדפסות ושייך לעובדים" />
          <AdminNavCard href="/admin/employees" title={t["admin.employees"]} desc={t["admin.employees_desc"]} />
          <AdminNavCard href="/admin/settings" title={t["admin.settings"]} desc={t["admin.settings_desc"]} />
          <AdminNavCard href="/admin/translations" title={t["admin.translations"]} desc={t["admin.translations_desc"]} />
          <AdminNavCard href="/admin/audit" title={t["admin.audit"]} desc={t["admin.audit_desc"]} />
          <AdminNavCard href="/admin/payments" title="תשלומים" desc="צפה בתשלומי Webhook, ערוך ועבד מחדש" />
          <AdminNavCard href="/admin/reports" title={t["admin.reports"]} desc={t["admin.reports_desc"]} />
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function AdminNavCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link href={href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:border-brand-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 block">
      <h3 className="font-bold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{desc}</p>
    </Link>
  );
}
