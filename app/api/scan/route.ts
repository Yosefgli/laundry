import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireEmployee } from "@/lib/auth";

const ORDER_SELECT = `
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
`;

function parseBarcode(raw: string): { field: "id" | "order_number"; value: string } | null {
  // Strip Code 128 mode-switch prefix ({B, {A, {C) and trailing garbage chars
  const val = raw.trim().replace(/^\{[ABC]/i, "").replace(/[{}\s]+$/, "");
  if (!val) return null;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
    return { field: "id", value: val };
  }
  if (/^L-\d+$/i.test(val)) {
    return { field: "order_number", value: val };
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    await requireEmployee();
    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const raw: string = typeof body?.barcode === "string" ? body.barcode : "";
    const parsed = parseBarcode(raw);

    if (!parsed) {
      return NextResponse.json({ data: null, error: "Invalid barcode" }, { status: 400 });
    }

    const { data: order, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq(parsed.field, parsed.value)
      .single();

    if (error || !order) {
      return NextResponse.json({ data: null, error: "Order not found" }, { status: 404 });
    }

    return NextResponse.json({ data: order, error: null });
  } catch {
    return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
  }
}
