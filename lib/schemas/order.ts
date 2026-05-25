import { z } from "zod";
import { PHONE_COUNTRY_CODES, isSupportedPhoneCountryCode } from "@/lib/phoneCountryCodes";

export const CreateOrderSchema = z.object({
  "idempotency-key": z.string().min(1).max(128).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "draft", "weighed", "confirmed",
    "washing", "drying", "ironing", "ready", "delivered",
    "cancelled", "void",
  ]),
  deliveredBy: z.string().uuid().optional(),
  force: z.boolean().optional(),
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
  phone: z.string().min(8).max(30).trim().regex(/^\+\d{7,15}$/),
  notes: z.string().max(500).optional(),
});

export const UpdateOrderDetailsSchema = z.object({
  customerName: z.string().max(200).trim().optional().nullable(),
  customerPhone: z
    .string()
    .trim()
    .regex(/^\+\d{7,15}$/)
    .optional()
    .nullable()
    .or(z.literal("")),
  customerNotes: z.string().max(500).optional().nullable(),
  totalWeightKg: z.number().positive().max(999).optional(),
});

const BagColorEnum = z.enum(["white", "colorful", "dark"]);
export const ConfirmBagServiceSchema = z.object({
  itemId:         z.string().uuid(),
  serviceTypeIds: z.array(z.string().uuid()).min(1),
  colorType:      BagColorEnum,
});

export const AddBagWeightSchema = z.object({
  weightKg: z.number().positive().max(999),
});

export type CreateOrderInput        = z.infer<typeof CreateOrderSchema>;
export type UpdateOrderStatusInput  = z.infer<typeof UpdateOrderStatusSchema>;
export type UpdateOrderWeightInput  = z.infer<typeof UpdateOrderWeightSchema>;
export type AddOrderItemInput       = z.infer<typeof AddOrderItemSchema>;
export type CustomerInfoInput       = z.infer<typeof CustomerInfoSchema>;
export type UpdateOrderDetailsInput = z.infer<typeof UpdateOrderDetailsSchema>;
export type ConfirmBagServiceInput  = z.infer<typeof ConfirmBagServiceSchema>;
export type AddBagWeightInput       = z.infer<typeof AddBagWeightSchema>;
export { PHONE_COUNTRY_CODES, isSupportedPhoneCountryCode };
