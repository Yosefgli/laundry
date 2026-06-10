import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { UpdateOrderStatusSchema } from "@/lib/schemas/order";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = UpdateOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: order } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", id)
      .single();

    if (!order) {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    // Validate transition server-side using the DB function
    const { data: isValid } = await supabase.rpc("valid_order_transition", {
      p_from: order.status,
      p_to: parsed.data.status,
    });

    if (!isValid && !parsed.data.force) {
      return NextResponse.json(
        { data: null, error: `Invalid transition: ${order.status} → ${parsed.data.status}`, currentStatus: order.status },
        { status: 409 }
      );
    }

    if (parsed.data.status === "delivered" && order.payment_status !== "paid") {
      return NextResponse.json(
        { data: null, error: "Cannot deliver an unpaid order", currentStatus: order.status },
        { status: 409 }
      );
    }

    const updatePayload =
      parsed.data.status === "delivered"
        ? {
            status: parsed.data.status,
            delivered_at: new Date().toISOString(),
            delivered_by: parsed.data.deliveredBy ?? employee.id,
            ...(parsed.data.terms_accepted !== undefined && { terms_accepted: parsed.data.terms_accepted }),
          }
        : {
            status: parsed.data.status,
            ...(parsed.data.terms_accepted !== undefined && { terms_accepted: parsed.data.terms_accepted }),
          };

    const { data: updated, error } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "order_status_changed",
      entityType: "order",
      entityId: id,
      oldValues: { status: order.status },
      newValues: { status: parsed.data.status },
    });

    return NextResponse.json({ data: updated, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
