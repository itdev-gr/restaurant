import { z } from "zod";

export const CreateCategoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const RenameCategoryInput = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
});
export type RenameCategoryInput = z.infer<typeof RenameCategoryInput>;

export const ReorderCategoriesInput = z.object({
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesInput>;
