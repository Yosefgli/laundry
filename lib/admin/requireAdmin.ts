import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireAdmin(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data } = await supabase
    .from("employees")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if ((data as { role: string } | null)?.role !== "admin") redirect("/employee");
}
