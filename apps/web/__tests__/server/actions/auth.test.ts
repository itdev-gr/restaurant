import { describe, it, expect, beforeEach } from "vitest";
import { signupAction } from "@/server/actions/auth";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";

describe("signupAction", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates a Supabase auth user and a mirrored public.User row", async () => {
    const result = await signupAction({
      email: "Owner@Example.COM",
      password: "Sup3rSecret!",
      name: "Owner",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const user = await prisma.user.findUnique({ where: { email: "owner@example.com" } });
    expect(user).not.toBeNull();
    expect(user!.id).toBe(result.data.userId);
    expect(user!.name).toBe("Owner");
  });

  it("rejects duplicate email", async () => {
    await signupAction({ email: "dup@example.com", password: "Sup3rSecret!" });
    const second = await signupAction({ email: "dup@example.com", password: "Sup3rSecret!" });
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects invalid input with VALIDATION error", async () => {
    const result = await signupAction({ email: "not-an-email", password: "short" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("VALIDATION");
  });
});
