import { describe, it, expect } from "vitest";
import { generateOrderCode, ORDER_CODE_REGEX } from "@/lib/order-code";

describe("order-code", () => {
  it("returns a code matching LETTER + 3 digits", () => {
    for (let i = 0; i < 50; i++) {
      const c = generateOrderCode();
      expect(c).toMatch(ORDER_CODE_REGEX);
    }
  });

  it("produces different codes across invocations", () => {
    const set = new Set(Array.from({ length: 100 }, () => generateOrderCode()));
    expect(set.size).toBeGreaterThan(50);
  });

  it("never uses I or O letters (avoid 1/0 confusion)", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateOrderCode();
      expect(c[0]).not.toBe("I");
      expect(c[0]).not.toBe("O");
    }
  });
});
