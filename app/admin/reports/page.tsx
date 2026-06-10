import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { getI18n } from "@/lib/i18n/server";
import Link from "next/link";
import { ReportsView } from "@/components/admin/ReportsView";

type SearchParams = {
  dateFrom?: string;
  dateTo?: string;
  service?: string;
  color?: string;
};

async function getReportsData(filters: SearchParams) {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(`
      id, order_number, status, payment_status,
      customer_name, total_weight_kg, total_amount, created_at,
      order_items(
        id, color_type, weight_kg,
        order_item_services(
          service_type:service_types!service_type_id(code)
        )
      )
    `)
    .neq("status", "void")
    .order("created_at", { ascending: false });

  if (filters.dateFrom) {
    query = query.gte("created_at", `${filters.dateFrom}T00:00:00Z`);
  }
  if (filters.dateTo) {
    query = query.lte("created_at", `${filters.dateTo}T23:59:59Z`);
  }

  const { data, error } = await query;
  if (error) console.error("[Reports] fetch failed:", error.message);

  const rows = data ?? [];

  // Client-side filter by service / color after join
  return rows.filter((order) => {
    const items = order.order_items ?? [];

    if (filters.service && filters.service !== "all") {
      const hasService = items.some((item) =>
        (item.order_item_services ?? []).some(
          (s) => (s.service_type as { code: string } | null)?.code === filters.service
        )
      );
      if (!hasService) return false;
    }

    if (filters.color && filters.color !== "all") {
      const hasColor = items.some((item) => item.color_type === filters.color);
      if (!hasColor) return false;
    }

    return true;
  });
}

async function getServiceTypes() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("service_types")
    .select("code")
    .eq("is_active", true)
    .order("display_order");
  return (data ?? []).map((s) => s.code);
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const [{ locale, translations: t }, orders, serviceCodes] = await Promise.all([
    getI18n(),
    getReportsData(params),
    getServiceTypes(),
  ]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-gray-900">{t["admin.reports_title"] ?? "דוחות"}</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:text-brand-700 font-medium">
          ← {t["nav.back_admin"] ?? "Admin"}
        </Link>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <ReportsView
          orders={orders as Parameters<typeof ReportsView>[0]["orders"]}
          serviceCodes={serviceCodes}
          translations={t}
          locale={locale}
          currentFilters={params}
        />
      </main>
    </div>
  );
}
