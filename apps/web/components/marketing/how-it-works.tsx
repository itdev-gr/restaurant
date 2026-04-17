"use client";

import { useEffect, useRef } from "react";
import { gsap } from "@/lib/gsap";

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
  const sectionRef = useRef<HTMLElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        stepsRef.current!.children,
        { x: -30, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.25,
          ease: "power2.out",
          scrollTrigger: { trigger: stepsRef.current, start: "top 80%", once: true },
        },
      );
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
