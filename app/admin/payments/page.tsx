import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getI18n } from "@/lib/i18n/server";
import { PaymentsManager } from "@/components/admin/PaymentsManager";

async function getAdminEmployee() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("employees")
    .select("id, full_name, role")
    .eq("user_id", user.id)
    .single();
  return data?.role === "admin" ? data : null;
}

async function getWebhooks() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pos_webhooks")
    .select("id, pos_order_name, pos_order_id, extracted_order_number, amount_total, process_status, process_result, processed_at, created_at, matched_order_id, general_note")
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export default async function PaymentsAdminPage() {
  const [employee, { locale, translations: t }, webhooks] = await Promise.all([
    getAdminEmployee(),
    getI18n(),
    getWebhooks(),
  ]);

  if (!employee) redirect("/employee");

  return (
    <div className="min-h-screen bg-[#f8fefe]">
      <header className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3 text-white">
          <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="5" width="20" height="14" rx="2" stroke="white" strokeWidth="1.8" fill="none"/>
              <path d="M2 10h20" stroke="white" strokeWidth="1.8"/>
              <path d="M6 15h4M14 15h4" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="font-black text-base">תשלומים — Webhook Log</h1>
        </div>
        <Link href="/admin" className="text-sm text-white/80 hover:text-white font-medium transition-colors">← חזרה לניהול</Link>
      </header>

      <main className="max-w-6xl mx-auto p-6">
        <PaymentsManager webhooks={webhooks} locale={locale} translations={t} />
      </main>
    </div>
  );
}
