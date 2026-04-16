import { z } from "zod";

export const BulkCreateTablesInput = z.object({
  count: z.coerce.number().int().min(1).max(200),
  startAt: z.coerce.number().int().min(1).optional(),
  labelPrefix: z.string().trim().max(40).optional(),
});
export type BulkCreateTablesInput = z.infer<typeof BulkCreateTablesInput>;

export const RenameTableInput = z.object({
  id: z.string(),
  label: z.string().trim().max(40).nullable(),
});
export type RenameTableInput = z.infer<typeof RenameTableInput>;

export const ArchiveTableInput = z.object({ id: z.string() });
export type ArchiveTableInput = z.infer<typeof ArchiveTableInput>;
