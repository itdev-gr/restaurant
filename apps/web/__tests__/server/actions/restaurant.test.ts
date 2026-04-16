import { describe, it, expect, beforeEach } from "vitest";
import { createRestaurantForUser } from "@/server/services/restaurant";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

async function makeUser(email = "owner@example.com") {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email, password: "Sup3rSecret!", email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("no user");
  await prisma.user.create({ data: { id: data.user.id, email, name: "Owner" } });
  return { id: data.user.id };
}

describe("createRestaurantForUser", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates restaurant + owner membership and unique slug", async () => {
    const user = await makeUser();
    const result = await createRestaurantForUser(user.id, {
      name: "The Golden Fork",
      currency: "EUR",
      taxRatePct: 13,
      serviceChargePct: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const r = await prisma.restaurant.findUnique({
      where: { id: result.data.restaurantId },
      include: { memberships: true },
    });
    expect(r?.slug).toBe("the-golden-fork");
    expect(r?.taxRate.toString()).toBe("13");
    expect(r?.memberships).toHaveLength(1);
    expect(r?.memberships[0]?.role).toBe("owner");
    expect(r?.memberships[0]?.userId).toBe(user.id);
  });

  it("appends suffix when slug taken", async () => {
    const u1 = await makeUser("a@example.com");
    const u2 = await makeUser("b@example.com");
    await createRestaurantForUser(u1.id, { name: "Cafe", currency: "EUR", taxRatePct: 0, serviceChargePct: 0 });
    const second = await createRestaurantForUser(u2.id, {
      name: "Cafe", currency: "EUR", taxRatePct: 0, serviceChargePct: 0,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const r = await prisma.restaurant.findUnique({ where: { id: second.data.restaurantId } });
    expect(r?.slug).toBe("cafe-2");
  });

  it("rejects invalid input with VALIDATION", async () => {
    const user = await makeUser();
    const result = await createRestaurantForUser(user.id, { name: "x" } as never);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
