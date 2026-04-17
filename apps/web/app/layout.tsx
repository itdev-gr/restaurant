import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "greek"] });

export const metadata: Metadata = {
  title: "Restaurant Platform — QR-Code Dine-In Ordering",
  description:
    "Let your guests order from their phone. QR-code menus, real-time kitchen tickets, cash & card payments. Set up in 5 minutes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
