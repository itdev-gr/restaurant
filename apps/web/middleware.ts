import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase-middleware";

const PROTECTED = [
  /^\/dashboard/, /^\/onboarding/, /^\/orders/, /^\/menu/,
  /^\/tables/, /^\/staff/, /^\/reports/, /^\/settings/,
];

export default async function middleware(req: NextRequest) {
  const { res, user } = await updateSession(req);

  const isProtected = PROTECTED.some((re) => re.test(req.nextUrl.pathname));
  if (isProtected && !user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|favicon|.*\\..*).*)"],
};
