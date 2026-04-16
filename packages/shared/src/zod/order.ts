import { z } from "zod";

export const PAYMENT_METHODS = ["card", "cash"] as const;
export const PaymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

export const CartLineInput = z.object({
  menuItemId: z.string(),
  qty: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
});
export type CartLineInput = z.infer<typeof CartLineInput>;

export const CreateOrderInput = z
  .object({
    paymentMethod: PaymentMethodSchema,
    customerName: z.string().trim().min(1).max(80).optional(),
    customerEmail: z.string().trim().toLowerCase().email().optional(),
    notes: z.string().trim().max(500).optional(),
    items: z.array(CartLineInput).min(1).max(50),
    idempotencyKey: z.string().uuid(),
  })
  .refine(
    (v) => v.paymentMethod !== "card" || (v.customerName && v.customerEmail),
    { message: "Card payment requires name and email.", path: ["paymentMethod"] },
  );
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
