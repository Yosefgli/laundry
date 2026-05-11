import { redirect } from "next/navigation";
import { getAuthenticatedEmployee } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { getActiveCustomerSessionForEmployee } from "@/lib/sessions/activeCustomerSession";
import { createServiceClient } from "@/lib/supabase/server";
import { CustomerPriceDisplay } from "@/components/customer/CustomerPriceDisplay";
import type { Database } from "@/lib/db/database.types";

type ServiceTypeRow = Database["public"]["Tables"]["service_types"]["Row"];
type PricingRuleRow = Database["public"]["Tables"]["pricing_rules"]["Row"];
type ServiceTypeWithPricingRules = ServiceTypeRow & {
  pricing_rules: PricingRuleRow[];
};
type ServiceTypesQueryRow = ServiceTypeRow & {
  pricing_rules: PricingRuleRow | PricingRuleRow[] | null;
};

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

export default async function CustomerEntryPage() {
  const employee = await getAuthenticatedEmployee();
  if (!employee) redirect("/auth/login");

  const [i18n, activeSession, serviceTypes] = await Promise.all([
    getI18n(),
    getActiveCustomerSessionForEmployee(employee.id),
    getServiceTypes(),
  ]);

  if (activeSession) {
    redirect(`/customer/${activeSession.id}?device=${encodeURIComponent(activeSession.customerDeviceId)}`);
  }

  return (
    <CustomerPriceDisplay
      customerDeviceId={`customer-${employee.id}`}
      serviceTypes={serviceTypes}
      translations={i18n.translations}
      locale={i18n.locale}
    />
  );
}
