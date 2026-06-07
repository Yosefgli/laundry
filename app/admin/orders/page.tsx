import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { AdminOrdersTable } from "@/components/admin/AdminOrdersTable";
import { getI18n } from "@/lib/i18n/server";

async function getOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id, order_number, status, payment_status,
      customer_name, customer_phone,
      total_weight_kg, total_amount, created_at,
      employee:employees!employee_id(full_name)
    `)
    .order("created_at", { ascending: false });
  if (error) console.error("[AdminOrders] fetch failed:", error.message);
  return data ?? [];
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const [{ locale, translations: t }, orders] = await Promise.all([getI18n(), getOrders()]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.orders_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {t["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-6xl mx-auto p-6">
        <AdminOrdersTable
          orders={orders as Parameters<typeof AdminOrdersTable>[0]["orders"]}
          translations={t}
          locale={locale}
        />
      </main>
    </div>
  );
}
