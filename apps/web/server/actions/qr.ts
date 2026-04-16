"use server";

import { requireMembership } from "@/lib/membership";
import { generateQrSheetPdf } from "@/server/services/qr";
import type { ActionResult } from "@/server/actions/auth";

export async function generateQrPdfAction(): Promise<ActionResult<{ base64: string; filename: string }>> {
  const { restaurantId } = await requireMembership();
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const baseUrl = raw.startsWith("http") ? raw : `https://${raw}`;
  const pdf = await generateQrSheetPdf(restaurantId, baseUrl);
  return {
    ok: true,
    data: { base64: pdf.toString("base64"), filename: `qr-tables-${Date.now()}.pdf` },
  };
}
