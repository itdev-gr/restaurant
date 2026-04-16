"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCart, cartTotalCents, clearCart, type Cart } from "@/lib/cart";
import { submitOrderAction } from "@/server/actions/order";

function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function CheckoutForm({ slug, token }: { slug: string; token: string }) {
  const router = useRouter();
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  if (!cart || cart.lines.length === 0 || !tableId) {
    return <div className="p-6 text-sm text-slate-500">Cart is empty.</div>;
  }

  const submit = (paymentMethod: "cash" | "card") => {
    setError(null);
    startTransition(async () => {
      const r = await submitOrderAction({
        paymentMethod,
        items: cart.lines.map((l) => ({
          menuItemId: l.menuItemId,
          qty: l.qty,
          ...(l.note ? { note: l.note } : {}),
        })),
        idempotencyKey: uuid(),
      });
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      clearCart(tableId);
      router.replace(`/r/${slug}/t/${token}/order/${r.data.code}`);
    });
  };

  const total = cartTotalCents(cart);

  return (
    <main className="space-y-4 p-4 pb-32">
      <section className="rounded-lg border bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Final total including tax/service is calculated when you place the order.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Pay with</h2>
        <button
          type="button"
          onClick={() => submit("cash")}
          disabled={pending}
          className="w-full rounded-lg border bg-white p-4 text-left shadow-sm hover:bg-slate-50 disabled:opacity-50"
        >
          <div className="font-semibold">Cash</div>
          <div className="text-xs text-slate-500">Pay your server when they bring the bill.</div>
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed rounded-lg border bg-white p-4 text-left opacity-50"
          title="Card payment coming in Phase 3"
        >
          <div className="font-semibold">Card</div>
          <div className="text-xs text-slate-500">Coming soon.</div>
        </button>
      </section>

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {pending && <p className="text-sm text-slate-600">Placing order…</p>}
    </main>
  );
}
