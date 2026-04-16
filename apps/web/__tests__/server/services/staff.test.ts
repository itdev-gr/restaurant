import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { inviteStaff, listStaff, removeStaff } from "@/server/services/staff";

async function seedOwner() {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: `owner-${Date.now()}@test.com`,
    password: "Sup3rSecret!",
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");
  await prisma.user.create({ data: { id: data.user.id, email: data.user.email!, name: "Owner" } });
  const r = await prisma.restaurant.create({
    data: {
      slug: `r-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: "R",
      currency: "EUR",
      memberships: { create: { userId: data.user.id, role: "owner" } },
    },
    select: { id: true },
  });
  return { restaurantId: r.id, ownerId: data.user.id };
}

describe("staff service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("invites a staff member with role — creates auth user + User + Membership", async () => {
    const { restaurantId } = await seedOwner();
    const r = await inviteStaff(restaurantId, {
      email: "chef@test.com",
      name: "Chef",
      role: "kitchen",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const m = await prisma.membership.findUnique({
      where: { id: r.data.membershipId },
      include: { user: true },
    });
    expect(m!.role).toBe("kitchen");
    expect(m!.user.email).toBe("chef@test.com");
  });

  it("rejects duplicate membership for same restaurant", async () => {
    const { restaurantId } = await seedOwner();
    await inviteStaff(restaurantId, { email: "dup@test.com", role: "bar" });
    const r = await inviteStaff(restaurantId, { email: "dup@test.com", role: "cashier" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("ALREADY_MEMBER");
  });

  it("listStaff returns all members including owner", async () => {
    const { restaurantId } = await seedOwner();
    await inviteStaff(restaurantId, { email: "s1@test.com", role: "kitchen" });
    const list = await listStaff(restaurantId);
    expect(list).toHaveLength(2); // owner + invited
    expect(list.map((m) => m.role).sort()).toEqual(["kitchen", "owner"]);
  });

  it("removeStaff deletes membership but cannot remove owner", async () => {
    const { restaurantId, ownerId } = await seedOwner();
    const invite = await inviteStaff(restaurantId, { email: "temp@test.com", role: "bar" });
    if (!invite.ok) return;

    // Remove the invited staff
    const r = await removeStaff(restaurantId, invite.data.membershipId);
    expect(r.ok).toBe(true);
    expect(await prisma.membership.count({ where: { restaurantId } })).toBe(1); // only owner

    // Try removing owner
    const ownerMembership = await prisma.membership.findFirst({
      where: { restaurantId, userId: ownerId },
    });
    const rOwner = await removeStaff(restaurantId, ownerMembership!.id);
    expect(rOwner.ok).toBe(false);
    if (!rOwner.ok) expect(rOwner.error.code).toBe("FORBIDDEN");
  });
});
