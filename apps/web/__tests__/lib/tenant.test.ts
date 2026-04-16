import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth-helpers", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { membership: { findFirst: vi.fn() } },
}));

import { currentRestaurantId } from "@/lib/tenant";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

describe("currentRestaurantId", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns restaurantId from primary membership", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", email: "x" });
    (prisma.membership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ restaurantId: "r1" });
    expect(await currentRestaurantId()).toBe("r1");
  });

  it("returns null when no session", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await currentRestaurantId()).toBeNull();
  });

  it("returns null when user has no membership yet", async () => {
    (getSessionUser as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "u1", email: "x" });
    (prisma.membership.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await currentRestaurantId()).toBeNull();
  });
});
