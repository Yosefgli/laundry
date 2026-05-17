import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";
import { z } from "zod";

const ScanSchema = z.object({
  barcode: z.string().min(3).max(20),
});

export async function POST(request: NextRequest) {
  try {
    await requireEmployee();
    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const parsed = ScanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ data: null, error: "Invalid barcode" }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select(`
        id, order_number, status, payment_status,
        customer_name, customer_phone, customer_notes,
        total_weight_kg, subtotal, tax_amount, total_amount,
        paid_at, delivered_at, created_at,
        order_items(
          id, weight_kg, notes, subtotal,
          order_item_services(
            id, line_total,
            service_type:service_types(id, code)
          )
        )
      `)
      .eq("order_number", parsed.data.barcode)
      .single();

    if (error || !order) {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ data: order, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
