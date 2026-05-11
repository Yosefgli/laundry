import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { SettingsManager } from "@/components/admin/SettingsManager";

export default async function SettingsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data: settings } = await supabase
    .from("system_settings")
    .select("*")
    .order("key");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">System Settings</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-2xl mx-auto p-6">
        <SettingsManager settings={settings ?? []} />
      </main>
    </div>
  );
}
