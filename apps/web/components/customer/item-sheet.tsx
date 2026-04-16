"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string; description: string | null; priceCents: number };

export function ItemSheet({
  item, currency, onClose, onAdd,
}: {
  item: Item;
  currency: string;
  onClose: () => void;
  onAdd: (qty: number, note?: string) => void;
}) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-slate-900/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{item.name}</h2>
        {item.description && (
          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-10 w-10 rounded-full border text-xl"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="w-8 text-center text-lg">{qty}</span>
          <button
            type="button"
            onClick={() => setQty((q) => Math.min(99, q + 1))}
            className="h-10 w-10 rounded-full border text-xl"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Note (optional)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="e.g. no onions"
            className="input"
          />
        </label>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-md border px-4 py-3 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onAdd(qty, note.trim() || undefined)}
            className="flex-[2] rounded-md bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Add — {currency} {((item.priceCents * qty) / 100).toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
