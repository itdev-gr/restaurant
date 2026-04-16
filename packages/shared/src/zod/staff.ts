import { z } from "zod";

export const STAFF_ROLES = ["manager", "kitchen", "bar", "cashier"] as const;
export const StaffRoleSchema = z.enum(STAFF_ROLES);
export type StaffRole = z.infer<typeof StaffRoleSchema>;

export const InviteStaffInput = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().min(1).max(80).optional(),
  role: StaffRoleSchema,
});
export type InviteStaffInput = z.infer<typeof InviteStaffInput>;
