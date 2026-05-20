import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { AddBagWeightSchema } from "@/lib/schemas/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  try {
    await requireEmployee();
    const { id: orderId } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = AddBagWeightSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify order exists and is in a valid state for adding bags
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, total_weight_kg")
      .eq("id", orderId)
      .single();

    if (!order) {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    if (!["weighed", "confirmed"].includes(order.status)) {
      return NextResponse.json(
        { data: null, error: "Cannot add bags to this order" },
        { status: 409 }
      );
    }

    // Determine the next bag number
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("order_id", orderId);

    const bagNumber = (count ?? 0) + 1;

    // Create new item
    const { data: newItem, error: itemError } = await supabase
      .from("order_items")
      .insert({ order_id: orderId, weight_kg: parsed.data.weightKg, bag_number: bagNumber })
      .select("id, weight_kg, bag_number")
      .single();

    if (itemError || !newItem) {
      return NextResponse.json({ data: null, error: itemError?.message }, { status: 500 });
    }

    const item = newItem;

    // Update order total weight
    await supabase
      .from("orders")
      .update({ total_weight_kg: Number(order.total_weight_kg) + parsed.data.weightKg })
      .eq("id", orderId);

    // Advance session: set pending_item_id + step
    await supabase
      .from("sessions")
      .update({ pending_item_id: item.id, workflow_step: "bag_service_selection" })
      .eq("order_id", orderId)
      .eq("status", "active");

    return NextResponse.json({ data: item, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
