const STEPS = [
  { key: "received", label: "Received" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "served", label: "Served" },
] as const;

export function OrderStatus({
  status, paymentMethod, paymentStatus,
}: {
  status: "received" | "preparing" | "ready" | "served" | "cancelled";
  paymentMethod: "card" | "cash";
  paymentStatus: "unpaid" | "paid" | "refunded";
}) {
  const currentIdx = status === "cancelled" ? -1 : STEPS.findIndex((s) => s.key === status);
  return (
    <section className="rounded-lg border bg-white p-4">
      {status === "cancelled" ? (
        <div className="text-center text-sm font-medium text-red-600">This order was cancelled.</div>
      ) : (
        <ol className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-1 flex-col items-center">
              <div
                className={`h-3 w-3 rounded-full ${i <= currentIdx ? "bg-brand-500" : "bg-slate-200"}`}
                aria-current={i === currentIdx ? "step" : undefined}
              />
              <span
                className={`mt-1 text-[11px] ${i <= currentIdx ? "text-slate-900" : "text-slate-400"}`}
              >
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 text-center text-xs text-slate-500">
        Payment: {paymentMethod} · {paymentStatus}
        {paymentMethod === "cash" && paymentStatus === "unpaid" && " — pay your server"}
      </div>
    </section>
  );
}
