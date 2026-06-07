import { createServiceClient } from "@/lib/supabase/server";

export type BackgroundSession = {
  id: string;
  workflow_step: string;
  created_at: string;
  order: {
    id: string;
    order_number: string;
    status: string;
    total_weight_kg: number;
    customer_name: string | null;
    total_amount: number;
    created_at: string;
  };
};

export async function getBackgroundSessionsForEmployee(employeeId: string): Promise<BackgroundSession[]> {
  const supabase = createServiceClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, total_weight_kg, customer_name, total_amount, created_at")
    .eq("employee_id", employeeId)
    .not("status", "in", '("void","delivered","cancelled")')
    .order("created_at", { ascending: false })
    .limit(20);

  const orderIds = (orders ?? []).map((o) => o.id);
  if (orderIds.length === 0) return [];

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, workflow_step, created_at, order_id")
    .eq("status", "active")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  const orderById = new Map((orders ?? []).map((o) => [o.id, o]));

  return (sessions ?? [])
    .filter((s) => s.order_id !== null && orderById.has(s.order_id!))
    .map((s) => {
      const order = orderById.get(s.order_id!)!;
      return {
        id: s.id,
        workflow_step: s.workflow_step ?? "customer_info",
        created_at: s.created_at,
        order: {
          id: order.id,
          order_number: order.order_number,
          status: order.status,
          total_weight_kg: Number(order.total_weight_kg),
          customer_name: order.customer_name,
          total_amount: Number(order.total_amount),
          created_at: order.created_at,
        },
      };
    });
}
