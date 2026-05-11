import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CreateOrderSchema } from "@/lib/schemas/order";

export async function GET() {
  try {
    const employee = await requireEmployee();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, payment_status,
        customer_name, customer_phone,
        total_weight_kg, total_amount, created_at,
        employee:employees(id, full_name)
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    void employee;
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee();
    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const parsed = CreateOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { data: null, error: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (idempotencyKey) {
      const { data: existing } = await supabase
        .from("idempotency_keys")
        .select("response_body")
        .eq("key", idempotencyKey)
        .gt("expires_at", new Date().toISOString())
        .single();
      if (existing) {
        return NextResponse.json(existing.response_body as Record<string, unknown>);
      }
    }

    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        employee_id: employee.id,
        workstation_id: parsed.data.workstationId ?? null,
        status: "draft",
        payment_status: "pending",
      })
      .select()
      .single();

    if (error || !order) {
      return NextResponse.json({ data: null, error: error?.message ?? "Failed" }, { status: 500 });
    }

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "order_created",
      entityType: "order",
      entityId: order.id,
      newValues: { status: "draft" },
    });

    const responseBody = { data: order, error: null };

    if (idempotencyKey) {
      await supabase.from("idempotency_keys").insert({
        key: idempotencyKey,
        response_body: responseBody as unknown as import("@/lib/db/database.types").Json,
      });
    }

    return NextResponse.json(responseBody, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
