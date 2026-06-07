import type { Database } from "@/lib/db/database.types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export const ACTIVE_ORDER_STATUSES = [
  "draft",
  "weighed",
  "confirmed",
  "washing",
  "drying",
  "ironing",
  "ready",
] as const satisfies readonly OrderStatus[];

export function isActiveOrderStatus(status: string | null | undefined): boolean {
  return (ACTIVE_ORDER_STATUSES as readonly string[]).includes(status ?? "");
}
