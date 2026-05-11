import { createServiceClient } from "@/lib/supabase/server";
import { CustomerKiosk } from "@/components/customer/CustomerKiosk";
import { notFound } from "next/navigation";

type RouteProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ device?: string; locale?: string }>;
};

async function getSessionData(sessionId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select(`
      id, status, workflow_step, order_id,
      order:orders(
        id, order_number, status, total_weight_kg,
        order_items(id, weight_kg, notes)
      )
    `)
    .eq("id", sessionId)
    .eq("status", "active")
    .single();
  return data;
}

async function getServiceTypes() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("service_types")
    .select(`*, pricing_rules(id, price_per_kg, flat_fee, minimum_charge, tax_rate)`)
    .eq("is_active", true)
    .order("display_order");
  return data ?? [];
}

async function getTranslations(locale: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("translations")
    .select("key, value")
    .eq("locale", locale);
  return Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
}

export default async function CustomerSessionPage({ params, searchParams }: RouteProps) {
  const { sessionId } = await params;
  const { device: customerDeviceId, locale: localeParam } = await searchParams;

  const session = await getSessionData(sessionId);
  if (!session) notFound();

  const locale = (localeParam ?? "he") as "en" | "he" | "my";

  const [serviceTypes, translations] = await Promise.all([
    getServiceTypes(),
    getTranslations(locale),
  ]);

  const order = Array.isArray(session.order) ? session.order[0] : session.order;

  // If no items yet, synthesise one bag from the order weight for the customer to assign services
  const initialItems =
    order?.order_items && order.order_items.length > 0
      ? order.order_items
      : [{ id: "bag-0", weight_kg: order?.total_weight_kg ?? 0 }];

  return (
    <CustomerKiosk
      sessionId={sessionId}
      order={{ ...order, order_items: initialItems }}
      serviceTypes={serviceTypes}
      translations={translations}
      locale={locale}
      customerDeviceId={customerDeviceId ?? ""}
    />
  );
}
