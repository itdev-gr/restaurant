import Link from "next/link";

export default function StationLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="flex items-center gap-4 border-b bg-white px-4 py-2 text-sm">
        <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">
          ← Admin
        </Link>
        <Link href="/kitchen" className="font-medium text-slate-700 hover:text-brand-600">
          Kitchen
        </Link>
        <Link href="/bar" className="font-medium text-slate-700 hover:text-brand-600">
          Bar
        </Link>
        <Link href="/cashier" className="font-medium text-slate-700 hover:text-brand-600">
          Cashier
        </Link>
      </nav>
      {children}
    </div>
  );
}
