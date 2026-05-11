import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const UpdatePricingSchema = z.object({
  price_per_kg:    z.number().min(0),
  flat_fee:        z.number().min(0),
  minimum_charge:  z.number().min(0),
  tax_rate:        z.number().min(0).max(1),
});

type RouteContext = { params: Promise<{ ruleId: string }> };

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireAdmin();
    const { ruleId } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = UpdatePricingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: old } = await supabase
      .from("pricing_rules")
      .select("price_per_kg, flat_fee, minimum_charge, tax_rate")
      .eq("id", ruleId)
      .single();

    const { data, error } = await supabase
      .from("pricing_rules")
      .update(parsed.data)
      .eq("id", ruleId)
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "setting_changed",
      entityType: "pricing_rule",
      entityId: ruleId,
      oldValues: old ?? undefined,
      newValues: parsed.data,
    });

    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
}
