import { createServiceClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/db/database.types";

type WebhookStatus = Database["public"]["Enums"]["webhook_process_status"];

export async function reprocessWebhook(
  webhookId: string,
  overrides: { extracted_order_number?: string | null; amount_total?: number }
) {
  const supabase = createServiceClient();

  type WebhookUpdate = Database["public"]["Tables"]["pos_webhooks"]["Update"];
  const updateBefore: WebhookUpdate = {
    process_status: "pending" as WebhookStatus,
    process_result: null,
    processed_at: null,
    ...(overrides.extracted_order_number !== undefined && { extracted_order_number: overrides.extracted_order_number }),
    ...(overrides.amount_total !== undefined && { amount_total: overrides.amount_total }),
  };

  await supabase.from("pos_webhooks").update(updateBefore).eq("id", webhookId);

  const { data: webhook } = await supabase
    .from("pos_webhooks")
    .select("id, extracted_order_number, amount_total, general_note")
    .eq("id", webhookId)
    .single();

  if (!webhook) return { error: "Webhook not found" };

  const finalize = async (fields: Partial<Database["public"]["Tables"]["pos_webhooks"]["Update"]>) => {
    await supabase
      .from("pos_webhooks")
      .update({ ...fields, processed_at: new Date().toISOString() })
      .eq("id", webhookId);
  };

  const extractedOrderNumber = webhook.extracted_order_number;
  const amountTotal = webhook.amount_total;

  if (!extractedOrderNumber) {
    await finalize({
      process_status: "no_order_found",
      process_result: `Could not extract order number from: "${webhook.general_note}"`,
    });
    return { status: "no_order_found" as WebhookStatus };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, order_number, payment_status, total_amount")
    .eq("order_number", extractedOrderNumber)
    .single();

  if (orderError || !order) {
    await finalize({
      process_status: "no_order_found",
      process_result: `Order "${extractedOrderNumber}" not found`,
    });
    return { status: "no_order_found" as WebhookStatus };
  }

  if (order.payment_status === "paid") {
    await finalize({
      matched_order_id: order.id,
      process_status: "already_paid",
      process_result: `Order ${extractedOrderNumber} is already paid`,
    });
    return { status: "already_paid" as WebhookStatus };
  }

  const dbAmount = parseFloat(String(order.total_amount));
  const webhookAmount = parseFloat(String(amountTotal ?? 0));

  if (Math.abs(dbAmount - webhookAmount) > 0.01) {
    await finalize({
      matched_order_id: order.id,
      process_status: "amount_mismatch",
      process_result: `Amount mismatch — webhook: ${webhookAmount}, order expects: ${dbAmount}`,
    });
    return { status: "amount_mismatch" as WebhookStatus };
  }

  const { error: updateError } = await supabase
    .from("orders")
    .update({ payment_status: "paid", paid_at: new Date().toISOString() })
    .eq("id", order.id);

  if (updateError) {
    await finalize({
      matched_order_id: order.id,
      process_status: "error",
      process_result: `DB update failed: ${updateError.message}`,
    });
    return { status: "error" as WebhookStatus };
  }

  await finalize({
    matched_order_id: order.id,
    process_status: "matched_paid",
    process_result: `Order ${extractedOrderNumber} marked as paid (amount: ${webhookAmount})`,
  });

  return { status: "matched_paid" as WebhookStatus };
}
