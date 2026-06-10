import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

// Public lightweight endpoint — the session ID (UUID) acts as a bearer token.
// Used by the customer kiosk to detect cancellation during degraded-mode polling.
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const { id } = await ctx.params;
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("id, status, workflow_step")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ data: null, error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data, error: null });
}
