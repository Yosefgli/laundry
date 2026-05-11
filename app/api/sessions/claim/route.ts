import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { ClaimSessionSchema } from "@/lib/schemas/session";

/** Public endpoint — no auth required — customer tablet claims a pairing code. */
export async function POST(request: NextRequest) {
  const supabase = createServiceClient();

  const body = await request.json().catch(() => ({}));
  const parsed = ClaimSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: session } = await supabase
    .from("sessions")
    .select("id, status, pairing_code_expires, customer_device_id")
    .eq("pairing_code", parsed.data.pairingCode)
    .eq("status", "active")
    .gt("pairing_code_expires", new Date().toISOString())
    .single();

  if (!session) {
    return NextResponse.json(
      { data: null, error: "Invalid or expired pairing code" },
      { status: 404 }
    );
  }

  if (session.customer_device_id) {
    return NextResponse.json(
      { data: null, error: "Session already claimed" },
      { status: 409 }
    );
  }

  const { data: updated, error } = await supabase
    .from("sessions")
    .update({
      customer_device_id: parsed.data.customerDeviceId,
      pairing_code: null,
      pairing_code_expires: null,
    })
    .eq("id", session.id)
    .select(`*, order:orders(id, order_number, status, total_weight_kg)`)
    .single();

  if (error) {
    return NextResponse.json({ data: null, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: updated, error: null });
}
