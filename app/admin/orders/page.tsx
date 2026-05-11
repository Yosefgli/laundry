import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, localeToIntl } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

async function getOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select(`
      id, order_number, status, payment_status,
      customer_name, customer_phone,
      total_weight_kg, total_amount, created_at,
      employee:employees(full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export default async function AdminOrdersPage() {
  await requireAdmin();
  const [{ locale, translations: t }, orders] = await Promise.all([getI18n(), getOrders()]);
  const intlLocale = localeToIntl(locale);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">{t["admin.orders_title"]}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← {t["nav.back_admin"]}</Link>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["admin.order_number"]}</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.customer"]}</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.status"]}</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.payment"]}</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">{t["common.total"]}</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.created"]}</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">{t["common.employee"]}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium">{order.order_number}</td>
                  <td className="px-4 py-2">{order.customer_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <OrderStatusBadge
                      status={order.status as Parameters<typeof OrderStatusBadge>[0]["status"]}
                      label={t[`status.${order.status}`] ?? order.status}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <PaymentStatusBadge
                      status={order.payment_status as Parameters<typeof PaymentStatusBadge>[0]["status"]}
                      label={t[`payment.${order.payment_status}`] ?? order.payment_status}
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(Number(order.total_amount), locale)}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{new Date(order.created_at).toLocaleString(intlLocale)}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {(order.employee as { full_name?: string } | null)?.full_name ?? "—"}
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
