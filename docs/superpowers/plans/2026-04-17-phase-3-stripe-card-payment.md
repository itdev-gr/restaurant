# Restaurant Platform — Phase 3: Stripe Card Payment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Customer can pay by card via Stripe Payment Element. Webhook confirms payment. Admin can refund. Email receipt sent on successful card payment (stretch — can defer).

**Architecture:** On checkout, customer selects "Card" → enters name + email → client calls `createCardOrderAction(slug, token, cart)` → server creates Order (paymentStatus=unpaid) + Stripe PaymentIntent → returns `{orderCode, clientSecret}`. Client mounts Stripe Payment Element with `clientSecret`, customer completes payment. Stripe fires `payment_intent.succeeded` webhook → server flips `paymentStatus=paid`. Client redirects to order status page.

**Tech Stack additions:** `stripe` (server SDK), `@stripe/stripe-js` + `@stripe/react-stripe-js` (client). Webhook handler at `/api/webhooks/stripe`.

**Env vars needed (user provides later):**
- `STRIPE_SECRET_KEY` (sk_test_...)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_test_...)
- `STRIPE_WEBHOOK_SECRET` (whsec_...)

---

## Tasks

### Task 1: Install Stripe deps + lib helpers

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/lib/stripe.ts` (server-side Stripe client singleton)

- [ ] **Step 1: Install deps**

```bash
pnpm -F @app/web add stripe @stripe/stripe-js @stripe/react-stripe-js
```

- [ ] **Step 2: Create `apps/web/lib/stripe.ts`**

```ts
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  cached = new Stripe(key, { apiVersion: "2024-12-18.acacia" });
  return cached;
}
```

- [ ] **Step 3: Add env vars to `.env.example`**

Append to `apps/web/.env.example`:
```
# Stripe (test mode keys — get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

Add placeholder values to `apps/web/.env.local`:
```
STRIPE_SECRET_KEY="sk_test_placeholder"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_placeholder"
STRIPE_WEBHOOK_SECRET="whsec_placeholder"
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): install stripe deps + server-side Stripe client helper"
```

---

### Task 2: Card order service — create order + PaymentIntent

**Files:**
- Create: `apps/web/server/services/card-order.ts`
- Create: `apps/web/server/actions/card-order.ts`

The card flow reuses `createOrder` from Phase 2 but ALSO creates a Stripe PaymentIntent. The service:
1. Calls `createOrder(restaurantId, tableId, raw)` — creates order with paymentStatus=unpaid
2. Creates PaymentIntent with `amount=order.totalCents, currency=restaurant.currency`
3. Stores `stripePaymentIntentId` on the order
4. Returns `{ orderCode, clientSecret }`

- [ ] **Step 1: Create `apps/web/server/services/card-order.ts`**

```ts
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { createOrder } from "@/server/services/order";
import { resolveTableFromToken } from "@/server/services/table-session";
import type { ActionResult } from "@/server/actions/auth";

export async function createCardOrder(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ orderCode: string; clientSecret: string }>> {
  const resolved = await resolveTableFromToken(slug, token);
  if (!resolved.ok) return { ok: false, error: { code: "NO_SESSION", message: "Table not available." } };

  const orderResult = await createOrder(resolved.data.restaurantId, resolved.data.tableId, raw);
  if (!orderResult.ok) return orderResult;

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderResult.data.id },
    select: { id: true, code: true, totalCents: true, customerEmail: true },
  });

  const stripe = getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: order.totalCents,
    currency: resolved.data.restaurant.currency.toLowerCase(),
    metadata: {
      orderId: order.id,
      restaurantId: resolved.data.restaurantId,
      orderCode: order.code,
    },
    ...(order.customerEmail ? { receipt_email: order.customerEmail } : {}),
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { stripePaymentIntentId: pi.id },
  });

  return {
    ok: true,
    data: { orderCode: order.code, clientSecret: pi.client_secret! },
  };
}
```

- [ ] **Step 2: Create `apps/web/server/actions/card-order.ts`**

```ts
"use server";

import { createCardOrder } from "@/server/services/card-order";
import type { ActionResult } from "@/server/actions/auth";

export async function createCardOrderAction(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ orderCode: string; clientSecret: string }>> {
  return createCardOrder(slug, token, raw);
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): card order service — creates order + Stripe PaymentIntent"
```

---

### Task 3: Stripe webhook handler

**Files:**
- Create: `apps/web/app/api/webhooks/stripe/route.ts`

This Next.js Route Handler:
1. Reads raw body + `stripe-signature` header
2. Verifies via `stripe.webhooks.constructEvent`
3. Handles `payment_intent.succeeded` → update order paymentStatus=paid
4. Returns 200

- [ ] **Step 1: Create `apps/web/app/api/webhooks/stripe/route.ts`**

```ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) return NextResponse.json({ error: "webhook secret not configured" }, { status: 500 });

  let event: Stripe.Event;
  try {
    const buf = await req.arrayBuffer();
    event = stripe.webhooks.constructEvent(Buffer.from(buf), sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    return NextResponse.json({ error: `webhook verification failed: ${msg}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object as Stripe.PaymentIntent;
    await prisma.order.updateMany({
      where: { stripePaymentIntentId: pi.id },
      data: { paymentStatus: "paid", paidAt: new Date() },
    });
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    if (charge.payment_intent) {
      const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent.id;
      await prisma.order.updateMany({
        where: { stripePaymentIntentId: piId },
        data: { paymentStatus: "refunded" },
      });
    }
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Exclude webhook route from middleware auth**

