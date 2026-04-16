"use client";

import { useTransition } from "react";
import { updateItemStatusAction } from "@/server/actions/station";

type Item = {
  id: string;
  name: string;
  qty: number;
  note: string | null;
  status: "received" | "preparing" | "ready" | "served";
};

type Ticket = {
  orderId: string;
  orderCode: string;
  tableNumber: number;
  tableLabel: string | null;
  items: Item[];
  createdAt: string;
};

const NEXT_STATUS: Record<string, "preparing" | "ready" | "served" | null> = {
  received: "preparing",
  preparing: "ready",
  ready: "served",
  served: null,
};

const LABEL: Record<string, string> = {
  preparing: "Start",
  ready: "Ready",
  served: "Served",
};

export function TicketCard({
  ticket,
  onUpdated,
}: {
  ticket: Ticket;
  onUpdated: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const elapsed = Math.floor(
    (Date.now() - new Date(ticket.createdAt).getTime()) / 60_000,
  );

  const advanceItem = (itemId: string, currentStatus: string) => {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;
    startTransition(async () => {
      await updateItemStatusAction(itemId, next);
      onUpdated();
    });
  };

  const allServed = ticket.items.every((i) => i.status === "served");
  if (allServed) return null;

  return (
    <div className="rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <span className="font-mono text-lg font-bold">{ticket.orderCode}</span>
          <span className="ml-2 text-sm text-slate-500">
            Table {ticket.tableLabel ?? ticket.tableNumber}
          </span>
        </div>
        <span className="text-sm text-slate-500">{elapsed}m ago</span>
      </div>
      <ul className="space-y-2">
        {ticket.items
          .filter((i) => i.status !== "served")
          .map((item) => {
            const next = NEXT_STATUS[item.status];
            return (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
              >
                <div>
                  <span className="font-medium">
                    {item.qty}x {item.name}
                  </span>
                  {item.note && (
                    <span className="ml-2 text-sm text-orange-600">
                      -- {item.note}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-xs">
                    {item.status}
                  </span>
                  {next && (
                    <button
                      disabled={pending}
                      onClick={() => advanceItem(item.id, item.status)}
                      className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                    >
                      {LABEL[next]}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </div>
  );
}
