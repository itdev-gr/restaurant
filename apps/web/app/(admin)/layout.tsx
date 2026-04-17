import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { Sidebar } from "@/components/admin/sidebar";
import { Topbar } from "@/components/admin/topbar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurant: { select: { name: true } } },
  });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isSuperAdmin: true },
  });

  // Onboarding shows children only — no shell until the user has a restaurant.
  if (!membership) {
    return <main className="min-h-screen bg-slate-50">{children}</main>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar restaurantName={membership.restaurant.name} userEmail={user.email!} isSuperAdmin={dbUser?.isSuperAdmin ?? false} />
        <main className="flex-1 bg-white p-6">{children}</main>
      </div>
    </div>
  );
}