The webhook route is called by Stripe's servers — no user session. Ensure `apps/web/middleware.ts` doesn't try to authenticate `/api/webhooks/*`. Check the `config.matcher` — the current pattern `["/((?!_next|api|favicon|.*\\..*).*)"]` already EXCLUDES `/api/` routes. Verify this. If it does, no change needed.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): stripe webhook handler for payment_intent.succeeded + charge.refunded"
```

---

### Task 4: Update checkout UI with Stripe Payment Element

**Files:**
- Modify: `apps/web/components/customer/checkout-form.tsx`
- Create: `apps/web/components/customer/card-payment-form.tsx`

The checkout page now has two paths:
- **Cash** — same as before (calls `submitOrderAction`)
- **Card** — shows name + email fields, then Stripe Payment Element. Calls `createCardOrderAction` to get `clientSecret`, mounts the Element, confirms payment client-side.

- [ ] **Step 1: Create `apps/web/components/customer/card-payment-form.tsx`**

```tsx
"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createCardOrderAction } from "@/server/actions/card-order";
import { clearCart, readCart, cartTotalCents, type Cart } from "@/lib/cart";
import { Field } from "@/components/ui/field";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CardForm({
  slug, token, clientSecret, orderCode, tableId,
}: {
  slug: string; token: string; clientSecret: string; orderCode: string; tableId: string;
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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={processing || !stripe}
        className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {processing ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}

function uuid() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function CardPaymentForm({
  slug, token,
}: { slug: string; token: string }) {
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

  if (clientSecret && orderCode) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="flex justify-between text-sm">
            <span>Subtotal</span>
            <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Tax and service included in final charge.</p>
        </div>
        <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
          <CardForm slug={slug} token={token} clientSecret={clientSecret} orderCode={orderCode} tableId={tableId} />
        </Elements>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-semibold">€{(total / 100).toFixed(2)}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">Tax and service included in final charge.</p>
      </div>
      <section className="space-y-3">
        <Field id="card-name" label="Name" error={undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" autoComplete="name" />
        </Field>
        <Field id="card-email" label="Email" error={undefined}>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" className="input" autoComplete="email" />
        </Field>
      </section>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={createIntent}
        disabled={pending}
        className="w-full rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Preparing payment…" : "Continue to payment"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Update `apps/web/components/customer/checkout-form.tsx`**

Replace the disabled Card button with a toggle that shows `CardPaymentForm`:

The checkout form now has two states:
- `paymentMethod === null` — show both Cash + Card buttons
- `paymentMethod === "cash"` — same as before (submit directly)
- `paymentMethod === "card"` — render `CardPaymentForm`

- [ ] **Step 3: Typecheck + build + commit**

```bash
pnpm typecheck
pnpm -F @app/web build
git add -A && git commit -m "feat(web): stripe card payment form with Payment Element"
```

---

### Task 5: Admin refund action

**Files:**
- Modify: `apps/web/server/actions/order-admin.ts` (add `refundOrderAction`)
- Modify: `apps/web/components/admin/orders-list.tsx` (add "Refund" button for card+paid orders)

- [ ] **Step 1: Add `refundOrderAction` to `server/actions/order-admin.ts`**

```ts
export async function refundOrderAction(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { restaurantId } = await requireMembership();
  const order = await prisma.order.findFirst({
    where: { id, restaurantId, paymentMethod: "card", paymentStatus: "paid" },
    select: { stripePaymentIntentId: true },
  });
  if (!order || !order.stripePaymentIntentId) {
    return { ok: false, error: { code: "NOT_FOUND", message: "Order not found or not refundable." } };
  }
  const stripe = getStripe();
  await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
  // Webhook will update paymentStatus to "refunded"
  return { ok: true, data: { id } };
}
```

- [ ] **Step 2: Add "Refund" button to orders-list.tsx**

Show a "Refund" button for orders where `paymentMethod === "card" && paymentStatus === "paid"`.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): admin refund action for card-paid orders"
```

---

### Task 6: Deploy + smoke test

- [ ] **Step 1: Add Stripe env vars to Vercel** (when user provides keys)

```bash
printf 'sk_test_...' | vercel env add STRIPE_SECRET_KEY production
printf 'pk_test_...' | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
printf 'whsec_...' | vercel env add STRIPE_WEBHOOK_SECRET production
```

- [ ] **Step 2: Push + deploy**

```bash
git push
npx -y vercel --prod --yes
```

- [ ] **Step 3: Register Stripe webhook endpoint**

In Stripe dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://restaurant-web-delta-nine.vercel.app/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `charge.refunded`
- Copy the webhook signing secret → add as `STRIPE_WEBHOOK_SECRET` env var

- [ ] **Step 4: Smoke test**

1. Customer scan QR → add item → checkout → select Card
2. Enter name + email → Continue to payment
3. Use Stripe test card `4242 4242 4242 4242`, any future exp, any CVC
4. Payment succeeds → order status shows "card · paid"
5. Admin /orders → order shows "card · paid" → click "Refund" → status updates to "refunded"

---

## Phase 3 Acceptance

- [ ] Card payment works end-to-end with test card
- [ ] Cash payment still works (regression check)
- [ ] Webhook correctly flips paymentStatus
- [ ] Admin can refund card orders
- [ ] 3DS flow works (test with card 4000 0025 0000 3155)
- [ ] All Phase 2 tests still pass
