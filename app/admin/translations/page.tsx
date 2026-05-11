import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { TranslationsManager } from "@/components/admin/TranslationsManager";

export default async function TranslationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const { data: emp } = await supabase.from("employees").select("role").eq("user_id", user.id).single();
  if (emp?.role !== "admin") redirect("/employee");

  const { data: translations } = await supabase
    .from("translations")
    .select("*")
    .order("key")
    .order("locale");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Translations</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-5xl mx-auto p-6">
        <TranslationsManager translations={translations ?? []} />
      </main>
    </div>
  );
}
