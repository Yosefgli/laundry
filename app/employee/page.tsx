import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { EmployeeDashboard } from "@/components/employee/EmployeeDashboard";

async function getTranslations(locale: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("translations")
    .select("key, value")
    .eq("locale", locale);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

async function getSettings() {
  const supabase = await createClient();
  const { data } = await supabase.from("system_settings").select("key, value");
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

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

async function getWorkstation() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workstations")
    .select("id, name")
    .eq("is_active", true)
    .limit(1)
    .single();
  return data;
}

async function getRecentOrders() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, status, payment_status, customer_name, total_amount, created_at")
    .not("status", "in", '("void","delivered")')
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

export default async function EmployeePage() {
  const employee = await getEmployee();
  if (!employee) redirect("/auth/login");

  const settings = await getSettings();
  const locale = settings["default_locale"] ?? "he";
  const [translations, workstation, recentOrders] = await Promise.all([
    getTranslations(locale),
    getWorkstation(),
    getRecentOrders(),
  ]);

  return (
    <EmployeeDashboard
      employee={employee}
      translations={translations}
      locale={locale as "en" | "he" | "my"}
      workstationId={workstation?.id}
      workstationName={workstation?.name ?? "Station"}
      recentOrders={recentOrders}
    />
  );
}
