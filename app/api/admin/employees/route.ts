import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const CreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
  role: z.enum(["admin", "employee"]).default("employee"),
});

export async function GET() {
  try {
    const admin = await requireAdmin();
    void admin;
    const supabase = createServiceClient();

    const { data: employees, error } = await supabase
      .from("employees")
      .select("id, user_id, full_name, role, is_active, email, created_at")
      .order("full_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: employees });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Internal error" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = CreateSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const supabase = createServiceClient();
    const { email, password, full_name, role } = body.data;

    // 1. Create the Supabase auth user (this is the "autocreation" — no email confirmation needed for internal users)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authErr || !authData.user) {
      return NextResponse.json(
        { error: authErr?.message ?? "Failed to create auth user" },
        { status: authErr?.status ?? 500 }
      );
    }

    // 2. Insert employee row
    const { data: employee, error: empErr } = await supabase
      .from("employees")
      .insert({
        user_id: authData.user.id,
        full_name,
        role,
        is_active: true,
        email,
      })
      .select()
      .single();

    if (empErr || !employee) {
      // Roll back auth user creation
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: empErr?.message ?? "Insert failed" }, { status: 500 });
    }

    // 3. Audit log
    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "employee_created",
      entity_type: "employees",
      entity_id: employee.id,
      new_values: { email, full_name, role },
    });

    return NextResponse.json({ data: employee }, { status: 201 });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Internal error" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
