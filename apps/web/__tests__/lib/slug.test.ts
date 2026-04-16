import { describe, it, expect, vi } from "vitest";
import { slugify, generateUniqueSlug } from "@/lib/slug";

describe("slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("The Golden Fork!")).toBe("the-golden-fork");
  });
  it("strips diacritics", () => {
    expect(slugify("Καφέ Λουκούμι")).toBe("kafe-loukoumi");
  });
  it("collapses runs and trims", () => {
    expect(slugify("  Hello -- World  ")).toBe("hello-world");
  });
});

describe("generateUniqueSlug", () => {
  it("returns base when free", async () => {
    const exists = vi.fn().mockResolvedValue(false);
    expect(await generateUniqueSlug("Cafe", exists)).toBe("cafe");
    expect(exists).toHaveBeenCalledWith("cafe");
  });
  it("appends -2, -3 until free", async () => {
    const taken = new Set(["cafe", "cafe-2"]);
    const exists = vi.fn(async (s: string) => taken.has(s));
    expect(await generateUniqueSlug("Cafe", exists)).toBe("cafe-3");
  });
});
