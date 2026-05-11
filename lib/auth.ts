import { createClient } from "@/lib/supabase/server";

export async function getAuthenticatedEmployee() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, role, is_active")
    .eq("user_id", user.id)
    .single();

  if (!employee || !employee.is_active) return null;
  return employee;
}

export async function requireEmployee() {
  const employee = await getAuthenticatedEmployee();
  if (!employee) throw new Error("Unauthorized");
  return employee;
}

export async function requireAdmin() {
  const employee = await getAuthenticatedEmployee();
  if (!employee || employee.role !== "admin") throw new Error("Forbidden");
  return employee;
}
