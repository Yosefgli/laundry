import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  ip_address: z.string().min(1).optional(),
  is_active: z.boolean().optional(),
  employee_ids: z.array(z.string().uuid()).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = UpdateSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const supabase = createServiceClient();
    const { employee_ids, ...printerFields } = body.data;

    const { data: printer, error } = await supabase
      .from("printers")
      .update(printerFields)
      .eq("id", id)
      .select()
      .single();

    if (error || !printer) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 404 });

    if (employee_ids !== undefined) {
      await supabase.from("printer_employees").delete().eq("printer_id", id);
      if (employee_ids.length > 0) {
        await supabase.from("printer_employees").insert(
          employee_ids.map((employee_id) => ({ printer_id: id, employee_id }))
        );
      }
    }

    return NextResponse.json({ data: { ...printer, employee_ids: employee_ids ?? [] } });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: isForbidden ? "Forbidden" : "Internal error" }, { status: isForbidden ? 403 : 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const supabase = createServiceClient();

    const { error } = await supabase.from("printers").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: { id } });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json({ error: isForbidden ? "Forbidden" : "Internal error" }, { status: isForbidden ? 403 : 500 });
  }
}
