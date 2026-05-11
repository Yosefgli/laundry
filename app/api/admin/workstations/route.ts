import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const CreateWorkstationSchema = z.object({
  name: z.string().min(1).max(100),
  printer_ip: z.string().optional(),
  printer_port: z.number().int().min(1).max(65535).default(9100),
  printer_http_url: z.string().url().optional().or(z.literal("")),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();
    const body = await request.json();
    const parsed = CreateWorkstationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });

    const { data, error } = await supabase
      .from("workstations")
      .insert({ ...parsed.data, is_active: true })
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    return NextResponse.json({ data, error: null }, { status: 201 });
  } catch {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
}
