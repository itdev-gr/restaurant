import Link from "next/link";
import { requireSuperAdmin } from "@/lib/require-role";

export default async function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/super-admin" className="text-lg font-bold text-slate-900">
            <span className="text-red-500">⚡</span> Super Admin
          </Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to restaurant
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </div>
  );
}
