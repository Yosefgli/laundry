import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const CreateSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z_]+$/, "Code must be lowercase letters and underscores only"),
  display_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  name_en: z.string().min(1),
  name_he: z.string().min(1),
  name_my: z.string().default(""),
});

export async function GET() {
  try {
    const admin = await requireAdmin();
    void admin;
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("service_types")
      .select("id, code, display_order, is_active, created_at")
      .order("display_order");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
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
    const { code, display_order, is_active, name_en, name_he, name_my } = body.data;

    // 1. Create service type
    const { data: service, error: svcErr } = await supabase
      .from("service_types")
      .insert({ code, display_order, is_active })
      .select()
      .single();

    if (svcErr || !service) {
      return NextResponse.json(
        { error: svcErr?.message ?? "Insert failed" },
        { status: svcErr?.code === "23505" ? 409 : 500 }
      );
    }

    // 2. Create default pricing rule (zeroed — admin sets prices via Pricing page)
    await supabase.from("pricing_rules").insert({
      service_type_id: service.id,
      price_per_kg: 0,
      flat_fee: 0,
      minimum_charge: 0,
      tax_rate: 0,
      is_active: true,
    });

    // 3. Upsert translation keys for all locales
    const translationKey = `service.${code}`;
    const translations = [
      { key: translationKey, locale: "en", value: name_en },
      { key: translationKey, locale: "he", value: name_he },
      ...(name_my ? [{ key: translationKey, locale: "my", value: name_my }] : []),
    ];
    await supabase.from("translations").upsert(translations, { onConflict: "key,locale" });

    // 4. Audit log
    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "service_type_created",
      entity_type: "service_types",
      entity_id: service.id,
      new_values: { code, display_order, is_active, name_en, name_he },
    });

    return NextResponse.json({ data: service }, { status: 201 });
  } catch (err) {
    const isForbidden = err instanceof Error && err.message === "Forbidden";
    return NextResponse.json(
      { error: isForbidden ? "Forbidden" : "Internal error" },
      { status: isForbidden ? 403 : 500 }
    );
  }
}
