import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const RecordPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amount: z.number().positive(),
  notes: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee();
    const supabase = createServiceClient();

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey) {
      return NextResponse.json(
        { data: null, error: "idempotency-key header required" },
        { status: 400 }
      );
    }

    // Check for replayed key
    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("response_body")
      .eq("key", idempotencyKey)
      .gt("expires_at", new Date().toISOString())
      .single();
    if (existing) return NextResponse.json(existing.response_body as Record<string, unknown>);

    const body = await request.json();
    const parsed = RecordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    // Guard: never process twice
    const { data: order } = await supabase
      .from("orders")
      .select("id, status, payment_status")
      .eq("id", parsed.data.orderId)
      .single();

    if (!order) return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    if (order.payment_status === "paid") {
      return NextResponse.json({ data: null, error: "Order already paid" }, { status: 409 });
    }

    const now = new Date().toISOString();

    const { data: payment, error: payError } = await supabase
      .from("payments")
      .insert({
        order_id: parsed.data.orderId,
        employee_id: employee.id,
        amount: parsed.data.amount,
        idempotency_key: idempotencyKey,
        notes: parsed.data.notes ?? null,
      })
      .select()
      .single();

    if (payError) return NextResponse.json({ data: null, error: payError.message }, { status: 500 });

    await supabase
      .from("orders")
      .update({ payment_status: "paid", paid_at: now })
      .eq("id", parsed.data.orderId);

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "payment_confirmed",
      entityType: "order",
      entityId: parsed.data.orderId,
      newValues: { amount: parsed.data.amount, paymentId: payment.id },
    });

    const responseBody = { data: payment, error: null };
    await supabase.from("idempotency_keys").insert({
      key: idempotencyKey,
      response_body: responseBody as unknown as import("@/lib/db/database.types").Json,
    });

    return NextResponse.json(responseBody, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
