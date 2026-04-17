"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

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
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        headingRef.current!.children,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.15,
          ease: "power2.out",
          scrollTrigger: { trigger: headingRef.current, start: "top 85%", once: true },
        },
      );

      gsap.fromTo(
        cardsRef.current!.children,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.1,
          ease: "power2.out",
          scrollTrigger: { trigger: cardsRef.current, start: "top 85%", once: true },
        },
      );
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
