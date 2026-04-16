import Link from "next/link";

type NavItem = { href: string; label: string; ready: boolean };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", ready: true },
  { href: "/orders", label: "Orders", ready: false },
  { href: "/menu", label: "Menu", ready: true },
  { href: "/tables", label: "Tables", ready: true },
  { href: "/staff", label: "Staff", ready: false },
  { href: "/reports", label: "Reports", ready: false },
  { href: "/settings", label: "Settings", ready: false },
];

export function Sidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-slate-50 p-4 lg:block">
      <div className="mb-6 px-2 text-sm font-semibold text-slate-500">RESTAURANT</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-white"
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.href}
              className="flex items-center justify-between rounded-md px-3 py-2 text-sm text-slate-400"
              aria-disabled="true"
              title="Coming in Phase 2+"
            >
              {item.label}
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-slate-500">
                soon
              </span>
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
