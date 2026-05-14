import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const CreateSchema = z.object({
  name: z.string().min(1),
  ip_address: z.string().min(1),
  is_active: z.boolean().optional().default(true),
  employee_ids: z.array(z.string().uuid()).optional().default([]),
});

export async function GET() {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("printers")
      .select("id, name, ip_address, is_active, created_at, printer_employees(employee_id)")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: isForbidden ? "Forbidden" : "Internal error" }, { status: isForbidden ? 403 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = CreateSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const supabase = createServiceClient();
    const { name, ip_address, is_active, employee_ids } = body.data;

    const { data: printer, error } = await supabase
      .from("printers")
      .insert({ name, ip_address, is_active })
      .select()
      .single();

    if (error || !printer) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });

    if (employee_ids.length > 0) {
      await supabase.from("printer_employees").insert(
        employee_ids.map((employee_id) => ({ printer_id: printer.id, employee_id }))
      );
    }

    return NextResponse.json({ data: { ...printer, employee_ids } }, { status: 201 });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: isForbidden ? "Forbidden" : "Internal error" }, { status: isForbidden ? 403 : 500 });
  }
}
