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
      <div className="flex flex-col items-center gap-3 p-8 py-16 text-center">
        <div className="text-4xl">🛒</div>
        <p className="text-sm text-slate-500">Your cart is empty.</p>
        <Link
          href={`/r/${slug}/t/${token}`}
          className="text-sm font-medium text-brand-600 underline"
        >
          Back to menu
        </Link>
      </div>
    );
  }

  const total = cartTotalCents(cart);

  return (
    <main className="space-y-3 p-4 pb-44">
      {cart.lines.map((l, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
        >
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-slate-900">{l.name}</div>
            {l.note && (
              <div className="mt-0.5 text-xs text-slate-500">{l.note}</div>
            )}
            <div className="mt-1.5 text-sm font-bold text-brand-600">
              €{(l.priceCents / 100).toFixed(2)} × {l.qty}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateLine(tableId, i, { qty: l.qty - 1 })}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-200 text-lg transition-colors active:bg-slate-100"
              aria-label="Decrease"
            >
              −
            </button>
            <span className="w-6 text-center font-semibold">{l.qty}</span>
            <button
              onClick={() => updateLine(tableId, i, { qty: l.qty + 1 })}
              className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-brand-500 bg-brand-50 text-lg text-brand-600 transition-colors active:bg-brand-100"
              aria-label="Increase"
            >
              +
            </button>
          </div>
          <button
            onClick={() => removeLine(tableId, i)}
            className="ml-1 p-1 text-slate-400 transition-colors hover:text-red-500"
            aria-label="Remove"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ))}

      <div className="fixed inset-x-0 bottom-0 z-10 border-t bg-white/95 p-4 pb-safe-bottom backdrop-blur-sm">
        <div className="mb-1 flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-bold text-slate-900">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mb-3 text-xs text-slate-400">Tax and service added at checkout.</p>
        <Link
          href={`/r/${slug}/t/${token}/checkout`}
          className="block rounded-2xl bg-brand-500 px-4 py-4 text-center text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all active:scale-[0.98]"
        >
          Continue to checkout
        </Link>
      </div>
    </main>
  );
}
