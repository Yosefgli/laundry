import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const UpsertTranslationSchema = z.object({
  key:    z.string().min(1),
  locale: z.enum(["en", "he", "my"]),
  value:  z.string(),
  id:     z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const supabase = createServiceClient();

    const body = await request.json();
    const parsed = UpsertTranslationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: parsed.error.flatten() }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("translations")
      .upsert(
        { key: parsed.data.key, locale: parsed.data.locale, value: parsed.data.value },
        { onConflict: "key,locale" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    return NextResponse.json({ data, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Forbidden" }, { status: 403 });
  }
}
