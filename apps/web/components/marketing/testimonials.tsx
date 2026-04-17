"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
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
      gsap.fromTo(
        statsRef.current!.children,
        { y: 30, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.12,
          ease: "power2.out",
          scrollTrigger: { trigger: statsRef.current, start: "top 85%", once: true },
        },
      );

      gsap.fromTo(
        ctaRef.current!,
        { scale: 0.9, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.7,
          ease: "back.out(1.4)",
          scrollTrigger: { trigger: ctaRef.current, start: "top 85%", once: true },
        },
      );
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
