import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const UpdateWorkstationSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  printer_ip: z.string().nullable().optional(),
  printer_port: z.number().int().min(1).max(65535).optional(),
  printer_http_url: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireAdmin();
    const { id } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = UpdateWorkstationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from("workstations")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "workstation_config_changed",
      entityType: "workstation",
      entityId: id,
      newValues: parsed.data,
    });

    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
}
