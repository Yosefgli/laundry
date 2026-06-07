import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";
import { getI18n } from "@/lib/i18n/server";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders/activeOrderStatus";
import { getBackgroundSessionsForEmployee } from "@/lib/sessions/backgroundSessions";

async function getEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("user_id", user.id)
    .single();
  return data;
}

async function getRecentOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, customer_name, total_amount, created_at")
    .in("status", [...ACTIVE_ORDER_STATUSES])
    .order("created_at", { ascending: false })
    .limit(50);

  const orders = data ?? [];
  const customerEntryOrderIds = orders
    .filter((order) => order.status === "weighed")
    .map((order) => order.id);

  if (customerEntryOrderIds.length === 0) return orders.slice(0, 20);

  const { data: sessions } = await supabase
    .from("sessions")
    .select("order_id, status, created_at")
    .in("order_id", customerEntryOrderIds)
    .order("created_at", { ascending: false });

  const latestSessionStatusByOrder = new Map<string, string>();
  for (const session of sessions ?? []) {
    if (!session.order_id || latestSessionStatusByOrder.has(session.order_id)) continue;
    latestSessionStatusByOrder.set(session.order_id, session.status);
  }

  return orders.filter((order) => {
    if (order.status !== "weighed") return true;
    const latestSessionStatus = latestSessionStatusByOrder.get(order.id);
    return latestSessionStatus === undefined || latestSessionStatus === "active";
  }).slice(0, 20);
}

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect("/auth/login");

  const { locale, translations: i18nTranslations } = await getI18n();
  const [recentOrders, backgroundSessions] = await Promise.all([
    getRecentOrders(),
    getBackgroundSessionsForEmployee(employee.id),
  ]);

  return (
    <EmployeeDashboard
      employee={employee}
      translations={i18nTranslations}
      locale={locale}
      recentOrders={recentOrders}
      initialBackgroundSessions={backgroundSessions}
    />
  );
}
