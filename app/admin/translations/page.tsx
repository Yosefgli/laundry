import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { TranslationsManager } from "@/components/admin/TranslationsManager";

export default async function TranslationsPage() {
  await requireAdmin();
  const supabase = await createClient();

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
