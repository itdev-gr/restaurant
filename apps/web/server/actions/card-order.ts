"use server";

import { createCardOrder } from "@/server/services/card-order";
import type { ActionResult } from "@/server/actions/auth";

export async function createCardOrderAction(
  slug: string,
  token: string,
  raw: unknown,
): Promise<ActionResult<{ orderCode: string; clientSecret: string }>> {
  return createCardOrder(slug, token, raw);
}
