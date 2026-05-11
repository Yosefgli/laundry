import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { calculateOrderPrice } from "@/lib/pricing";
import { z } from "zod";

const PriceRequestSchema = z.object({
  items: z.array(
    z.object({
      weightKg: z.number().positive(),
      serviceTypeIds: z.array(z.string().uuid()).min(1),
    })
  ).min(1),
});

export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const body = await request.json().catch(() => ({}));
  const parsed = PriceRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
  }

  const allServiceIds = [...new Set(parsed.data.items.flatMap((i) => i.serviceTypeIds))];

  const { data: rules, error } = await supabase
    .from("pricing_rules")
    .select("*, service_type:service_types(id, code)")
    .in("service_type_id", allServiceIds)
    .eq("is_active", true);

  if (error || !rules) {
    return NextResponse.json({ data: null, error: "Failed to load pricing" }, { status: 500 });
  }

  const ruleMap = new Map(rules.map((r) => [r.service_type_id, r]));

  const itemInputs = parsed.data.items.map((item) => ({
    weightKg: item.weightKg,
    services: item.serviceTypeIds
      .map((sid) => {
        const rule = ruleMap.get(sid);
        if (!rule) return null;
        return {
          serviceTypeId: sid,
          serviceCode: (rule.service_type as { code: string } | null)?.code ?? "",
          pricingRule: rule,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null),
  }));

  const breakdown = calculateOrderPrice(itemInputs);
  return NextResponse.json({ data: breakdown, error: null });
}
