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

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        order_id: parsed.data.orderId,
        employee_device_id: parsed.data.employeeDeviceId,
        customer_device_id: `customer-${employee.id}`,
        workstation_id: parsed.data.workstationId ?? null,
        pairing_code: null,
        pairing_code_expires: null,
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
