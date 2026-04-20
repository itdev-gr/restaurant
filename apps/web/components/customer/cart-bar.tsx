"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartCount, cartTotalCents, readCart } from "@/lib/cart";

export function CartBar({
  slug,
  token,
  tableId,
  currency,
}: {
  slug: string;
  token: string;
  tableId: string;
  currency: string;
}) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const update = () => {
      const cart = readCart(tableId);
      setCount(cartCount(cart));
      setTotal(cartTotalCents(cart));
    };
    update();
    const onChange = () => update();
    window.addEventListener("cart-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("cart-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [tableId]);

  if (count === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 p-4 pb-safe-bottom">
      <Link
        href={`/r/${slug}/t/${token}/cart`}
        className="flex items-center justify-between rounded-2xl bg-brand-500 px-5 py-4 shadow-xl shadow-brand-500/30 transition-all active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">
            {count}
          </span>
          <span className="text-sm font-semibold text-white">View order</span>
        </div>
        <span className="text-sm font-bold text-white">
          {currency} {(total / 100).toFixed(2)}
        </span>
      </Link>
    </div>
  );
}
