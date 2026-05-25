import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const UpdateSchema = z.object({
  full_name: z.string().min(1).optional(),
  role: z.enum(["admin", "employee"]).optional(),
  is_active: z.boolean().optional(),
  new_password: z.string().min(8).optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = UpdateSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const supabase = createServiceClient();
    const { full_name, role, is_active, new_password } = body.data;

    // Fetch current employee for audit + user_id
    const { data: current } = await supabase
      .from("employees")
      .select("id, user_id, full_name, role, is_active")
      .eq("id", id)
      .single();
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prevent admin from deactivating themselves
    if (is_active === false && current.id === admin.id) {
      return NextResponse.json({ error: "Cannot deactivate your own account" }, { status: 422 });
    }

    // Update employees table
    const updateFields: { full_name?: string; role?: "admin" | "employee"; is_active?: boolean } = {};
    if (full_name !== undefined) updateFields.full_name = full_name;
    if (role !== undefined) updateFields.role = role;
    if (is_active !== undefined) updateFields.is_active = is_active;

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase.from("employees").update(updateFields).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Update auth user password if requested
    if (new_password) {
      const { error: pwErr } = await supabase.auth.admin.updateUserById(current.user_id, {
        password: new_password,
      });
      if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 500 });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "employee_updated",
      entity_type: "employees",
      entity_id: id,
      old_values: { full_name: current.full_name, role: current.role, is_active: current.is_active },
      new_values: { ...updateFields, ...(new_password ? { password_changed: true } : {}) },
    });

    return NextResponse.json({ data: { id, ...updateFields } });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Internal error" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const supabase = createServiceClient();

    const { data: target } = await supabase
      .from("employees")
      .select("id, user_id, full_name, role, email")
      .eq("id", id)
      .single();
    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prevent self-deletion
    if (target.id === admin.id) {
      return NextResponse.json({ error: "Cannot delete your own account" }, { status: 422 });
    }

    // Deleting auth user cascades to employees row (ON DELETE CASCADE)
    const { error } = await supabase.auth.admin.deleteUser(target.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Audit log (employee row already cascaded, but log before)
    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "employee_deleted",
      entity_type: "employees",
      entity_id: id,
      old_values: { full_name: target.full_name, role: target.role, email: target.email },
      new_values: null,
    });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Internal error" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
