import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin", "greek"] });

export const metadata: Metadata = { title: "Order" };

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${inter.className} min-h-screen bg-slate-50`}>
      {children}
    </div>
  );
}
