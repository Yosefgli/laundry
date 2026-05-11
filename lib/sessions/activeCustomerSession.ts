import { createServiceClient } from "@/lib/supabase/server";

const CUSTOMER_ENTRY_STATUSES = ["weighed"] as const;

export async function getActiveCustomerSessionForEmployee(employeeId: string) {
  const supabase = createServiceClient();
  const customerDeviceId = `customer-${employeeId}`;

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, status, created_at")
    .eq("employee_id", employeeId)
    .in("status", [...CUSTOMER_ENTRY_STATUSES])
    .order("created_at", { ascending: false })
    .limit(10);

  const orderIds = (orders ?? []).map((order) => order.id);
  if (orderIds.length === 0) return null;

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, order_id, customer_device_id, created_at")
    .eq("status", "active")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  const orderById = new Map((orders ?? []).map((order) => [order.id, order]));
  const session =
    sessions?.find((row) => row.customer_device_id === customerDeviceId) ?? sessions?.[0];

  if (!session || !session.order_id) return null;

  if (session.customer_device_id !== customerDeviceId) {
    await supabase
      .from("sessions")
      .update({ customer_device_id: customerDeviceId })
      .eq("id", session.id);
  }

  const order = orderById.get(session.order_id);

  return {
    id: session.id,
    customerDeviceId,
    order: order
      ? {
          id: order.id,
          orderNumber: order.order_number,
          status: order.status,
        }
      : null,
  };
}
