"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { createCardOrderAction } from "@/server/actions/card-order";
import { clearCart, readCart, cartTotalCents, type Cart } from "@/lib/cart";
import { Field } from "@/components/ui/field";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function InnerCardForm({
  slug,
  token,
  orderCode,
  tableId,
}: {
  slug: string;
  token: string;
  orderCode: string;
  tableId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/r/${slug}/t/${token}/order/${orderCode}`,
      },
      redirect: "if_required",
    });
    if (stripeError) {
      setError(stripeError.message ?? "Payment failed.");
      setProcessing(false);
      return;
    }
    clearCart(tableId);
    router.replace(`/r/${slug}/t/${token}/order/${orderCode}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {processing ? "Processing\u2026" : "Pay now"}
      </button>
    </form>
  );
}

export function CardPaymentForm({
  slug,
  token,
}: {
  slug: string;
  token: string;
}) {
  const [tableId, setTableId] = useState<string | null>(null);
  const [cart, setCart] = useState<Cart | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderCode, setOrderCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    return <div className="p-4 text-sm text-slate-500">Cart is empty.</div>;
  }

  const total = cartTotalCents(cart);

  const createIntent = () => {
    if (!name.trim() || !email.trim()) {
      setError("Name and email are required for card payment.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await createCardOrderAction(slug, token, {
        paymentMethod: "card",
        customerName: name.trim(),
        customerEmail: email.trim(),
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
      setClientSecret(r.data.clientSecret);
      setOrderCode(r.data.orderCode);
    });
  };

  // Step 2: Payment Element mounted
  if (clientSecret && orderCode) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-semibold">
              \u20AC{(total / 100).toFixed(2)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Tax and service included in final charge.
          </p>
        </div>
        <Elements
          stripe={stripePromise}
          options={{ clientSecret, appearance: { theme: "stripe" } }}
        >
          <InnerCardForm
            slug={slug}
            token={token}
            orderCode={orderCode}
            tableId={tableId}
          />
        </Elements>
      </div>
    );
  }

  // Step 1: Name + email
  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">\u20AC{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Tax and service included in final charge.
        </p>
      </div>
      <section className="space-y-3">
        <Field id="card-name" label="Name" error={undefined}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
            autoComplete="name"
          />
        </Field>
        <Field id="card-email" label="Email" error={undefined}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="input"
            autoComplete="email"
          />
        </Field>
      </section>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={createIntent}
        disabled={pending}
        className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Preparing payment\u2026" : "Continue to payment"}
      </button>
    </div>
  );
}
