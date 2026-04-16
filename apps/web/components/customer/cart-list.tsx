"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  readCart, updateLine, removeLine, cartTotalCents, type Cart,
} from "@/lib/cart";

export function CartList({ slug, token }: { slug: string; token: string }) {
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);

  useEffect(() => {
    // The httpOnly table cookie isn't readable; find the table ID from any existing cart_* key.
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k?.startsWith("cart_")) {
        const id = k.slice("cart_".length);
        setTableId(id);
        setCart(readCart(id));
        break;
      }
    }
  }, []);

  useEffect(() => {
    if (!tableId) return;
    const update = () => setCart(readCart(tableId));
    window.addEventListener("cart-change", update);
    return () => window.removeEventListener("cart-change", update);
  }, [tableId]);

  if (!tableId || !cart || cart.lines.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-slate-500">
        Your cart is empty.{" "}
        <Link href={`/r/${slug}/t/${token}`} className="text-brand-600 underline">
          Back to menu
        </Link>
      </div>
    );
  }

  const total = cartTotalCents(cart);

  return (
    <main className="space-y-4 p-4 pb-28">
      <ul className="space-y-2">
        {cart.lines.map((l, i) => (
          <li key={i} className="flex items-start gap-3 rounded-lg border bg-white p-3">
            <div className="flex-1">
              <div className="font-medium">{l.name}</div>
              {l.note && <div className="text-xs text-slate-500">{l.note}</div>}
              <div className="mt-1 text-sm text-slate-700">
                €{(l.priceCents / 100).toFixed(2)} × {l.qty}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => updateLine(tableId, i, { qty: l.qty - 1 })}
                className="h-8 w-8 rounded-full border"
                aria-label="Decrease"
              >
                −
              </button>
              <span className="w-6 text-center">{l.qty}</span>
              <button
                onClick={() => updateLine(tableId, i, { qty: l.qty + 1 })}
                className="h-8 w-8 rounded-full border"
                aria-label="Increase"
              >
                +
              </button>
              <button
                onClick={() => removeLine(tableId, i)}
                className="ml-2 text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="fixed inset-x-0 bottom-0 border-t bg-white p-3 shadow-lg">
        <div className="mb-2 flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mb-3 text-xs text-slate-500">Tax and service are added at checkout.</p>
        <Link
          href={`/r/${slug}/t/${token}/checkout`}
          className="block rounded-md bg-brand-500 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-600"
        >
          Checkout
        </Link>
      </div>
    </main>
  );
}
