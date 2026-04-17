"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { TicketCard } from "./ticket-card";

type Item = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  station: "kitchen" | "bar" | "both";
  status: "received" | "preparing" | "ready" | "served";
};

type Ticket = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: Item[];
  paymentMethod: string;
  totalCents: number;
  createdAt: string;
};

export function StationBoard({
  station,
  restaurantId,
  initialTickets,
}: {
  station: "kitchen" | "bar" | "cashier";
  restaurantId: string;
  initialTickets: Ticket[];
}) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    // Simple chime using Web Audio as a short beep
    audioRef.current = new Audio(
      "data:audio/wav;base64,UklGRl9vT19teleQlZWXl5aUkY6KhYF8d3=="
    );
  }, []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`restaurant:${restaurantId}:${station}`)
      .on("broadcast", { event: "order.new" }, ({ payload }) => {
        setTickets((prev) => [payload as Ticket, ...prev]);
        audioRef.current?.play().catch(() => {});
      })
      .on("broadcast", { event: "item.status" }, ({ payload }) => {
        const p = payload as { orderItemId: string; newStatus: string };
        setTickets((prev) =>
          prev.map((t) => ({
            ...t,
            items: t.items.map((i) =>
              i.id === p.orderItemId
                ? { ...i, status: p.newStatus as Item["status"] }
                : i,
            ),
          })),
        );
      })
      .on("broadcast", { event: "order.status" }, ({ payload }) => {
        const p = payload as { orderId: string; status?: string };
        if (p.status === "served" || p.status === "cancelled") {
          setTickets((prev) => prev.filter((t) => t.orderId !== p.orderId));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [restaurantId, station]);

  useEffect(() => {
    if (refreshKey === 0) return;
    // After local status update — state already updated via broadcast listener
  }, [refreshKey]);

  const active = tickets.filter((t) =>
    t.items.some((i) => i.status !== "served"),
  );

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold capitalize">{station}</h1>
        <span className="rounded-full bg-brand-500 px-3 py-1 text-sm font-medium text-white">
          {active.length} active
        </span>
      </div>
      {active.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed p-12 text-center text-lg text-slate-400">
          No pending orders. Waiting for new orders...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((t) => (
            <TicketCard key={t.orderId} ticket={t} onUpdated={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
