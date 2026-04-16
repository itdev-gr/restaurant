import crypto from "node:crypto";
import QRCode from "qrcode";

export function generateTableToken(): string {
  // 12 random bytes → base64url is 16 chars (no padding)
  return crypto.randomBytes(12).toString("base64url");
}

export function buildTableUrl(baseUrl: string, slug: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/r/${slug}/t/${token}`;
}

export async function renderQrPng(url: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: size, margin: 2, errorCorrectionLevel: "M" });
}
