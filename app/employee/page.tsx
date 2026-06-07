import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";
import { getI18n } from "@/lib/i18n/server";
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
    .not("status", "in", '("void","delivered","cancelled")')
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
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
