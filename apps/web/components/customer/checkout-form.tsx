"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { readCart, cartTotalCents, clearCart, type Cart } from "@/lib/cart";
import { submitOrderAction } from "@/server/actions/order";
import { CardPaymentForm } from "./card-payment-form";

function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function CheckoutForm({
  slug,
  token,
  tableId,
}: {
  slug: string;
  token: string;
  tableId: string;
}) {
  const router = useRouter();
  const [cart, setCart] = useState<Cart | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<"cash" | "card" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCart(readCart(tableId));
    const update = () => setCart(readCart(tableId));
    window.addEventListener("cart-change", update);
    return () => window.removeEventListener("cart-change", update);
  }, [tableId]);

  if (!cart || cart.lines.length === 0) {
    return <div className="p-6 text-sm text-slate-500">Cart is empty.</div>;
  }

  const submitCash = () => {
    setError(null);
    startTransition(async () => {
      const r = await submitOrderAction(slug, token, {
        paymentMethod: "cash",
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

  // Card flow
  if (selectedMethod === "card") {
    return (
      <main className="space-y-4 p-4">
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="text-sm text-slate-600"
        >
          &larr; Change payment method
        </button>
        <CardPaymentForm slug={slug} token={token} tableId={tableId} />
      </main>
    );
  }

  // Cash flow processing
  if (selectedMethod === "cash") {
    return (
      <main className="space-y-4 p-4">
        <section className="rounded-lg border bg-white p-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold">&euro;{(total / 100).toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Final total including tax/service is calculated when you place the order.
          </p>
        </section>
        {error && (
          <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submitCash}
          disabled={pending}
          className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Placing order\u2026" : "Confirm \u2014 pay cash"}
        </button>
        <button
          type="button"
          onClick={() => setSelectedMethod(null)}
          className="w-full text-center text-sm text-slate-600"
        >
          &larr; Change payment method
        </button>
      </main>
    );
  }

  // Method selection
  return (
    <main className="space-y-4 p-4 pb-32">
      <section className="rounded-lg border bg-white p-4">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-semibold">&euro;{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Final total including tax/service is calculated when you place the order.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-700">Pay with</h2>
        <button
          type="button"
          onClick={() => setSelectedMethod("cash")}
          className="w-full rounded-lg border bg-white p-4 text-left shadow-sm hover:bg-slate-50"
        >
          <div className="font-semibold">Cash</div>
          <div className="text-xs text-slate-500">
            Pay your server when they bring the bill.
          </div>
        </button>
        <button
          type="button"
          onClick={() => setSelectedMethod("card")}
          className="w-full rounded-lg border bg-white p-4 text-left shadow-sm hover:bg-slate-50"
        >
          <div className="font-semibold">Card</div>
          <div className="text-xs text-slate-500">
            Pay securely with your credit or debit card.
          </div>
        </button>
      </section>
    </main>
  );
}
