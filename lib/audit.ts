import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/database.types";

type AuditAction = Database["public"]["Enums"]["audit_action"];

export async function logAudit(
  supabase: SupabaseClient<Database>,
  opts: {
    employeeId?: string;
    action: AuditAction;
    entityType: string;
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_logs").insert({
    employee_id: opts.employeeId ?? null,
    action: opts.action,
    entity_type: opts.entityType,
    entity_id: opts.entityId ?? null,
    old_values: (opts.oldValues ?? null) as Json | null,
    new_values: (opts.newValues ?? null) as Json | null,
  });
}
