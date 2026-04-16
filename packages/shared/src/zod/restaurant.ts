import { z } from "zod";

export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export const CurrencySchema = z.enum(CURRENCIES);
export type Currency = z.infer<typeof CurrencySchema>;

export const CreateRestaurantInput = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  currency: CurrencySchema.default("EUR"),
  taxRatePct: z.coerce.number().min(0).max(100).default(0),
  serviceChargePct: z.coerce.number().min(0).max(100).default(0),
});
export type CreateRestaurantInput = z.infer<typeof CreateRestaurantInput>;
