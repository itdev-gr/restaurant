import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "@/components/admin/onboarding-form";

export const metadata = { title: "Create your restaurant" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const existing = await prisma.membership.findFirst({
    where: { userId: user.id }, select: { restaurantId: true },
  });
  if (existing) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg p-8">
      <OnboardingForm />
    </div>
  );
}
