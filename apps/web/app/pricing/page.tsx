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
