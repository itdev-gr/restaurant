import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { InviteStaffInput } from "@app/shared/zod/staff";
import type { ActionResult } from "@/server/actions/auth";

export async function inviteStaff(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ userId: string; membershipId: string }>> {
  const parsed = InviteStaffInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      },
    };
  }
  const { email, name, role } = parsed.data;
  const admin = getSupabaseAdmin();
  const autoConfirm = process.env.SUPABASE_AUTO_CONFIRM === "true";

  // Check if user already exists in our DB
  let userId: string;
  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create auth user
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: email, // temp password
      email_confirm: autoConfirm,
      ...(name ? { user_metadata: { name } } : {}),
    });
    if (error) {
      if (error.status === 422 || /already registered/i.test(error.message)) {
        return {
          ok: false,
          error: { code: "EMAIL_TAKEN", message: "Email already in use." },
        };
      }
      return {
        ok: false,
        error: { code: "AUTH_FAILED", message: error.message },
      };
    }
    if (!data.user) {
      return {
        ok: false,
        error: { code: "AUTH_FAILED", message: "No user returned." },
      };
    }
    userId = data.user.id;
    await prisma.user.create({
      data: { id: userId, email, name: name ?? null },
    });
  }

  // Check existing membership
  const existingMembership = await prisma.membership.findUnique({
    where: { userId_restaurantId: { userId, restaurantId } },
  });
  if (existingMembership) {
    return {
      ok: false,
      error: {
        code: "ALREADY_MEMBER",
        message: "This user is already a staff member.",
      },
    };
  }

  const membership = await prisma.membership.create({
    data: { userId, restaurantId, role },
    select: { id: true },
  });

  return { ok: true, data: { userId, membershipId: membership.id } };
}

export async function listStaff(restaurantId: string) {
  return prisma.membership.findMany({
    where: { restaurantId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function removeStaff(
  restaurantId: string,
  membershipId: string,
): Promise<ActionResult<{ id: string }>> {
  const m = await prisma.membership.findFirst({
    where: { id: membershipId, restaurantId },
    select: { id: true, role: true },
  });
  if (!m) {
    return {
      ok: false,
      error: { code: "NOT_FOUND", message: "Staff member not found." },
    };
  }
  if (m.role === "owner") {
    return {
      ok: false,
      error: { code: "FORBIDDEN", message: "Cannot remove the owner." },
    };
  }
  await prisma.membership.delete({ where: { id: membershipId } });
  return { ok: true, data: { id: membershipId } };
}
