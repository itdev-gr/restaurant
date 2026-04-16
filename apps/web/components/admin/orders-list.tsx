"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrderStatusAction, markOrderPaidAction, refundOrderAction } from "@/server/actions/order-admin";

type OrderStatus = "received" | "preparing" | "ready" | "served" | "cancelled";

type Order = {
  id: string;
  code: string;
  status: OrderStatus;
  paymentMethod: "card" | "cash";
  paymentStatus: "unpaid" | "paid" | "refunded";
  total: number;
  createdAt: string;
  tableLabel: string;
  items: {
    id: string;
    qty: number;
    name: string;
    station: "kitchen" | "bar" | "both";
    note: string | null;
    status: string;
  }[];
};

const NEXT: Record<OrderStatus, OrderStatus | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
  cancelled: null,
};

export function OrdersList({ orders }: { orders: Order[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const advance = (id: string, status: OrderStatus) => {
    const next = NEXT[status];
    if (!next) return;
    startTransition(async () => {
      await setOrderStatusAction(id, next);
      router.refresh();
    });
  };

  const markPaid = (id: string) => {
    startTransition(async () => {
      await markOrderPaidAction(id);
      router.refresh();
    });
  };

  const refund = (id: string) => {
    if (!confirm("Refund this order? This cannot be undone.")) return;
    startTransition(async () => {
      await refundOrderAction(id);
      router.refresh();
    });
  };

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        No orders yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-mono text-sm font-semibold">{o.code}</div>
              <div className="text-xs text-slate-500">
                {o.tableLabel} · {new Date(o.createdAt).toLocaleTimeString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold">€{(o.total / 100).toFixed(2)}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500">
                {o.paymentMethod} · {o.paymentStatus}
              </div>
            </div>
          </div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {o.items.map((it) => (
              <li key={it.id} className="flex justify-between">
                <span>
                  {it.qty}× {it.name}
                  {it.note ? ` — ${it.note}` : ""}
                </span>
                <span className="text-[10px] uppercase text-slate-500">{it.station}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">{o.status}</span>
            {NEXT[o.status] && (
              <button
                disabled={pending}
                onClick={() => advance(o.id, o.status)}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Mark {NEXT[o.status]}
              </button>
            )}
            {o.paymentStatus === "unpaid" && (
              <button
                disabled={pending}
                onClick={() => markPaid(o.id)}
                className="rounded-md border px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-50"
              >
                Mark paid
              </button>
            )}
            {o.paymentMethod === "card" && o.paymentStatus === "paid" && (
              <button
                disabled={pending}
                onClick={() => refund(o.id)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                Refund
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
