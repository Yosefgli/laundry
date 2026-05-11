import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CustomerInfoSchema, AddOrderItemSchema, SetOrderWeightSchema } from "@/lib/schemas/order";
import { calculateItemPrice } from "@/lib/pricing";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        *,
        employee:employees(id, full_name),
        workstation:workstations(id, name),
        order_items(
          *,
          order_item_services(
            *,
            service_type:service_types(id, code),
            pricing_rule:pricing_rules(id, price_per_kg, flat_fee, tax_rate)
          )
        )
      `)
      .eq("id", id)
      .single();

    if (error || !order) {
      return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    }
    void employee;
    return NextResponse.json({ data: order, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const action = body.action as string;

    if (action === "set_weight") {
      const parsed = SetOrderWeightSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("orders")
        .update({ total_weight_kg: parsed.data.weightKg, status: "weighed" })
        .eq("id", id)
        .select()
        .single();
      if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
      void employee;
      return NextResponse.json({ data, error: null });
    }

    if (action === "update_customer_info") {
      const parsed = CustomerInfoSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("orders")
        .update({
          customer_name: parsed.data.name,
          customer_phone: parsed.data.phone,
          customer_notes: parsed.data.notes ?? null,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
      return NextResponse.json({ data, error: null });
    }

    if (action === "add_item") {
      const parsed = AddOrderItemSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
      }

      const { data: item, error: itemError } = await supabase
        .from("order_items")
        .insert({ order_id: id, weight_kg: parsed.data.weightKg, notes: parsed.data.notes })
        .select()
        .single();

      if (itemError || !item) {
        return NextResponse.json({ data: null, error: itemError?.message }, { status: 500 });
      }

      // Fetch current pricing rules for requested services
      const { data: rules } = await supabase
        .from("pricing_rules")
        .select("*, service_type:service_types(id, code)")
        .in("service_type_id", parsed.data.serviceTypeIds)
        .eq("is_active", true);

      if (!rules?.length) {
        return NextResponse.json({ data: null, error: "No active pricing rules found" }, { status: 400 });
      }

      const serviceInserts = rules.map((rule) => {
        const lineItem = calculateItemPrice(parsed.data.weightKg, {
          serviceTypeId: rule.service_type_id,
          serviceCode: (rule.service_type as { code: string } | null)?.code ?? "",
          pricingRule: rule,
        });
        return {
          order_item_id: item.id,
          service_type_id: rule.service_type_id,
          pricing_rule_id: rule.id,
          price_per_kg: Number(rule.price_per_kg),
          flat_fee: Number(rule.flat_fee),
          line_total: lineItem.lineTotal,
        };
      });

      const { error: servicesError } = await supabase
        .from("order_item_services")
        .insert(serviceInserts);

      if (servicesError) {
        return NextResponse.json({ data: null, error: servicesError.message }, { status: 500 });
      }

      // Fetch refreshed order after triggers recompute totals
      const { data: updatedOrder } = await supabase
        .from("orders")
        .select("id, subtotal, tax_amount, total_amount, total_weight_kg")
        .eq("id", id)
        .single();

      void employee;
      return NextResponse.json({ data: { item, order: updatedOrder }, error: null });
    }

    return NextResponse.json({ data: null, error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const { data: order } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", id)
      .single();

    if (!order) return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    if (!["draft", "weighed"].includes(order.status)) {
      return NextResponse.json(
        { data: null, error: "Cannot delete confirmed orders" },
        { status: 409 }
      );
    }

    const { error } = await supabase.from("orders").update({ status: "void" }).eq("id", id);
    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "order_status_changed",
      entityType: "order",
      entityId: id,
      oldValues: { status: order.status },
      newValues: { status: "void" },
    });

    return NextResponse.json({ data: { id }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
