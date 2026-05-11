import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CreateSessionSchema } from "@/lib/schemas/session";

function generatePairingCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const employee = await requireEmployee();
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const pairingCode = generatePairingCode();
    const pairingExpires = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        order_id: parsed.data.orderId,
        employee_device_id: parsed.data.employeeDeviceId,
        workstation_id: parsed.data.workstationId ?? null,
        pairing_code: pairingCode,
        pairing_code_expires: pairingExpires,
        status: "active",
        workflow_step: "customer_info",
      })
      .select()
      .single();

    if (error || !session) {
      return NextResponse.json({ data: null, error: error?.message }, { status: 500 });
    }

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "session_created",
      entityType: "session",
      entityId: session.id,
      newValues: { orderId: parsed.data.orderId },
    });

    return NextResponse.json({ data: session, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
