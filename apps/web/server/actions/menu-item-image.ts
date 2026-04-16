"use server";

import { z } from "zod";
import crypto from "node:crypto";
import { requireMembership } from "@/lib/membership";
import { mintUploadUrl, removeObject } from "@/lib/storage";
import { attachImage, removeImage } from "@/server/services/menu-item-image";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

const MintInput = z.object({
  itemId: z.string(),
  filename: z.string().min(1).max(120),
});

export async function mintUploadUrlAction(
  raw: unknown,
): Promise<ActionResult<{ path: string; signedUrl: string; token: string }>> {
  const parsed = MintInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: { code: "VALIDATION", message: "Invalid input." } };

  const { restaurantId } = await requireMembership();
  const item = await prisma.menuItem.findFirst({
    where: { id: parsed.data.itemId, restaurantId },
    select: { id: true },
  });
  if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };

  const ext = (parsed.data.filename.match(/\.(jpe?g|png|webp)$/i)?.[1] ?? "jpg").toLowerCase();
  const rand = crypto.randomBytes(8).toString("hex");
  const path = `${restaurantId}/${parsed.data.itemId}/${rand}.${ext}`;

  const minted = await mintUploadUrl(path);
  return { ok: true, data: minted };
}

export async function attachImageAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return attachImage(restaurantId, raw);
}

export async function removeImageAction(id: string) {
  const { restaurantId } = await requireMembership();
  const img = await prisma.menuItemImage.findFirst({
    where: { id, menuItem: { restaurantId } },
    select: { path: true },
  });
  const result = await removeImage(restaurantId, id);
  if (result.ok && img) {
    await removeObject(img.path).catch(() => {});
  }
  return result;
}
