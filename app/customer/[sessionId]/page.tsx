import { createServiceClient } from "@/lib/supabase/server";
import { CustomerKiosk } from "@/components/customer/CustomerKiosk";
import { notFound } from "next/navigation";
import type { Database } from "@/lib/db/database.types";

type RouteProps = {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ device?: string; locale?: string }>;
};

type ServiceTypeRow = Database["public"]["Tables"]["service_types"]["Row"];
type PricingRuleRow = Database["public"]["Tables"]["pricing_rules"]["Row"];
type ServiceTypeWithPricingRules = ServiceTypeRow & {
  pricing_rules: PricingRuleRow[];
};
type ServiceTypesQueryRow = ServiceTypeRow & {
  pricing_rules: PricingRuleRow | PricingRuleRow[] | null;
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

async function getServiceTypes(): Promise<ServiceTypeWithPricingRules[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("service_types")
    .select(`*, pricing_rules(*)`)
    .eq("is_active", true)
    .order("display_order");

  return ((data ?? []) as ServiceTypesQueryRow[]).map((service) => ({
    ...service,
    pricing_rules: Array.isArray(service.pricing_rules)
      ? service.pricing_rules
      : service.pricing_rules
        ? [service.pricing_rules]
        : [],
  }));
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
