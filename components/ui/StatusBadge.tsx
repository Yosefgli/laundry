import { cn } from "@/lib/utils";

type OrderStatus = "draft" | "weighed" | "confirmed" | "washing" | "drying" | "ironing" | "ready" | "delivered" | "cancelled" | "void";
type PaymentStatus = "pending" | "paid" | "refunded";

const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  draft:     "bg-gray-100 text-gray-700",
  weighed:   "bg-blue-100 text-blue-700",
  confirmed: "bg-indigo-100 text-indigo-700",
  washing:   "bg-cyan-100 text-cyan-700",
  drying:    "bg-sky-100 text-sky-700",
  ironing:   "bg-orange-100 text-orange-700",
  ready:     "bg-green-100 text-green-700",
  delivered: "bg-green-200 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  void:      "bg-gray-200 text-gray-500",
};

const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  pending:  "bg-yellow-100 text-yellow-700",
  paid:     "bg-green-100 text-green-700",
  refunded: "bg-purple-100 text-purple-700",
};

export function OrderStatusBadge({ status, label }: { status: OrderStatus; label: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", ORDER_STATUS_COLORS[status])}>
      {label}
    </span>
  );
}

export function PaymentStatusBadge({ status, label }: { status: PaymentStatus; label: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", PAYMENT_STATUS_COLORS[status])}>
      {label}
    </span>
  );
}
