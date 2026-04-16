import { describe, it, expect } from "vitest";
import { generateTableToken, buildTableUrl, renderQrPng } from "@/lib/qr";

describe("qr", () => {
  it("generates a 16-char URL-safe token", () => {
    const a = generateTableToken();
    const b = generateTableToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(a).not.toBe(b);
  });

  it("builds a table URL", () => {
    expect(buildTableUrl("https://example.com", "the-fork", "abcDEF1234567890"))
      .toBe("https://example.com/r/the-fork/t/abcDEF1234567890");
  });

  it("trims trailing slash from baseUrl", () => {
    expect(buildTableUrl("https://example.com/", "x", "tok"))
      .toBe("https://example.com/r/x/t/tok");
  });

  it("renders a PNG buffer starting with the PNG magic number", async () => {
    const buf = await renderQrPng("https://example.com/r/x/t/y");
    expect(buf.length).toBeGreaterThan(100);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});
