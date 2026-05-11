export const enum SessionEvent {
  // Employee → Customer
  SESSION_STARTED      = "session:started",
  SESSION_CANCELLED    = "session:cancelled",
  SESSION_COMPLETED    = "session:completed",
  WORKFLOW_STEP_CHANGED = "session:workflow_step_changed",

  // Customer → Employee
  CUSTOMER_INFO_SUBMITTED  = "customer:info_submitted",
  SERVICES_SELECTED        = "customer:services_selected",
  ORDER_CONFIRMED          = "customer:order_confirmed",

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
