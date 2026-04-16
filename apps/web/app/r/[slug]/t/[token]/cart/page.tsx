import { CartList } from "@/components/customer/cart-list";

export const dynamic = "force-dynamic";

export default function CartPage({
  params,
}: { params: { slug: string; token: string } }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-3">
        <a href={`/r/${params.slug}/t/${params.token}`} className="text-sm text-slate-600">
          ← Back to menu
        </a>
        <h1 className="mt-1 text-lg font-semibold">Your order</h1>
      </header>
      <CartList slug={params.slug} token={params.token} />
    </div>
  );
}
