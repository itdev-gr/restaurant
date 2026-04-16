import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function resetSupabaseAuthUsers() {
  const admin = getSupabaseAdmin();
  // Page through all users (test runs against the dev Supabase project — should be small)
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  for (const u of data.users) {
    await admin.auth.admin.deleteUser(u.id);
  }
}
