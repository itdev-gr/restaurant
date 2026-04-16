"use client";

export type CartLine = { menuItemId: string; name: string; priceCents: number; qty: number; note?: string };
export type Cart = { tableId: string; lines: CartLine[] };

const KEY = (tableId: string) => `cart_${tableId}`;

export function readCart(tableId: string): Cart {
  if (typeof window === "undefined") return { tableId, lines: [] };
  try {
    const raw = window.localStorage.getItem(KEY(tableId));
    if (!raw) return { tableId, lines: [] };
    return JSON.parse(raw) as Cart;
  } catch {
    return { tableId, lines: [] };
  }
}

export function writeCart(cart: Cart) {
  window.localStorage.setItem(KEY(cart.tableId), JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent("cart-change"));
}

export function addLine(tableId: string, line: CartLine) {
  const cart = readCart(tableId);
  cart.lines.push(line);
  writeCart(cart);
}

export function updateLine(tableId: string, index: number, partial: Partial<CartLine>) {
  const cart = readCart(tableId);
  if (!cart.lines[index]) return;
  cart.lines[index] = { ...cart.lines[index], ...partial };
  if (cart.lines[index].qty <= 0) cart.lines.splice(index, 1);
  writeCart(cart);
}

export function removeLine(tableId: string, index: number) {
  const cart = readCart(tableId);
  cart.lines.splice(index, 1);
  writeCart(cart);
}

export function clearCart(tableId: string) {
  writeCart({ tableId, lines: [] });
}

export function cartTotalCents(cart: Cart) {
  return cart.lines.reduce((s, l) => s + l.priceCents * l.qty, 0);
}

export function cartCount(cart: Cart) {
  return cart.lines.reduce((s, l) => s + l.qty, 0);
}
