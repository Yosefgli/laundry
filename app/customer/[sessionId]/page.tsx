import { createServiceClient } from "@/lib/supabase/server";
import { CustomerKiosk } from "@/components/customer/CustomerKiosk";
import { notFound, redirect } from "next/navigation";
import type { Database } from "@/lib/db/database.types";
import { getI18n } from "@/lib/i18n/server";
import { getAuthenticatedEmployee } from "@/lib/auth";

type RouteProps = {
  params: Promise<{ sessionId: string }>;
  searchParams?: Promise<{ handoff?: string | string[] }>;
};

type ServiceTypeRow = Database["public"]["Tables"]["service_types"]["Row"];
type PricingRuleRow = Database["public"]["Tables"]["pricing_rules"]["Row"];
type ServiceTypeWithPricingRules = ServiceTypeRow & {
  pricing_rules: PricingRuleRow[];
};
type ServiceTypesQueryRow = ServiceTypeRow & {
  pricing_rules: PricingRuleRow | PricingRuleRow[] | null;
};

const HANDOFF_LOOKUP_RETRIES = 20;
const HANDOFF_LOOKUP_RETRY_MS = 100;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSessionData(sessionId: string) {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("sessions")
    .select(`
      id, status, workflow_step, order_id, pending_item_id,
      order:orders(
        id, employee_id, order_number, status, total_weight_kg,
        total_amount, subtotal,
        order_items(
          id, weight_kg, notes, bag_number, color_type,
          order_item_services(*, service_type:service_types(id, code))
        )
      )
    `)
    .eq("id", sessionId)
    .eq("status", "active")
    .single();
  return data;
}

async function getSessionData(sessionId: string, retryHandoff: boolean) {
  const maxAttempts = retryHandoff ? HANDOFF_LOOKUP_RETRIES : 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await fetchSessionData(sessionId);
    if (session) return session;
    if (attempt < maxAttempts) await wait(HANDOFF_LOOKUP_RETRY_MS);
  }
  return null;
}

function isHandoff(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.includes("1") : value === "1";
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

export default async function CustomerSessionPage({ params, searchParams }: RouteProps) {
  const { sessionId } = await params;
  const search = searchParams ? await searchParams : {};
  const employee = await getAuthenticatedEmployee();
  if (!employee) redirect("/auth/login");

  const session = await getSessionData(sessionId, isHandoff(search.handoff));
  if (!session) notFound();

  const [{ locale, translations }, serviceTypes] = await Promise.all([
    getI18n(),
    getServiceTypes(),
  ]);

  const order = Array.isArray(session.order) ? session.order[0] : session.order;
  if (!order || order.employee_id !== employee.id) notFound();

  const normalizeItems = (raw: unknown): Array<{
    id: string; weight_kg: number; notes?: string | null;
    bag_number: number; color_type: string | null;
    order_item_services?: Array<{ id: string; service_type_id: string; line_total: number; service_type?: { id: string; code: string } | null }>;
  }> => {
    if (!raw || !Array.isArray(raw)) return [];
    return raw.map((item: Record<string, unknown>) => ({
      id: item.id as string,
      weight_kg: Number(item.weight_kg),
      notes: item.notes as string | null,
      bag_number: (item.bag_number as number | undefined) ?? 1,
      color_type: (item.color_type as string | null) ?? null,
      order_item_services: Array.isArray(item.order_item_services)
        ? (item.order_item_services as Array<Record<string, unknown>>).map((s) => ({
            id: s.id as string,
            service_type_id: s.service_type_id as string,
            line_total: Number(s.line_total),
            service_type: s.service_type as { id: string; code: string } | null,
          }))
        : [],
    }));
  };

  const orderItems = normalizeItems(order.order_items);

  return (
    <CustomerKiosk
      sessionId={sessionId}
      initialWorkflowStep={(session.workflow_step ?? "customer_info") as string}
      pendingItemId={(session as Record<string, unknown>).pending_item_id as string | null}
      order={{
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        total_weight_kg: Number(order.total_weight_kg),
        total_amount: Number((order as Record<string, unknown>).total_amount ?? 0),
        order_items: orderItems,
      }}
      serviceTypes={serviceTypes}
      translations={translations}
      locale={locale}
    />
  );
}
