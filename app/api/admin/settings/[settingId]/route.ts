import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

type RouteContext = { params: Promise<{ settingId: string }> };

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    const employee = await requireAdmin();
    const { settingId } = await ctx.params;
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = z.object({ value: z.string() }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: "value required" }, { status: 400 });
    }

    const { data: old } = await supabase
      .from("system_settings")
      .select("key, value")
      .eq("id", settingId)
      .single();

    const { data, error } = await supabase
      .from("system_settings")
      .update({ value: parsed.data.value })
      .eq("id", settingId)
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });

    await logAudit(supabase, {
      employeeId: employee.id,
      action: "setting_changed",
      entityType: "system_setting",
      entityId: settingId,
      oldValues: { value: old?.value },
      newValues: { value: parsed.data.value },
    });

    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
}
