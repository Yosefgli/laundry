import { z } from "zod";

export const CreateOrderSchema = z.object({
  workstationId: z.string().uuid().optional(),
  "idempotency-key": z.string().min(1).max(128).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "draft", "weighed", "confirmed", "paid",
    "washing", "drying", "ironing", "ready", "delivered",
    "cancelled", "void",
  ]),
  deliveredBy: z.string().uuid().optional(),
});

export const UpdateOrderWeightSchema = z.object({
  totalWeightKg: z.number().positive().max(999),
});

export const SetOrderWeightSchema = z.object({
  weightKg: z.number().positive().max(999),
});

export const AddOrderItemSchema = z.object({
  weightKg: z.number().positive().max(999),
  notes: z.string().max(500).optional(),
  serviceTypeIds: z.array(z.string().uuid()).min(1),
});

export const CustomerInfoSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  phone: z.string().min(5).max(30).trim(),
  notes: z.string().max(500).optional(),
});

export type CreateOrderInput        = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput  = z.infer<typeof UpdateOrderStatusSchema>;
export type UpdateOrderWeightInput  = z.infer<typeof UpdateOrderWeightSchema>;
export type AddOrderItemInput       = z.infer<typeof AddOrderItemSchema>;
export type CustomerInfoInput       = z.infer<typeof CustomerInfoSchema>;
