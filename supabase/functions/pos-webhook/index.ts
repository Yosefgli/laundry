import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WebhookStatus =
  | "pending"
  | "matched_paid"
  | "already_paid"
  | "no_order_found"
  | "amount_mismatch"
  | "error";

interface PosPayload {
  amount_total: number;
  general_note?: string | null;
  id?: number;
  name?: string;
  [key: string]: unknown;
}

// Extracts "L-000071" from strings like "}L-000071\n"
function extractOrderNumber(note: string | null | undefined): string | null {
  if (!note) return null;
  return note.match(/([A-Z]-\d+)/)?.[1] ?? null;
}

// deno-lint-ignore no-explicit-any
async function finalize(supabase: any, webhookId: string, fields: Record<string, unknown>) {
  await supabase
    .from("pos_webhooks")
    .update({ ...fields, processed_at: new Date().toISOString() })
    .eq("id", webhookId);
}

// deno-lint-ignore no-explicit-any
async function processPayload(supabase: any, webhookId: string, payload: PosPayload) {
  const generalNote = payload.general_note ?? null;
  const extractedOrderNumber = extractOrderNumber(generalNote);
  const amountTotal = payload.amount_total;

  const base = {
    pos_order_id: payload.id ?? null,
    pos_order_name: payload.name ?? null,
    general_note: generalNote,
    extracted_order_number: extractedOrderNumber,
    amount_total: amountTotal,
  };

  if (!extractedOrderNumber) {
    await finalize(supabase, webhookId, {
      ...base,
      process_status: "no_order_found" as WebhookStatus,
      process_result: `Could not extract order number from: "${generalNote}"`,
    });
    return;
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, payment_status, total_amount")
    .eq("order_number", extractedOrderNumber)
    .single();

  if (orderError || !order) {
    await finalize(supabase, webhookId, {
      ...base,
      process_status: "no_order_found" as WebhookStatus,
      process_result: `Order "${extractedOrderNumber}" not found`,
    });
    return;
  }

  if (order.payment_status === "paid") {
    await finalize(supabase, webhookId, {
      ...base,
      matched_order_id: order.id,
      process_status: "already_paid" as WebhookStatus,
      process_result: `Order ${extractedOrderNumber} is already paid`,
    });
    return;
  }

  const dbAmount = parseFloat(String(order.total_amount));
  const webhookAmount = parseFloat(String(amountTotal));

  if (Math.abs(dbAmount - webhookAmount) > 0.01) {
    await finalize(supabase, webhookId, {
      ...base,
      matched_order_id: order.id,
      process_status: "amount_mismatch" as WebhookStatus,
      process_result: `Amount mismatch — webhook: ${webhookAmount}, order expects: ${dbAmount}`,
    });
    return;
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id);

  if (updateError) {
    await finalize(supabase, webhookId, {
      ...base,
      matched_order_id: order.id,
      process_status: "error" as WebhookStatus,
      process_result: `DB update failed: ${updateError.message}`,
    });
    return;
  }

  await finalize(supabase, webhookId, {
    ...base,
    matched_order_id: order.id,
    process_status: "matched_paid" as WebhookStatus,
    process_result: `Order ${extractedOrderNumber} marked as paid (amount: ${webhookAmount})`,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ data: null, error: "Invalid JSON" }), { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const payloads = (Array.isArray(body) ? body : [body]) as PosPayload[];
  const results = [];

  for (const item of payloads) {
    if (typeof item?.amount_total !== "number") {
      results.push({ error: "missing_amount_total" });
      continue;
    }

    const { data: webhook, error: insertError } = await supabase
      .from("pos_webhooks")
      .insert({ raw_payload: item })
      .select("id")
      .single();

    if (insertError || !webhook) {
      results.push({ error: "failed_to_store" });
      continue;
    }

    await processPayload(supabase, webhook.id, item);
    results.push({ id: webhook.id, status: "processed" });
  }

  return new Response(JSON.stringify({ data: results, error: null }), {
    headers: { "Content-Type": "application/json" },
  });
});
