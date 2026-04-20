import Link from "next/link";
import { notFound } from "next/navigation";
import { resolveTableFromToken } from "@/server/services/table-session";
import { CartList } from "@/components/customer/cart-list";

export const dynamic = "force-dynamic";

export default async function CartPage({
  params,
}: { params: { slug: string; token: string } }) {
  const resolved = await resolveTableFromToken(params.slug, params.token);
  if (!resolved.ok) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <Link
          href={`/r/${params.slug}/t/${params.token}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to menu
        </Link>
        <h1 className="mt-1 text-lg font-bold">Your order</h1>
      </header>
      <CartList
        slug={params.slug}
        token={params.token}
        tableId={resolved.data.tableId}
      />
    </div>
  );
}
