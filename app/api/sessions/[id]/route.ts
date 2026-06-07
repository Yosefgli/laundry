import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { CancelSessionSchema } from "@/lib/schemas/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("sessions")
      .select(`*, order:orders(id, order_number, status, payment_status, total_amount, customer_name)`)
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const action = body.action as string;

    if (!["complete", "request_add_bag"].includes(action)) {
      return NextResponse.json({ data: null, error: "Unknown action" }, { status: 400 });
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("id, status, order_id")
      .eq("id", id)
      .single();

    if (!session) {
      return NextResponse.json({ data: null, error: "Session not found" }, { status: 404 });
    }
    if (session.status === "completed" && action === "complete") {
      return NextResponse.json({ data: session, error: null });
    }
    if (session.status !== "active") {
      return NextResponse.json({ data: null, error: "Session not active" }, { status: 409 });
    }

    if (action === "request_add_bag") {
      const { data: updatedSession, error } = await supabase
        .from("sessions")
        .update({ workflow_step: "waiting_for_weight", pending_item_id: null })
        .eq("id", id)
        .select("id, status, workflow_step")
        .single();

      if (error || !updatedSession) {
        return NextResponse.json({ data: null, error: error?.message }, { status: 500 });
      }

      return NextResponse.json({ data: updatedSession, error: null });
    }

    // action === "complete"
    const now = new Date().toISOString();
    const { data: updatedSession, error } = await supabase
      .from("sessions")
      .update({ status: "completed", completed_at: now, workflow_step: "completed" })
      .eq("id", id)
      .select("id, status, completed_at")
      .single();

    if (error || !updatedSession) {
      return NextResponse.json({ data: null, error: error?.message }, { status: 500 });
    }

    if (session?.order_id) {
      await supabase
        .from("orders")
        .update({ status: "confirmed" })
        .eq("id", session.order_id)
        .in("status", ["draft", "weighed"]);
    }

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "session_completed",
      entityType: "session",
      entityId: id,
    });

    return NextResponse.json({ data: updatedSession, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireEmployee();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const parsed = CancelSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const { data: session } = await supabase
      .from("sessions")
      .select("id, status, order_id")
      .eq("id", id)
      .single();

    if (!session) {
      return NextResponse.json({ data: null, error: "Session not found" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json({ data: null, error: "Session not active" }, { status: 409 });
    }

    const now = new Date().toISOString();

    await supabase
      .from("sessions")
      .update({ status: "cancelled", cancelled_at: now })
      .eq("id", id);

    if (session.order_id) {
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", session.order_id)
        .in("status", ["draft", "weighed"]);
    }

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "session_cancelled",
      entityType: "session",
      entityId: id,
      newValues: { reason: parsed.data.reason },
    });

    return NextResponse.json({ data: { id }, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
