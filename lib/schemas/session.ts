import { z } from "zod";

export const CreateSessionSchema = z.object({
  orderId: z.string().uuid(),
  employeeDeviceId: z.string().min(1).max(200),
  workstationId: z.string().uuid().optional(),
});

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
