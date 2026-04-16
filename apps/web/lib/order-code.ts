import crypto from "node:crypto";

export const ORDER_CODE_REGEX = /^[A-HJ-NP-Z][0-9]{3}$/;

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // drop I and O

export function generateOrderCode(): string {
  const l = LETTERS[crypto.randomInt(0, LETTERS.length)]!;
  const n = String(crypto.randomInt(0, 1000)).padStart(3, "0");
  return `${l}${n}`;
}
