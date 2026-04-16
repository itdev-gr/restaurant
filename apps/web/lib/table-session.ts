import crypto from "node:crypto";

export const TABLE_COOKIE = "tableSession";
export const TABLE_COOKIE_MAX_AGE_SEC = 60 * 60 * 4; // 4 hours

export type TableCookiePayload = { rid: string; tid: string; exp: number };

function secret(): Buffer {
  const s = process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("NEXTAUTH_SECRET required for table session signing.");
  return Buffer.from(s);
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function hmac(body: string): string {
  return b64url(crypto.createHmac("sha256", secret()).update(body).digest());
}

export function signTableCookie(payload: TableCookiePayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  return `${body}.${hmac(body)}`;
}

export function verifyTableCookie(token: string | undefined | null): TableCookiePayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = hmac(body);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TableCookiePayload;
    if (!payload.rid || !payload.tid || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
