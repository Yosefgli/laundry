export const enum SessionEvent {
  // Employee → Customer
  SESSION_STARTED           = "session:started",
  SESSION_CANCELLED         = "session:cancelled",
  SESSION_COMPLETED         = "session:completed",
  WORKFLOW_STEP_CHANGED     = "session:workflow_step_changed",
  EMPLOYEE_BAG_WEIGHT_ENTERED = "employee:bag_weight_entered",

  // Customer → Employee
  CUSTOMER_INFO_SUBMITTED      = "customer:info_submitted",
  SERVICES_SELECTED            = "customer:services_selected",
  ORDER_CONFIRMED              = "customer:order_confirmed",
  CUSTOMER_BAG_SERVICE_CONFIRMED = "customer:bag_service_confirmed",
  CUSTOMER_ADD_BAG_REQUESTED   = "customer:add_bag_requested",
  CUSTOMER_ORDER_FINALIZED     = "customer:order_finalized",

  // Bidirectional
  ORDER_STATUS_CHANGED  = "order:status_changed",
  PRICE_UPDATED         = "order:price_updated",
}

export interface BroadcastEnvelope<T = unknown> {
  type: SessionEvent;
  payload: T;
  timestamp: string; // ISO 8601
}

export interface SessionStartedPayload {
  sessionId: string;
  orderId: string;
  customerDeviceId?: string;
  workflowStep: string;
  orderNumber?: string;
  totalWeightKg?: number;
  isReady?: boolean;
  pendingItemId?: string | null;
  orderItems?: Array<{ id: string; weight_kg: number; bag_number: number; color_type: string | null }>;
}

export interface WorkflowStepChangedPayload {
  step: string;
  orderId: string;
}

export interface CustomerInfoPayload {
  name: string;
  phone: string;
  notes?: string;
}

export interface ServicesSelectedPayload {
  items: Array<{
    itemId: string;
    weightKg: number;
    serviceIds: string[];
  }>;
}

export interface OrderConfirmedPayload {
  orderId: string;
  total: number;
}

export interface OrderStatusChangedPayload {
  orderId: string;
  status: string;
  previousStatus: string;
}

export interface PriceUpdatedPayload {
  orderId: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export type BagColorType = "white" | "colorful" | "dark";

export type KioskWorkflowStep =
  | "customer_info"
  | "bag_service_selection"
  | "bag_summary"
  | "waiting_for_weight"
  | "order_confirmed"
  | "completed"
  | "cancelled";

export interface BagWeightEnteredPayload {
  itemId: string;
  bagNumber: number;
  weightKg: number;
}

export interface BagServiceConfirmedPayload {
  itemId: string;
  bagNumber: number;
  serviceTypeIds: string[];
  serviceCodes: string[];
  colorType: string;
  lineTotal: number;
}

export interface AddBagRequestedPayload {
  orderId: string;
  bagsCompleted: number;
}

export interface OrderFinalizedPayload {
  orderId: string;
  orderNumber: string;
  total: number;
  bagCount: number;
}

export function channelName(sessionId: string): string {
  return `session:${sessionId}`;
}

export function customerDeviceChannelName(customerDeviceId: string): string {
  return `customer:${customerDeviceId}`;
}

export function makeEnvelope<T>(
  type: SessionEvent,
  payload: T
): BroadcastEnvelope<T> {
  return { type, payload, timestamp: new Date().toISOString() };
}
