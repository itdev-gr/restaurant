const STEPS = [
  { key: "received", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
] as const;

export function OrderStatus({
  status,
  paymentMethod,
  paymentStatus,
}: {
  status: "received" | "preparing" | "ready" | "served" | "cancelled";
  paymentMethod: "card" | "cash";
  paymentStatus: "unpaid" | "paid" | "refunded";
}) {
  const currentIdx = status === "cancelled"
    ? -1
    : STEPS.findIndex((s) => s.key === status);

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      {status === "cancelled" ? (
        <div className="text-center text-sm font-semibold text-red-600">
          This order was cancelled.
        </div>
      ) : (
        <div className="flex items-center justify-between px-2">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex flex-col items-center">
              <div className="relative flex items-center">
                {i > 0 && (
                  <div
                    className={`absolute right-full h-0.5 w-8 sm:w-12 ${
                      i <= currentIdx ? "bg-brand-500" : "bg-slate-200"
                    }`}
                  />
                )}
                <div
                  className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full ${
                    i <= currentIdx
                      ? "bg-brand-500 shadow-sm shadow-brand-500/30"
                      : "bg-slate-200"
                  }`}
                  aria-current={i === currentIdx ? "step" : undefined}
                >
                  {i < currentIdx && (
                    <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {i === currentIdx && (
                    <div className="h-2 w-2 rounded-full bg-white" />
                  )}
                </div>
              </div>
              <span
                className={`mt-2 text-[11px] font-medium ${
                  i <= currentIdx ? "text-slate-900" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
          {paymentMethod}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium">
          {paymentStatus}
        </span>
        {paymentMethod === "cash" && paymentStatus === "unpaid" && (
          <span className="text-orange-500">— pay your server</span>
        )}
      </div>
    </section>
  );
}
