# Homepage GSAP Animation Upgrade + New Pages

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the homepage with GSAP scroll-triggered animations (hero text reveal, staggered feature cards, step-by-step timeline, counting stats) and add a Pricing page + Contact page.

**Architecture:** GSAP + ScrollTrigger for scroll-based animations. Each marketing component gets a `useGSAP` hook with `ScrollTrigger.create()`. New pages at `/pricing` and `/contact` share the Navbar + Footer. All client components since GSAP needs DOM access.

**Tech Stack:** `gsap` (with ScrollTrigger plugin, free for non-commercial), existing Tailwind + Inter font.

---

## Tasks

### Task 1: Install GSAP + register ScrollTrigger

**Files:**
- Modify: `apps/web/package.json` (via pnpm add)
- Create: `apps/web/lib/gsap.ts` (register plugins once)

- [ ] **Step 1: Install GSAP**

```bash
pnpm -F @app/web add gsap
```

- [ ] **Step 2: Create `apps/web/lib/gsap.ts`**

```ts
"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

export { gsap, ScrollTrigger };
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): install gsap + register ScrollTrigger plugin"
```

---

### Task 2: Animate the Hero section

**Files:**
- Modify: `apps/web/components/marketing/hero.tsx`

Animations:
- Badge slides down + fades in (0.6s)
- Headline words reveal from bottom with stagger (0.8s)
- Subtext fades in (0.5s delay)
- CTA buttons scale up with stagger (0.8s delay)
- Phone mockup slides in from right + slight rotation (1s delay)

- [ ] **Step 1: Rewrite hero.tsx as client component with GSAP**

Read the current file first. Convert to `"use client"`, add `useEffect` + `useRef` for GSAP timeline. Keep all existing JSX structure — only add refs + animation.

```tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap";

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const phoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });

      tl.from(badgeRef.current, { y: -20, opacity: 0, duration: 0.6 })
        .from(headingRef.current, { y: 40, opacity: 0, duration: 0.8 }, "-=0.3")
        .from(subRef.current, { y: 20, opacity: 0, duration: 0.5 }, "-=0.4")
        .from(ctaRef.current!.children, {
          y: 20,
          opacity: 0,
          duration: 0.5,
          stagger: 0.15,
        }, "-=0.3")
        .from(phoneRef.current, {
          x: 80,
          opacity: 0,
          rotation: 5,
          duration: 1,
          ease: "power2.out",
        }, "-=0.8");
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 px-5 pb-20 pt-32">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <div ref={badgeRef} className="mb-4 inline-block rounded-full bg-white/15 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
            ✨ No app download needed — works in any browser
          </div>
          <h1 ref={headingRef} className="text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl">
            Turn every table into a{" "}
            <span className="text-yellow-300">digital ordering station</span>
          </h1>
          <p ref={subRef} className="mt-5 text-lg leading-relaxed text-white/80 sm:text-xl">
            Guests scan a QR code, browse your menu, and order instantly.
            Kitchen and bar get real-time tickets. You get paid — cash or card.
          </p>
          <div ref={ctaRef} className="mt-8 flex flex-wrap gap-4">
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

        <div ref={phoneRef} className="mt-12 flex justify-center lg:absolute lg:right-0 lg:top-1/2 lg:mt-0 lg:-translate-y-1/2">
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
git add -A && git commit -m "feat(web): GSAP hero animations — text reveal, CTA stagger, phone slide-in"
```

---

### Task 3: Animate Features section (staggered scroll reveal)

**Files:**
- Modify: `apps/web/components/marketing/features.tsx`

Cards fade up with stagger as they scroll into view.

- [ ] **Step 1: Convert to client component + add ScrollTrigger**

Read first. Add `"use client"`, `useEffect`, `useRef`. Wrap each card with a ref. Use `ScrollTrigger.batch()` for staggered entrance:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { gsap, ScrollTrigger } from "@/lib/gsap";

const FEATURES = [
  { icon: "📱", title: "QR-Code Menus", description: "Each table gets a unique QR code. Guests scan with their phone camera — no app download, no waiting for a server." },
  { icon: "🍳", title: "Real-Time Kitchen Tickets", description: "Orders route instantly to the right station. Kitchen sees food, bar sees drinks, cashier sees everything." },
  { icon: "💳", title: "Cash & Card Payments", description: "Accept cash or card via Stripe. Tax and service calculated automatically. Refunds in one click." },
  { icon: "📊", title: "Reports & Insights", description: "Track revenue by day, see your top-selling items, and monitor payment splits — all from your dashboard." },
  { icon: "👥", title: "Staff Management", description: "Invite kitchen, bar, and cashier staff. Each role sees only what they need — no confusion, no overlap." },
  { icon: "🖨️", title: "Printable QR Sheets", description: "Download a ready-to-print A4 PDF with QR codes for all your tables. Cut, laminate, and you're live." },
];

