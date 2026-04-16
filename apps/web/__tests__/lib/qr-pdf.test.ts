import { describe, it, expect } from "vitest";
import { renderQrSheetPdf } from "@/lib/qr-pdf";

describe("renderQrSheetPdf", () => {
  it("returns a PDF buffer for a single table", async () => {
    const buf = await renderQrSheetPdf({
      restaurantName: "The Golden Fork",
      baseUrl: "https://example.com",
      slug: "the-golden-fork",
      tables: [{ number: 1, label: null, token: "abcDEF1234567890" }],
    });
    expect(buf.length).toBeGreaterThan(100);
    // PDF signature: %PDF-
    expect(buf[0]).toBe(0x25);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x44);
    expect(buf[3]).toBe(0x46);
  });

  it("paginates when more than 4 tables", async () => {
    const tables = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1, label: null, token: `tok${i.toString().padStart(13, "0")}`,
    }));
    const buf = await renderQrSheetPdf({
      restaurantName: "R", baseUrl: "https://example.com", slug: "r", tables,
    });
    expect(buf.length).toBeGreaterThan(2000);
  });
});
