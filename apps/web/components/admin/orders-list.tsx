"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
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

export function OrdersList({
  restaurantId,
  orders: initialOrders,
}: {
  restaurantId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [pending, startTransition] = useTransition();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRl9vT19teleQlZWXl5aUkY6KhYF8d3==",
    );
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`restaurant:${restaurantId}:cashier`)
      .on("broadcast", { event: "order.new" }, ({ payload }) => {
        const newOrder = payload as {
          orderId: string;
          orderCode: string;
          tableNumber: number;
          tableLabel: string | null;
          items: { id: string; name: string; qty: number; note: string | null; station: "kitchen" | "bar" | "both"; status: string }[];
          paymentMethod: string;
          totalCents: number;
          createdAt: string;
        };
        setOrders((prev) => [
          {
            id: newOrder.orderId,
            code: newOrder.orderCode,
            status: "received" as OrderStatus,
            paymentMethod: newOrder.paymentMethod as "card" | "cash",
            paymentStatus: "unpaid",
            total: newOrder.totalCents,
            createdAt: newOrder.createdAt,
            tableLabel: newOrder.tableLabel ?? `Table ${newOrder.tableNumber}`,
            items: newOrder.items.map((it) => ({
              id: it.id,
              qty: it.qty,
              name: it.name,
              station: it.station,
              note: it.note,
              status: it.status,
            })),
          },
          ...prev,
        ]);
        audioRef.current?.play().catch(() => {});
      })
      .on("broadcast", { event: "item.status" }, ({ payload }) => {
        const p = payload as { orderItemId: string; newStatus: string };
        setOrders((prev) =>
          prev.map((o) => ({
            ...o,
            items: o.items.map((i) =>
              i.id === p.orderItemId ? { ...i, status: p.newStatus } : i,
            ),
          })),
        );
      })
      .on("broadcast", { event: "order.status" }, ({ payload }) => {
        const p = payload as { orderId: string; status?: string; paymentStatus?: string };
        setOrders((prev) =>
          prev.map((o) =>
            o.id === p.orderId
              ? {
                  ...o,
                  ...(p.status ? { status: p.status as OrderStatus } : {}),
                  ...(p.paymentStatus ? { paymentStatus: p.paymentStatus as Order["paymentStatus"] } : {}),
                }
              : o,
          ),
        );
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId]);

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
        No orders yet. Waiting for new orders…
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
