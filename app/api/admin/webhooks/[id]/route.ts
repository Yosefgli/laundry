import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";
import { reprocessWebhook } from "@/lib/webhook-processing";

const EditWebhookSchema = z.object({
  extracted_order_number: z.string().max(50).nullable().optional(),
  amount_total: z.number().positive().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const parsed = EditWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("pos_webhooks")
      .update(parsed.data)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;

    await reprocessWebhook(id, {});

    const supabase = createServiceClient();
    const { data } = await supabase
      .from("pos_webhooks")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
