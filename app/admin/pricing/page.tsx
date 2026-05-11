import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import Link from "next/link";
import { PricingManager } from "@/components/admin/PricingManager";

async function getData() {
  const supabase = await createClient();
  const [services, rules] = await Promise.all([
    supabase.from("service_types").select("*").order("display_order"),
    supabase
      .from("pricing_rules")
      .select("*, service_type:service_types(code)")
      .eq("is_active", true),
  ]);
  return { services: services.data ?? [], rules: rules.data ?? [] };
}

export default async function PricingPage() {
  await requireAdmin();
  const { services, rules } = await getData();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold">Pricing Rules</h1>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">← Admin</Link>
      </header>
      <main className="max-w-3xl mx-auto p-6">
        <PricingManager services={services} rules={rules} />
      </main>
    </div>
  );
}
