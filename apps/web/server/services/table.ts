import { prisma } from "@/lib/db";
import { generateTableToken } from "@/lib/qr";
import {
  BulkCreateTablesInput,
  RenameTableInput,
} from "@app/shared/zod/table";
import type { ActionResult } from "@/server/actions/auth";

export async function listTables(restaurantId: string) {
  return prisma.table.findMany({
    where: { restaurantId, isArchived: false },
    orderBy: { number: "asc" },
    select: { id: true, number: true, label: true, token: true, createdAt: true },
  });
}

export async function bulkCreateTables(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ count: number }>> {
  const parsed = BulkCreateTablesInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const startAt = parsed.data.startAt ?? (await nextNumber(restaurantId));
  const count = parsed.data.count;
  const labelPrefix = parsed.data.labelPrefix;

  const existing = await prisma.table.findMany({
    where: { restaurantId, number: { in: Array.from({ length: count }, (_, i) => startAt + i) } },
    select: { number: true },
  });
  const taken = new Set(existing.map((t) => t.number));

  const toCreate: { number: number; label: string | null; token: string }[] = [];
  let n = startAt;
  while (toCreate.length < count) {
    if (!taken.has(n)) {
      toCreate.push({
        number: n,
        label: labelPrefix ? `${labelPrefix} ${n}` : null,
        token: generateTableToken(),
      });
    }
    n++;
    if (n - startAt > 10_000) break; // safety
  }

  await prisma.table.createMany({
    data: toCreate.map((t) => ({ restaurantId, ...t })),
  });
  return { ok: true, data: { count: toCreate.length } };
}

export async function renameTable(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = RenameTableInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { count } = await prisma.table.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { label: parsed.data.label },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Table not found." } };
  return { ok: true, data: { id: parsed.data.id } };
}

export async function archiveTable(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { count } = await prisma.table.updateMany({
    where: { id, restaurantId },
    data: { isArchived: true },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Table not found." } };
  return { ok: true, data: { id } };
}

async function nextNumber(restaurantId: string): Promise<number> {
  const top = await prisma.table.findFirst({
    where: { restaurantId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return (top?.number ?? 0) + 1;
}

function validationError(err: { issues: { path: (string | number)[]; message: string }[] }) {
  return {
    ok: false as const,
    error: {
      code: "VALIDATION",
      message: "Invalid input.",
      fields: Object.fromEntries(err.issues.map((i) => [i.path.join("."), i.message])),
    },
  };
}
