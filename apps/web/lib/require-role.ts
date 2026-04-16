import { redirect } from "next/navigation";
import { requireMembership } from "@/lib/membership";

type Role = "owner" | "manager" | "kitchen" | "bar" | "cashier";

const STATION_ACCESS: Record<string, Role[]> = {
  kitchen: ["kitchen", "manager", "owner"],
  bar: ["bar", "manager", "owner"],
  cashier: ["cashier", "manager", "owner"],
};

const ADMIN_ROLES: Role[] = ["owner", "manager"];

export async function requireAdminRole() {
  const m = await requireMembership();
  if (!ADMIN_ROLES.includes(m.role as Role)) redirect("/dashboard");
  return m;
}

export async function requireStationRole(station: "kitchen" | "bar" | "cashier") {
  const m = await requireMembership();
  const allowed = STATION_ACCESS[station] ?? [];
  if (!allowed.includes(m.role as Role)) redirect("/dashboard");
  return m;
}
