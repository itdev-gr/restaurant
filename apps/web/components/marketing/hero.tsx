import Link from "next/link";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-indigo-500 to-purple-600 px-5 pb-20 pt-32">
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
