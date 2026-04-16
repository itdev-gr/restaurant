import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Called from a Server Component — middleware will refresh next time.
          }
        },
        remove: (name: string, options: CookieOptions) => {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // Same as above.
          }
        },
      },
    },
  );
}
