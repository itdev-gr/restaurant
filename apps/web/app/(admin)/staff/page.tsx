import { requireAdminRole } from "@/lib/require-role";
import { listStaff } from "@/server/services/staff";
import { StaffList } from "@/components/admin/staff-list";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const { restaurantId } = await requireAdminRole();
  const members = await listStaff(restaurantId);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <StaffList
        members={members.map((m) => ({
          id: m.id,
          role: m.role,
          email: m.user.email,
          name: m.user.name,
          createdAt: m.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
