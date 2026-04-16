import type { Metadata } from "next";

export const metadata: Metadata = { title: "Order" };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-white">{children}</div>;
}
