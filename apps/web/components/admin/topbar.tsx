"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function Topbar({ restaurantName, userEmail, isSuperAdmin }: { restaurantName: string; userEmail: string; isSuperAdmin?: boolean }) {
  const router = useRouter();
  const onSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  };
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-3">
      <h2 className="text-lg font-semibold">{restaurantName}</h2>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-600">{userEmail}</span>
        {isSuperAdmin && (
          <Link
            href="/super-admin"
            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
          >
            ⚡ Admin
          </Link>
        )}
        <button onClick={onSignOut} className="rounded-md border px-3 py-1.5 hover:bg-slate-50">
          Sign out
        </button>
      </div>
    </header>
  );
}
