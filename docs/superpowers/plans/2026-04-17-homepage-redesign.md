# Homepage Redesign — Marketing Landing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare placeholder landing page with a professional marketing homepage featuring: top navbar with Login/Register links, hero section, 3-4 feature sections, and a footer. Mobile-first, using the existing brand palette + Inter font.

**Architecture:** Single-page static render (`app/page.tsx`) with reusable section components. Navbar is a shared component at the layout level for the marketing pages. Inter font added to root layout (matches customer pages). All Tailwind — no new deps.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Inter via `next/font/google`. No new packages.

---

## File Structure

```
apps/web/
├── app/
│   ├── layout.tsx                        # MODIFY — add Inter font to root layout
│   ├── page.tsx                          # REWRITE — full marketing homepage
│   └── (auth)/                           # existing — login/signup pages
├── components/
│   └── marketing/
│       ├── navbar.tsx                    # CREATE — sticky top nav with logo + Login/Register
│       ├── hero.tsx                      # CREATE — hero section with CTA
│       ├── features.tsx                  # CREATE — 3-column feature cards
│       ├── how-it-works.tsx             # CREATE — 3-step process section
│       ├── testimonials.tsx             # CREATE — social proof / stats section
│       └── footer.tsx                   # CREATE — footer with links + copyright
```

---

## Tasks

### Task 1: Add Inter font to root layout

**Files:**
- Modify: `apps/web/app/layout.tsx`

The customer layout already uses Inter but scoped to `/r/*`. The root layout needs it globally so the homepage + auth pages also use it.

- [ ] **Step 1: Update `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "greek"] });

export const metadata: Metadata = {
  title: "Restaurant Platform — QR-Code Dine-In Ordering",
  description:
    "Let your guests order from their phone. QR-code menus, real-time kitchen tickets, cash & card payments. Set up in 5 minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): add Inter font to root layout + SEO metadata"
```

---

### Task 2: Create the Navbar component

**Files:**
- Create: `apps/web/components/marketing/navbar.tsx`

Sticky transparent navbar that gets a white background on scroll. Logo on left, Login + Get Started on right. Mobile: hamburger not needed for 2 links — just show them inline.

- [ ] **Step 1: Create `apps/web/components/marketing/navbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b bg-white/90 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-xl font-bold text-slate-900">
          <span className="text-brand-500">●</span> RestaurantOS
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-500/25 transition hover:bg-brand-600 active:scale-[0.98]"
          >
            Get started free
          </Link>
        </div>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create marketing navbar with scroll effect"
```

---

### Task 3: Create the Hero section

**Files:**
- Create: `apps/web/components/marketing/hero.tsx`

Full-height hero with gradient background (matching brand), headline, subheadline, CTA button, and a mock phone/UI illustration (CSS-only — no images needed).

- [ ] **Step 1: Create `apps/web/components/marketing/hero.tsx`**

```tsx
import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 px-5 pb-20 pt-32">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <div className="mb-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            ✨ No app download needed — works in any browser
          </div>
          <h1 className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Turn every table into a{" "}
            <span className="text-yellow-300">digital ordering station</span>
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-white/80 sm:text-xl">
            Guests scan a QR code, browse your menu, and order instantly. 
            Kitchen and bar get real-time tickets. You get paid — cash or card.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/signup"
              className="rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-brand-600 shadow-xl transition hover:bg-slate-50 active:scale-[0.98]"
            >
              Start free — no credit card
            </Link>
            <a
              href="#how-it-works"
              className="rounded-xl border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              See how it works
            </a>
          </div>
        </div>

        {/* Mock phone preview */}
        <div className="mt-12 flex justify-center lg:absolute lg:right-0 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">
          <div className="w-64 rounded-[2rem] border-4 border-white/20 bg-white/10 p-3 shadow-2xl backdrop-blur-sm">
            <div className="rounded-[1.5rem] bg-white p-4">
              <div className="mb-3 h-3 w-20 rounded-full bg-brand-500/20" />
              <div className="mb-2 h-2 w-32 rounded-full bg-slate-200" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
                    <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-200 to-amber-100" />
                    <div className="flex-1">
                      <div className="h-2 w-16 rounded-full bg-slate-300" />
                      <div className="mt-1.5 h-2 w-10 rounded-full bg-brand-500/30" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 h-9 rounded-xl bg-brand-500" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create hero section with gradient + mock phone"
```

---

### Task 4: Create the Features section (3 cards)

**Files:**
- Create: `apps/web/components/marketing/features.tsx`

3-column grid of feature cards with icons, title, and description.

- [ ] **Step 1: Create `apps/web/components/marketing/features.tsx`**

```tsx
const FEATURES = [
  {
    icon: "📱",
    title: "QR-Code Menus",
    description:
      "Each table gets a unique QR code. Guests scan with their phone camera — no app download, no waiting for a server.",
  },
  {
    icon: "🍳",
    title: "Real-Time Kitchen Tickets",
    description:
      "Orders route instantly to the right station. Kitchen sees food, bar sees drinks, cashier sees everything.",
  },
  {
    icon: "💳",
    title: "Cash & Card Payments",
    description:
      "Accept cash or card via Stripe. Tax and service calculated automatically. Refunds in one click.",
  },
  {
    icon: "📊",
    title: "Reports & Insights",
    description:
      "Track revenue by day, see your top-selling items, and monitor payment splits — all from your dashboard.",
  },
  {
    icon: "👥",
    title: "Staff Management",
    description:
      "Invite kitchen, bar, and cashier staff. Each role sees only what they need — no confusion, no overlap.",
  },
  {
    icon: "🖨️",
    title: "Printable QR Sheets",
    description:
      "Download a ready-to-print A4 PDF with QR codes for all your tables. Cut, laminate, and you're live.",
  },
];

export function Features() {
  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Everything you need to go digital
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-500">
            From menu to payment to kitchen — one platform, zero friction.
          </p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create features section with 6 cards"
```

