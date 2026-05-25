import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CreateSessionSchema } from "@/lib/schemas/session";

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee();
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    let orderId = parsed.data.orderId;
    let firstItemId: string | null = null;
    let orderForResponse: {
      id: string;
      order_number: string;
      total_weight_kg: number;
      order_items?: Array<{ id: string; weight_kg: number; bag_number: number }>;
    } | null = null;
    const auditWrites: Array<Promise<void>> = [];

    if (parsed.data.weightKg !== undefined) {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          id: parsed.data.orderId,
          order_number: parsed.data.orderNumber,
          employee_id: employee.id,
          status: "weighed",
          payment_status: "pending",
          total_weight_kg: parsed.data.weightKg,
        })
        .select()
        .single();

      if (orderError || !order) {
        return NextResponse.json(
          { data: null, error: orderError?.message ?? "Failed to create order" },
          { status: 500 }
        );
      }

      orderId = order.id;

      // Create the first order_item immediately so pending_item_id can be set on the session
      const { data: firstItem, error: itemError } = await supabase
        .from("order_items")
        .insert({ order_id: order.id, weight_kg: parsed.data.weightKg, bag_number: 1 })
        .select("id, weight_kg, bag_number")
        .single();

      if (itemError || !firstItem) {
        return NextResponse.json(
          { data: null, error: itemError?.message ?? "Failed to create order item" },
          { status: 500 }
        );
      }

      firstItemId = firstItem.id;

      orderForResponse = {
        id: order.id,
        order_number: order.order_number,
        total_weight_kg: Number(order.total_weight_kg),
        order_items: [firstItem],
      };

      auditWrites.push(
        logAudit(supabase, {
          employeeId: employee.id,
          action: "order_created",
          entityType: "order",
          entityId: order.id,
          newValues: { status: "weighed", totalWeightKg: parsed.data.weightKg },
        })
      );
    }

    if (!orderId) {
      return NextResponse.json({ data: null, error: "Order is required" }, { status: 400 });
    }

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        id: parsed.data.sessionId,
        order_id: orderId,
        employee_device_id: parsed.data.employeeDeviceId,
        customer_device_id: `customer-${employee.id}`,
        pairing_code: null,
        pairing_code_expires: null,
        status: "active",
        workflow_step: "customer_info",
        pending_item_id: firstItemId,
      })
      .select()
      .single();

    if (error || !session) {
      return NextResponse.json({ data: null, error: error?.message }, { status: 500 });
    }

    auditWrites.push(
      logAudit(supabase, {
        employeeId: employee.id,
        action: "session_created",
        entityType: "session",
        entityId: session.id,
        newValues: { orderId },
      })
    );

    void Promise.all(auditWrites).catch(() => undefined);

    return NextResponse.json({
      data: orderForResponse ? { ...session, order: orderForResponse } : session,
      error: null,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
