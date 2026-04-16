"use server";

import { requireMembership } from "@/lib/membership";
import { inviteStaff, removeStaff } from "@/server/services/staff";

export async function inviteStaffAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return inviteStaff(restaurantId, raw);
}

export async function removeStaffAction(membershipId: string) {
  const { restaurantId } = await requireMembership();
  return removeStaff(restaurantId, membershipId);
}
