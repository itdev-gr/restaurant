"use server";

import { SignupInput } from "@app/shared/zod/auth";
import { prisma } from "@/lib/db";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } };

export async function signupAction(
  raw: unknown,
): Promise<ActionResult<{ userId: string }>> {
  const parsed = SignupInput.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION",
        message: "Invalid input.",
        fields: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
    };
  }
  const { email, password, name } = parsed.data;

  const admin = getSupabaseAdmin();

  // SUPABASE_AUTO_CONFIRM=true bypasses the email-confirmation step.
  // Set in .env.local for dev, leave UNSET in production so real users must verify.
  const autoConfirm = process.env.SUPABASE_AUTO_CONFIRM === "true";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: autoConfirm,
    ...(name ? { user_metadata: { name } } : {}),
  });

  if (error) {
    if (error.status === 422 || /already registered/i.test(error.message)) {
      return { ok: false, error: { code: "EMAIL_TAKEN", message: "Email already in use." } };
    }
    return { ok: false, error: { code: "AUTH_CREATE_FAILED", message: error.message } };
  }
  if (!data.user) {
    return { ok: false, error: { code: "AUTH_CREATE_FAILED", message: "Supabase returned no user." } };
  }

  // Mirror into public.User. If this fails, roll back the auth user to keep them in sync.
  try {
    await prisma.user.create({
      data: { id: data.user.id, email, name: name ?? null },
    });
  } catch (err) {
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    return {
      ok: false,
      error: {
        code: "MIRROR_FAILED",
        message: err instanceof Error ? err.message : "Failed to create user record.",
      },
    };
  }

  return { ok: true, data: { userId: data.user.id } };
}
