"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cartCount, cartTotalCents, readCart } from "@/lib/cart";

export function CartBar({
  slug, token, tableId, currency,
}: { slug: string; token: string; tableId: string; currency: string }) {
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

  if (count === 0) return <span data-table-id={tableId} className="hidden" />;

  return (
    <div data-table-id={tableId} className="fixed inset-x-0 bottom-0 z-10 border-t bg-white p-3 shadow-lg">
      <Link
        href={`/r/${slug}/t/${token}/cart`}
        className="flex items-center justify-between gap-4 rounded-lg bg-brand-500 px-4 py-3 text-white"
      >
        <span className="text-sm font-medium">View cart · {count} item{count === 1 ? "" : "s"}</span>
        <span className="font-semibold">{currency} {(total / 100).toFixed(2)}</span>
      </Link>
    </div>
  );
}
