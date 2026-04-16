"use server";

import { cookies } from "next/headers";
import {
  TABLE_COOKIE,
  TABLE_COOKIE_MAX_AGE_SEC,
  signTableCookie,
} from "@/lib/table-session";

export async function setTableSessionAction(restaurantId: string, tableId: string) {
  const exp = Date.now() + TABLE_COOKIE_MAX_AGE_SEC * 1000;
  const token = signTableCookie({ rid: restaurantId, tid: tableId, exp });
  cookies().set(TABLE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: TABLE_COOKIE_MAX_AGE_SEC,
    path: "/r",
  });
}
