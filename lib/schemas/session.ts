import { z } from "zod";

export const CreateSessionSchema = z.object({
  sessionId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  orderNumber: z.string().min(1).max(40).optional(),
  weightKg: z.number().positive().max(999).optional(),
  employeeDeviceId: z.string().min(1).max(200),
}).refine(
  (data) => Boolean(data.orderId) || data.weightKg !== undefined,
  { message: "Provide orderId or weightKg", path: ["orderId"] }
);

export const ClaimSessionSchema = z.object({
  pairingCode: z.string().length(6),
  customerDeviceId: z.string().min(1).max(200),
});

export const CancelSessionSchema = z.object({
  reason: z.string().max(500).optional(),
});

export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;
export type ClaimSessionInput  = z.infer<typeof ClaimSessionSchema>;
export type CancelSessionInput = z.infer<typeof CancelSessionSchema>;