export function Features() {
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(headingRef.current!.children, {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.15,
        scrollTrigger: {
          trigger: headingRef.current,
          start: "top 85%",
          once: true,
        },
      });

      const cards = cardsRef.current!.children;
      gsap.from(cards, {
        y: 40,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
        scrollTrigger: {
          trigger: cardsRef.current,
          start: "top 80%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-white px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <div ref={headingRef} className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Everything you need to go digital
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-500">
            From menu to payment to kitchen — one platform, zero friction.
          </p>
        </div>
        <div ref={cardsRef} className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.description}</p>
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
git add -A && git commit -m "feat(web): GSAP staggered feature cards scroll reveal"
```

---

### Task 4: Animate How-It-Works (sequential step reveal + line draw)

**Files:**
- Modify: `apps/web/components/marketing/how-it-works.tsx`

Steps reveal one by one as user scrolls. Number circles scale up, text slides in.

- [ ] **Step 1: Convert to client + add scroll animation**

Read first. Add GSAP timeline triggered on scroll. Each step fades in sequentially:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

const STEPS = [
  { step: "1", title: "Set up your menu", description: "Create categories, add items with prices, and assign each to kitchen or bar. Takes about 5 minutes." },
  { step: "2", title: "Print your QR codes", description: "Tell us how many tables you have. We generate a unique QR code for each one — download the PDF and print." },
  { step: "3", title: "Guests order & pay", description: "Customers scan the QR, browse your menu, and place their order. Kitchen and bar get instant tickets." },
];

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const steps = stepsRef.current!.children;
      gsap.from(steps, {
        x: -30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.25,
        ease: "power2.out",
        scrollTrigger: {
          trigger: stepsRef.current,
          start: "top 75%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="how-it-works" className="bg-slate-50 px-5 py-20">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
            Up and running in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base text-slate-500">
            No hardware. No installation. Just a browser.
          </p>
        </div>
        <div ref={stepsRef} className="mt-14 space-y-12">
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
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.description}</p>
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
git add -A && git commit -m "feat(web): GSAP sequential step reveal on scroll"
```

---

### Task 5: Animate Stats section (counter animation + CTA scale)

**Files:**
- Modify: `apps/web/components/marketing/testimonials.tsx`

Stats count up when scrolling into view. CTA card scales in.

- [ ] **Step 1: Add counter animation + CTA entrance**

Read first. Convert to client component. For "5 min", "0€", "24/7", "∞" — animate the numeric ones with GSAP counter. For text-based ones, just fade in.

```tsx
"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap";

const STATS = [
  { value: "5 min", label: "Setup time" },
  { value: "0€", label: "To get started" },
  { value: "24/7", label: "Ordering available" },
  { value: "∞", label: "Tables supported" },
];

export function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(statsRef.current!.children, {
        y: 30,
        opacity: 0,
        duration: 0.5,
        stagger: 0.12,
        ease: "power2.out",
        scrollTrigger: {
          trigger: statsRef.current,
          start: "top 80%",
          once: true,
        },
      });

      gsap.from(ctaRef.current, {
        scale: 0.9,
        opacity: 0,
        duration: 0.7,
        ease: "back.out(1.4)",
        scrollTrigger: {
          trigger: ctaRef.current,
          start: "top 85%",
          once: true,
        },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-white px-5 py-20">
      <div className="mx-auto max-w-6xl">
        <div ref={statsRef} className="grid grid-cols-2 gap-6 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-brand-500 sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        <div ref={ctaRef} className="mt-16 rounded-3xl bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 p-8 text-center sm:p-12">
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
git add -A && git commit -m "feat(web): GSAP stat reveal + CTA scale-in on scroll"
```

---

### Task 6: Create Pricing page

**Files:**
- Create: `apps/web/app/pricing/page.tsx`

3-tier pricing: Free, Pro, Enterprise. Same Navbar + Footer layout as homepage.

- [ ] **Step 1: Create `apps/web/app/pricing/page.tsx`**

```tsx
import Link from "next/link";
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = { title: "Pricing — RestaurantOS" };

const PLANS = [
  {
    name: "Free",
    price: "€0",
    period: "forever",
    description: "Perfect for trying out",
    features: [
      "1 restaurant",
      "10 tables",
      "Unlimited orders",
      "Cash payments",
      "QR code generation",
      "Kitchen & bar boards",
    ],
    cta: "Get started free",
    href: "/signup",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "€29",
    period: "/month",
    description: "For growing restaurants",
    features: [
      "Everything in Free",
      "Unlimited tables",
      "Card payments (Stripe)",
      "Reports & analytics",
      "Staff management",
      "Priority support",
    ],
    cta: "Start Pro trial",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Multi-location chains",
    features: [
      "Everything in Pro",
      "Multiple locations",
      "Custom branding",
      "API access",
      "Dedicated support",
      "SLA guarantee",
    ],
    cta: "Contact us",
    href: "/contact",
    highlighted: false,
  },
];

export default function PricingPage() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-5 pb-20 pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
              Simple, transparent pricing
            </h1>
            <p className="mx-auto mt-4 max-w-lg text-base text-slate-500">
              Start free. Upgrade when you need more. No hidden fees.
            </p>
          </div>

          <div className="mt-14 grid gap-8 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl border p-8 ${
                  plan.highlighted
                    ? "border-brand-500 bg-white shadow-xl shadow-brand-500/10"
                    : "border-slate-200 bg-white shadow-sm"
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-500 px-4 py-1 text-xs font-bold text-white shadow-md">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-slate-900">{plan.price}</span>
                    {plan.period && (
                      <span className="text-sm text-slate-500">{plan.period}</span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                </div>
                <ul className="mb-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                      <svg
                        className="h-4 w-4 shrink-0 text-brand-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.href}
                  className={`block rounded-xl px-4 py-3 text-center text-sm font-semibold transition active:scale-[0.98] ${
                    plan.highlighted
                      ? "bg-brand-500 text-white shadow-lg shadow-brand-500/25 hover:bg-brand-600"
                      : "border-2 border-slate-200 text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): add pricing page with 3-tier plans"
```

---

### Task 7: Create Contact page

**Files:**
- Create: `apps/web/app/contact/page.tsx`

Simple contact page with email + message form (no backend — just mailto link or static display).

- [ ] **Step 1: Create `apps/web/app/contact/page.tsx`**

```tsx
import { Navbar } from "@/components/marketing/navbar";
import { Footer } from "@/components/marketing/footer";

export const metadata = { title: "Contact — RestaurantOS" };

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main className="bg-slate-50 px-5 pb-20 pt-32">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold text-slate-900">Get in touch</h1>
          <p className="mt-4 text-base text-slate-500">
            Have questions? We'd love to hear from you.
          </p>

          <div className="mt-12 space-y-6 text-left">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">📧 Email</h2>
              <p className="mt-2 text-sm text-slate-500">
                Send us an email and we'll get back to you within 24 hours.
              </p>
              <a
                href="mailto:hello@restaurantos.com"
                className="mt-3 inline-block text-sm font-semibold text-brand-600 hover:underline"
              >
                hello@restaurantos.com
              </a>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">💬 Live chat</h2>
              <p className="mt-2 text-sm text-slate-500">
                Available Monday to Friday, 9am — 6pm CET.
              </p>
              <p className="mt-3 text-sm text-slate-400">Coming soon</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">📍 Office</h2>
              <p className="mt-2 text-sm text-slate-500">
                Rhodes, Greece
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "feat(web): add contact page"
```

---

### Task 8: Add Pricing + Contact to Navbar and Footer

**Files:**
- Modify: `apps/web/components/marketing/navbar.tsx` — add "Pricing" link
- Modify: `apps/web/components/marketing/footer.tsx` — add Pricing + Contact links

- [ ] **Step 1: Update navbar**

Read first. Add a "Pricing" text link between the logo and the auth buttons:

In the nav `<div>`, add before the "Log in" link:

```tsx
<Link
  href="/pricing"
  className="hidden rounded-lg px-4 py-2 text-sm font-medium text-slate-700 transition hover:text-slate-900 sm:block"
>
  Pricing
</Link>
```

(Hidden on mobile to keep nav compact — only 2 auth links on small screens.)

- [ ] **Step 2: Update footer**

Read first. Add "Pricing" and "Contact" to the footer links:

```tsx
<div className="flex gap-6 text-sm text-slate-500">
  <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
  <Link href="/contact" className="hover:text-slate-900">Contact</Link>
  <Link href="/login" className="hover:text-slate-900">Log in</Link>
  <Link href="/signup" className="hover:text-slate-900">Sign up</Link>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat(web): add Pricing + Contact links to navbar and footer"
```

---

### Task 9: Build + deploy + visual smoke test

- [ ] **Step 1: Typecheck + build**

```bash
pnpm typecheck
pnpm -F @app/web build
```

Expected: all routes including `/pricing`, `/contact` in the build output.

- [ ] **Step 2: Push + deploy**

```bash
git push
# deploy from repo root
cd /Users/marios/Desktop/Cursor/restaurant
npx -y vercel link --yes --project restaurant-web
npx -y vercel --prod --yes
```

- [ ] **Step 3: Visual smoke test**

1. Open homepage — verify GSAP animations fire on load + scroll
2. Open /pricing — verify 3 pricing cards render
3. Open /contact — verify contact info renders
4. Verify nav "Pricing" link works on desktop
5. Verify footer has all 4 links

---

## Acceptance Criteria

- [ ] GSAP installed + ScrollTrigger registered
- [ ] Hero: text reveals, CTAs stagger, phone slides in on page load
- [ ] Features: cards stagger-fade-in on scroll
- [ ] How-It-Works: steps reveal sequentially on scroll
- [ ] Stats: fade-in on scroll, CTA scales in with spring
- [ ] `/pricing` page with 3 tiers (Free / Pro / Enterprise)
- [ ] `/contact` page with email + office info
- [ ] Navbar has "Pricing" link (desktop), footer has Pricing + Contact
- [ ] All animations use `once: true` (don't replay on scroll back)
- [ ] No regressions on admin or customer pages
