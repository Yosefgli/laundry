import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

const UpdateSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z_]+$/)
    .optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  name_en: z.string().min(1).optional(),
  name_he: z.string().min(1).optional(),
  name_my: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = UpdateSchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

    const supabase = createServiceClient();
    const { code, display_order, is_active, name_en, name_he, name_my } = body.data;

    // Fetch current state for audit log
    const { data: current } = await supabase
      .from("service_types")
      .select("id, code, display_order, is_active")
      .eq("id", id)
      .single();
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Update service type fields
    const updateFields: { code?: string; display_order?: number; is_active?: boolean } = {};
    if (code !== undefined) updateFields.code = code;
    if (display_order !== undefined) updateFields.display_order = display_order;
    if (is_active !== undefined) updateFields.is_active = is_active;

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase
        .from("service_types")
        .update(updateFields)
        .eq("id", id);
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: error.code === "23505" ? 409 : 500 }
        );
      }
    }

    // Update translations if provided
    const effectiveCode = code ?? current.code;
    const translationKey = `service.${effectiveCode}`;
    const toUpsert = [
      ...(name_en !== undefined ? [{ key: translationKey, locale: "en", value: name_en }] : []),
      ...(name_he !== undefined ? [{ key: translationKey, locale: "he", value: name_he }] : []),
      ...(name_my !== undefined ? [{ key: translationKey, locale: "my", value: name_my }] : []),
    ];
    if (toUpsert.length > 0) {
      await supabase.from("translations").upsert(toUpsert, { onConflict: "key,locale" });
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "service_type_updated",
      entity_type: "service_types",
      entity_id: id,
      old_values: current,
      new_values: { ...updateFields, ...(name_en !== undefined ? { name_en } : {}), ...(name_he !== undefined ? { name_he } : {}) },
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

    // Check if any order items reference this service
    const { count } = await supabase
      .from("order_item_services")
      .select("id", { count: "exact", head: true })
      .eq("service_type_id", id);

    if ((count ?? 0) > 0) {
      // Soft-delete: deactivate instead of hard-delete
      const { data: current } = await supabase
        .from("service_types")
        .select("code, is_active")
        .eq("id", id)
        .single();

      await supabase.from("service_types").update({ is_active: false }).eq("id", id);

      await supabase.from("audit_logs").insert({
        employee_id: admin.id,
        action: "service_type_updated",
        entity_type: "service_types",
        entity_id: id,
        old_values: current,
        new_values: { is_active: false },
      });

      return NextResponse.json({ data: { soft_deleted: true } });
    }

    // Hard-delete: no order references
    const { data: current } = await supabase
      .from("service_types")
      .select("code, display_order, is_active")
      .eq("id", id)
      .single();

    // Delete pricing rules first (FK constraint)
    await supabase.from("pricing_rules").delete().eq("service_type_id", id);
    const { error } = await supabase.from("service_types").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from("audit_logs").insert({
      employee_id: admin.id,
      action: "service_type_deleted",
      entity_type: "service_types",
      entity_id: id,
      old_values: current,
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
