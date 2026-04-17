import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">
              <span className="text-brand-500">●</span> RestaurantOS
            </div>
            <p className="mt-1 text-sm text-slate-500">
              QR-code dine-in ordering for modern restaurants.
            </p>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/pricing" className="hover:text-slate-900">Pricing</Link>
            <Link href="/contact" className="hover:text-slate-900">Contact</Link>
            <Link href="/login" className="hover:text-slate-900">Log in</Link>
            <Link href="/signup" className="hover:text-slate-900">Sign up</Link>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} RestaurantOS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
