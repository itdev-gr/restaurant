import { describe, it, expect, vi } from "vitest";

vi.stubEnv("NEXTAUTH_SECRET", "test-secret-for-table-session-test-very-long");

import { signTableCookie, verifyTableCookie } from "@/lib/table-session";

describe("table-session cookie", () => {
  it("round-trips a payload", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() + 60_000 };
    const token = signTableCookie(payload);
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    const parsed = verifyTableCookie(token);
    expect(parsed).toEqual(payload);
  });

  it("rejects a tampered token", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() + 60_000 };
    const token = signTableCookie(payload);
    const [body] = token.split(".");
    const tampered = body + ".invalidsig";
    expect(verifyTableCookie(tampered)).toBeNull();
  });

  it("rejects an expired token", () => {
    const payload = { rid: "r1", tid: "t1", exp: Date.now() - 1_000 };
    const token = signTableCookie(payload);
    expect(verifyTableCookie(token)).toBeNull();
  });
});
