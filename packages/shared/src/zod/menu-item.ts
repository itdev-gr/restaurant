import { z } from "zod";

export const STATIONS = ["kitchen", "bar", "both"] as const;
export const StationSchema = z.enum(STATIONS);
export type Station = z.infer<typeof StationSchema>;

export const CreateMenuItemInput = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  station: StationSchema,
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemInput>;

export const UpdateMenuItemInput = CreateMenuItemInput.extend({
  id: z.string(),
}).partial({ categoryId: true, name: true, description: true, priceCents: true, station: true });
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInput>;

export const SetAvailabilityInput = z.object({
  id: z.string(),
  isAvailable: z.boolean(),
});
export type SetAvailabilityInput = z.infer<typeof SetAvailabilityInput>;
