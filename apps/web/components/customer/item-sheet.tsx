"use client";

import { useEffect, useState } from "react";

type Item = { id: string; name: string; description: string | null; priceCents: number };

export function ItemSheet({
  item,
  currency,
  onClose,
  onAdd,
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
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const total = (item.priceCents * qty) / 100;

  return (
    <div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
    >
      <div
        className="slide-up-enter w-full max-w-lg rounded-t-3xl bg-white pb-safe-bottom shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <div className="space-y-5 px-5 pb-6">
          {/* Title + description */}
          <div>
            <h2 className="text-xl font-bold text-slate-900">{item.name}</h2>
            {item.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {item.description}
              </p>
            )}
            <div className="mt-2 text-lg font-bold text-brand-600">
              {currency} {(item.priceCents / 100).toFixed(2)}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 text-xl font-medium text-slate-600 transition-colors active:bg-slate-100"
              aria-label="Decrease"
            >
              −
            </button>
            <span className="w-10 text-center text-2xl font-bold">{qty}</span>
            <button
              type="button"
              onClick={() => setQty((q) => Math.min(99, q + 1))}
              className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-brand-500 bg-brand-50 text-xl font-medium text-brand-600 transition-colors active:bg-brand-100"
              aria-label="Increase"
            >
              +
            </button>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Special instructions
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder="e.g. no onions, extra sauce"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-600 transition-colors active:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onAdd(qty, note.trim() || undefined)}
              className="flex-[2] rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition-all active:scale-[0.98] active:bg-brand-600"
            >
              Add to order — {currency} {total.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
