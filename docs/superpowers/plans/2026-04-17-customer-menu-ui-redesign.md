# Customer Menu UI Redesign — Mobile-First Professional Design

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the customer-facing menu pages (QR scan → menu → cart → checkout → order status) from basic functional UI into a polished, professional mobile-first experience comparable to Uber Eats / Wolt / Deliveroo.

**Architecture:** Pure Tailwind CSS styling + component restructuring. No server-side changes. No new dependencies. Google Font (Inter) loaded via Next.js built-in font optimization.

**Tech Stack:** Tailwind CSS, Next.js `next/font/google`, existing components.

---

## Design Decisions

- **Font**: Inter via `next/font/google` — clean, modern, excellent for UI
- **Color palette**: Keep brand-500 (#5b6cff) as accent. Warm up neutrals with slate. Add a subtle gradient header.
- **Item cards**: Horizontal layout with image placeholder (colored gradient when no image), name, description, price. Large touch targets (min 48px).
- **Category tabs**: Pill style with smooth scroll, larger touch targets, active state with brand color fill
- **Item sheet**: Drag handle indicator, rounded corners, smooth entrance, better spacing
- **Cart bar**: Floating pill with rounded corners, subtle shadow, count badge
- **Overall**: Generous whitespace, 16px base text, warm shadows, smooth transitions

---

## Tasks

### Task 1: Add Inter font + customer layout polish

**Files:**
- Modify: `apps/web/app/r/[slug]/t/[token]/layout.tsx`
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Update customer layout with Inter font**

```tsx
// apps/web/app/r/[slug]/t/[token]/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin", "greek"] });

export const metadata: Metadata = {
  title: "Order",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} min-h-screen bg-slate-50`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add CSS transitions + customer utilities to globals.css**

Append to `apps/web/app/globals.css`:

```css
@layer components {
  .customer-card {
    @apply rounded-2xl border border-slate-100 bg-white p-0 shadow-sm transition-shadow active:shadow-md;
  }
  .customer-header-gradient {
    background: linear-gradient(135deg, #5b6cff 0%, #8b5cf6 100%);
  }
  .slide-up-enter {
    animation: slideUp 0.3s ease-out;
  }
}

@keyframes slideUp {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(ui): add Inter font + customer layout with warm bg + transitions"
```

---

### Task 2: Redesign the menu page header

**Files:**
- Modify: `apps/web/app/r/[slug]/t/[token]/page.tsx`

Replace the plain header with a branded gradient header showing restaurant name + table badge.

- [ ] **Step 1: Rewrite page.tsx with new header**

```tsx
// apps/web/app/r/[slug]/t/[token]/page.tsx
import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { listCategories } from "@/server/services/category";
import { listItems } from "@/server/services/menu-item";
import { MenuCategories } from "@/components/customer/menu-categories";
import { MenuItemList } from "@/components/customer/menu-item-list";
import { CartBar } from "@/components/customer/cart-bar";

export const dynamic = "force-dynamic";

export default async function CustomerMenuPage({
  params, searchParams,
}: {
  params: { slug: string; token: string };
  searchParams: { category?: string };
}) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();

  const categories = await listCategories(resolved.data.restaurantId);
  const activeId = searchParams.category ?? categories[0]?.id ?? null;
  const items = activeId
    ? await listItems(resolved.data.restaurantId, { categoryId: activeId })
    : [];

  return (
    <>
      {/* Branded header */}
      <header className="customer-header-gradient px-5 pb-5 pt-safe-top">
        <div className="flex items-center justify-between pt-4">
          <div>
            <h1 className="text-xl font-bold text-white">{resolved.data.restaurant.name}</h1>
            <p className="mt-0.5 text-sm text-white/70">Browse our menu</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 backdrop-blur-sm">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
            </svg>
            <span className="text-sm font-semibold text-white">
              {resolved.data.table.label ?? `Table ${resolved.data.table.number}`}
            </span>
          </div>
        </div>
      </header>

      {/* Category tabs */}
      <MenuCategories
        slug={params.slug}
        token={params.token}
        categories={categories}
        activeId={activeId}
      />

      {/* Item list */}
      <main className="px-4 pb-28 pt-4">
        {items.filter((i) => i.isAvailable).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="text-4xl">🍽️</div>
            <p className="text-sm text-slate-500">No items in this category yet.</p>
          </div>
        ) : (
          <MenuItemList
            items={items.filter((i) => i.isAvailable)}
            currency={resolved.data.restaurant.currency}
          />
        )}
      </main>

      {/* Cart bar */}
      <CartBar
        slug={params.slug}
        token={params.token}
        tableId={resolved.data.tableId}
        currency={resolved.data.restaurant.currency}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): branded gradient header with table badge on customer menu"
```

---

### Task 3: Redesign category tabs

**Files:**
- Modify: `apps/web/components/customer/menu-categories.tsx`

Larger pills, brand-colored active state, smooth horizontal scroll with no scrollbar, better spacing.

- [ ] **Step 1: Rewrite menu-categories.tsx**

```tsx
import Link from "next/link";

type Cat = { id: string; name: string };

export function MenuCategories({
  slug, token, categories, activeId,
}: { slug: string; token: string; categories: Cat[]; activeId: string | null }) {
  if (categories.length === 0) return null;
  return (
    <div className="sticky top-0 z-10 bg-white shadow-sm">
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/r/${slug}/t/${token}?category=${c.id}`}
            scroll={false}
            className={`inline-flex shrink-0 items-center rounded-full px-4 py-2 text-sm font-medium transition-all ${
              activeId === c.id
                ? "bg-brand-500 text-white shadow-md shadow-brand-500/25"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
```

Add to `globals.css`:
```css
@layer utilities {
  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .pt-safe-top { padding-top: env(safe-area-inset-top, 0px); }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): polished category tabs with brand active state + hidden scrollbar"
```

---

### Task 4: Redesign menu item cards

**Files:**
- Modify: `apps/web/components/customer/menu-item-list.tsx`

Horizontal card layout with image placeholder (gradient square), better typography, subtle interaction.

- [ ] **Step 1: Rewrite menu-item-list.tsx**

```tsx
"use client";

import { useState } from "react";
import { ItemSheet } from "./item-sheet";
import { addLine } from "@/lib/cart";

type Item = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  images: { id: string; path: string; sortOrder: number }[];
};

const GRADIENTS = [
  "from-orange-200 to-amber-100",
  "from-sky-200 to-cyan-100",
  "from-violet-200 to-purple-100",
  "from-rose-200 to-pink-100",
  "from-emerald-200 to-teal-100",
  "from-indigo-200 to-blue-100",
];

function hashIndex(str: string, max: number) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h) % max;
}

export function MenuItemList({
  items, currency,
}: { items: Item[]; currency: string }) {
  const [open, setOpen] = useState<Item | null>(null);
  return (
    <>
      <div className="space-y-3">
        {items.map((item) => {
          const grad = GRADIENTS[hashIndex(item.id, GRADIENTS.length)]!;
          return (
            <button
              key={item.id}
              onClick={() => setOpen(item)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3 text-left shadow-sm transition-all active:scale-[0.98] active:shadow-md"
            >
              {/* Image placeholder */}
              <div
                className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${grad}`}
              >
                <span className="text-2xl">
                  {item.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
              {/* Content */}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <h3 className="truncate font-semibold text-slate-900">{item.name}</h3>
                {item.description && (
                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {item.description}
                  </p>
                )}
                <div className="mt-auto pt-1 text-sm font-bold text-brand-600">
                  {currency} {(item.priceCents / 100).toFixed(2)}
                </div>
              </div>
              {/* Add indicator */}
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-500">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
      {open && (
        <ItemSheet
          item={open}
          currency={currency}
          onClose={() => setOpen(null)}
          onAdd={(qty, note) => {
            const tableId =
              (document.querySelector("[data-table-id]") as HTMLElement | null)?.dataset["tableId"];
            if (!tableId) return;
            addLine(tableId, {
              menuItemId: open.id,
              name: open.name,
              priceCents: open.priceCents,
              qty,
              ...(note ? { note } : {}),
            });
            setOpen(null);
          }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): horizontal item cards with gradient placeholders + add button"
```

---

### Task 5: Redesign item bottom sheet

**Files:**
- Modify: `apps/web/components/customer/item-sheet.tsx`

Drag handle indicator, gradient header, better qty controls, polished add button.

- [ ] **Step 1: Rewrite item-sheet.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string; description: string | null; priceCents: number };

export function ItemSheet({
  item, currency, onClose, onAdd,
}: {
  item: Item;
  currency: string;
  onClose: () => void;
  onAdd: (qty: number, note?: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const total = (item.priceCents * qty) / 100;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="slide-up-enter w-full max-w-lg rounded-t-3xl bg-white pb-safe-bottom shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="space-y-5 px-5 pb-6">
          {/* Title + description */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
            {item.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {item.description}
              </p>
            )}
            <div className="mt-2 text-lg font-bold text-brand-600">
              {currency} {(item.priceCents / 100).toFixed(2)}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 text-xl font-medium text-slate-600 transition-colors active:bg-slate-100"
              aria-label="Decrease"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-50 text-xl font-medium text-brand-600 transition-colors active:bg-brand-100"
              aria-label="Increase"
            >
              +
            </button>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Special instructions
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="e.g. no onions, extra sauce"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-600 transition-colors active:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onAdd(qty, note.trim() || undefined)}
              className="flex-[2] rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all active:scale-[0.98] active:bg-brand-600"
            >
              Add to order — {currency} {total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

Add to `globals.css`:
```css
@layer utilities {
  .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): polished item bottom sheet with drag handle + brand qty controls"
```

---

### Task 6: Redesign cart bar

**Files:**
- Modify: `apps/web/components/customer/cart-bar.tsx`

Floating pill with rounded corners, count badge, branded gradient.

- [ ] **Step 1: Rewrite cart-bar.tsx**

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartCount, cartTotalCents, readCart } from "@/lib/cart";

export function CartBar({
  slug, token, tableId, currency,
}: { slug: string; token: string; tableId: string; currency: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const update = () => {
      const cart = readCart(tableId);
      setCount(cartCount(cart));
      setTotal(cartTotalCents(cart));
    };
    update();
    const onChange = () => update();
    window.addEventListener("cart-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cart-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [tableId]);

  if (count === 0) return <span data-table-id={tableId} className="hidden" />;

  return (
    <div data-table-id={tableId} className="fixed inset-x-0 bottom-0 z-20 p-4 pb-safe-bottom">
      <Link
        href={`/r/${slug}/t/${token}/cart`}
        className="flex items-center justify-between rounded-2xl bg-brand-500 px-5 py-4 shadow-xl shadow-brand-500/30 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {count}
          </span>
          <span className="text-sm font-semibold text-white">View order</span>
        </div>
        <span className="text-sm font-bold text-white">
          {currency} {(total / 100).toFixed(2)}
        </span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(ui): floating cart pill with count badge + shadow"
```

---

### Task 7: Polish cart, checkout, and order status pages

**Files:**
- Modify: `apps/web/app/r/[slug]/t/[token]/cart/page.tsx`
- Modify: `apps/web/components/customer/cart-list.tsx`
- Modify: `apps/web/app/r/[slug]/t/[token]/checkout/page.tsx`
- Modify: `apps/web/app/r/[slug]/t/[token]/order/[code]/page.tsx`
- Modify: `apps/web/components/customer/order-status.tsx`

Apply consistent design language: rounded-2xl cards, Inter font (inherited), warm shadows, brand colors, better spacing. Keep the business logic identical — only change Tailwind classes and layout.

Key changes:
- Cart page: rounded cards for line items, larger touch targets for ± buttons, branded checkout button
- Checkout page: payment method cards with icons, consistent card style
- Order status: better timeline with connecting lines, branded dots, larger text
- All pages: consistent header style with back arrow, same bg-slate-50 base

- [ ] **Step 1: Rewrite cart page header**

Update `apps/web/app/r/[slug]/t/[token]/cart/page.tsx` — use `Link` instead of `<a>`, match the new header style.

- [ ] **Step 2: Polish cart-list.tsx**

Update `apps/web/components/customer/cart-list.tsx`:
- Use `rounded-2xl` cards
- Larger ± buttons (h-10 w-10 with rounded-xl)
- Brand-colored checkout button with shadow
- Better empty state

- [ ] **Step 3: Polish checkout page**

Update `apps/web/app/r/[slug]/t/[token]/checkout/page.tsx` — consistent header.
Update `apps/web/components/customer/checkout-form.tsx` — payment method cards with subtle icons (💵 for cash, 💳 for card).

- [ ] **Step 4: Polish order status page**

Update `apps/web/app/r/[slug]/t/[token]/order/[code]/page.tsx` — branded header with order code badge.
Update `apps/web/components/customer/order-status.tsx` — timeline with connecting lines between dots, larger dots, better label typography.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat(ui): polish cart, checkout, and order status pages"
```

---

### Task 8: Build + deploy + visual smoke test

- [ ] **Step 1: Typecheck + build**

```bash
pnpm typecheck
pnpm -F @app/web build
```

- [ ] **Step 2: Push + deploy**

```bash
git push
npx -y vercel --prod --yes
```

- [ ] **Step 3: Visual smoke test with Playwright**

Open the customer QR URL and take screenshots of:
1. Menu page (header + categories + items)
2. Item sheet (bottom sheet open)
3. Cart page
4. Checkout page
5. Order status page

Verify all pages render correctly on mobile viewport.

---

## Acceptance Criteria

- [ ] Menu header shows restaurant name + table badge in branded gradient
- [ ] Category tabs are pill-shaped with brand-500 active state
- [ ] Item cards show horizontal layout with gradient image placeholder + name + description + price + add button
- [ ] Item sheet has drag handle, branded qty controls, slide-up animation
- [ ] Cart bar is a floating rounded pill with count badge
- [ ] All pages use Inter font
- [ ] All pages have consistent rounded-2xl card style
- [ ] No business logic regressions (cash order flow still works)
- [ ] All existing tests pass
