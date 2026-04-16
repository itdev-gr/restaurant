import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MENU_IMAGES_BUCKET = "menu-images";

export async function mintUploadUrl(path: string) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa.storage
    .from(MENU_IMAGES_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) throw new Error(`mintUploadUrl failed: ${error?.message ?? "unknown"}`);
  return { path: data.path, token: data.token, signedUrl: data.signedUrl };
}

export async function mintReadUrl(path: string, expiresIn = 60 * 5) {
  const supa = getSupabaseAdmin();
  const { data, error } = await supa.storage
    .from(MENU_IMAGES_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`mintReadUrl failed: ${error?.message ?? "unknown"}`);
  return data.signedUrl;
}

export async function removeObject(path: string) {
  const supa = getSupabaseAdmin();
  const { error } = await supa.storage.from(MENU_IMAGES_BUCKET).remove([path]);
  if (error) throw new Error(`removeObject failed: ${error.message}`);
}