---

### Task 5: Create the How-It-Works section (3 steps)

**Files:**
- Create: `apps/web/components/marketing/how-it-works.tsx`

Numbered steps with connecting line: 1. Set up your menu → 2. Print QR codes → 3. Guests order & pay.

- [ ] **Step 1: Create `apps/web/components/marketing/how-it-works.tsx`**

```tsx
const STEPS = [
  {
    step: "1",
    title: "Set up your menu",
    description:
      "Create categories, add items with prices, and assign each to kitchen or bar. Takes about 5 minutes.",
  },
  {
    step: "2",
    title: "Print your QR codes",
    description:
      "Tell us how many tables you have. We generate a unique QR code for each one — download the PDF and print.",
  },
  {
    step: "3",
    title: "Guests order & pay",
    description:
      "Customers scan the QR, browse your menu, and place their order. Kitchen and bar get instant tickets.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500">
            No hardware. No installation. Just a browser.
          </p>
        </div>
        <div className="mt-14 space-y-12">
          {STEPS.map((s, i) => (
            <div key={s.step} className="flex gap-6">
              <div className="flex flex-col items-center">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-500 text-lg font-bold text-white shadow-lg shadow-brand-500/25">
                  {s.step}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="mt-2 w-0.5 flex-1 bg-brand-200" />
                )}
              </div>
              <div className="pb-2 pt-1">
                <h3 className="text-xl font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {s.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create how-it-works section with 3 steps"
```

---

### Task 6: Create the CTA + Stats section

**Files:**
- Create: `apps/web/components/marketing/testimonials.tsx`

Social proof stats + final CTA.

- [ ] **Step 1: Create `apps/web/components/marketing/testimonials.tsx`**

```tsx
import Link from "next/link";

const STATS = [
  { value: "5 min", label: "Setup time" },
  { value: "0€", label: "To get started" },
  { value: "24/7", label: "Ordering available" },
  { value: "∞", label: "Tables supported" },
];

export function Testimonials() {
  return (
    <section className="bg-white px-5 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-brand-500 sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-3xl bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Ready to modernize your restaurant?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-white/80 sm:text-base">
            Join restaurants that have replaced paper menus with instant QR ordering. Free to start, no credit card required.
          </p>
          <div className="mt-6">
            <Link
              href="/signup"
              className="inline-block rounded-xl bg-white px-8 py-4 text-sm font-bold text-brand-600 shadow-xl transition hover:bg-slate-50 active:scale-[0.98]"
            >
              Create your free account
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create stats + CTA section"
```

---

### Task 7: Create the Footer

**Files:**
- Create: `apps/web/components/marketing/footer.tsx`

Simple footer with links to product pages, legal, and copyright.

- [ ] **Step 1: Create `apps/web/components/marketing/footer.tsx`**

```tsx
import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">
              <span className="text-brand-500">●</span> RestaurantOS
            </div>
            <p className="mt-1 text-sm text-slate-500">
              QR-code dine-in ordering for modern restaurants.
            </p>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-900">
              Log in
            </Link>
            <Link href="/signup" className="hover:text-slate-900">
              Sign up
            </Link>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RestaurantOS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): create footer component"
```

---

### Task 8: Assemble the homepage

**Files:**
- Modify: `apps/web/app/page.tsx`

Wire all sections together.

- [ ] **Step 1: Rewrite `apps/web/app/page.tsx`**

```tsx
import { Navbar } from "@/components/marketing/navbar";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { Testimonials } from "@/components/marketing/testimonials";
import { Footer } from "@/components/marketing/footer";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Testimonials />
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Typecheck + build**

```bash
pnpm typecheck
pnpm -F @app/web build
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): assemble full marketing homepage"
```

---

### Task 9: Deploy + visual smoke test

- [ ] **Step 1: Push + deploy**

```bash
git push
npx -y vercel --prod --yes
```

- [ ] **Step 2: Visual smoke test**

Open https://restaurant-web-delta-nine.vercel.app/ on mobile viewport (390×844) and verify:
1. Navbar visible with "Log in" + "Get started free"
2. Hero section: gradient bg, headline, CTA buttons, mock phone preview
3. Features: 6 cards in 3-column grid (1 column on mobile)
4. How-It-Works: 3 numbered steps with connecting line
5. Stats: 4 big numbers
6. CTA: gradient card with "Create your free account"
7. Footer: logo + links + copyright
8. "Log in" link → /login, "Get started free" → /signup

---

## Acceptance Criteria

- [ ] Homepage loads with no errors
- [ ] Navbar has Login + Register (Get started free)
- [ ] Hero has compelling headline + 2 CTA buttons
- [ ] 3-4 content sections between hero and footer
- [ ] Footer with copyright
- [ ] Mobile-first responsive (looks good at 390px)
- [ ] Desktop responsive (looks good at 1280px+)
- [ ] All links work (/login, /signup, #how-it-works anchor)
- [ ] Inter font renders globally
- [ ] No regressions on admin or customer pages
