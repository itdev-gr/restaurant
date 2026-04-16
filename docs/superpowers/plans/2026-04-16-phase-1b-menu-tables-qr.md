# Restaurant Platform — Phase 1B: Menu CRUD, Tables, QR Generation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Owner can manage menu (categories + items + 1–3 images) and tables (bulk-create with unique QR tokens, download printable QR PDF). Admin UI at `/menu` and `/tables`. Customer-facing QR-scan page is Phase 2.

**Architecture:** Extend Prisma schema with `Category`, `MenuItem`, `MenuItemImage`, `Table`. Pure services in `apps/web/server/services/*.ts` (testable in isolation, auth-agnostic). Thin server-action wrappers in `apps/web/server/actions/*.ts` that call `getSessionUser` + `requireMembership` then delegate. Image uploads go via signed upload URLs → Supabase Storage `menu-images` bucket. QR codes generated server-side via `qrcode` npm package; PDF sheet via `pdf-lib`.

**Tech Stack additions:** `qrcode` (^1.5.4), `pdf-lib` (^1.17.1), `@supabase/storage-js` (transitive via supabase-js). Extends existing Prisma + Next.js + Supabase stack.

**Scope NOT in Phase 1B:** customer `/r/{slug}/t/{token}` page, orders, payments, RLS policies, modifiers UI, active-link styling, mobile responsive editor.

---

## File Structure (Phase 1B additions)

```
apps/web/
├── app/(admin)/
│   ├── menu/
│   │   ├── page.tsx                       # category sidebar + item grid
│   │   └── [categoryId]/items/[itemId]/   # (future: detail drawer if needed)
│   └── tables/
│       └── page.tsx                       # grid of table cards + bulk-create dialog
├── components/admin/
│   ├── menu/
│   │   ├── category-list.tsx              # server list + client add button
│   │   ├── item-grid.tsx                  # server list of items for a category
│   │   ├── item-dialog.tsx                # create/edit item form (client)
│   │   ├── item-card.tsx                  # thumbnail + name + price + availability toggle
│   │   └── image-uploader.tsx             # drag/drop + signed-upload (client)
│   └── tables/
│       ├── table-grid.tsx                  # server list of tables
│       ├── table-card.tsx                  # QR preview + number + archive action
│       └── bulk-create-dialog.tsx          # count input, generates N tables (client)
├── components/ui/
│   ├── dialog.tsx                          # minimal headless dialog (no shadcn dep)
│   ├── switch.tsx                          # accessible on/off toggle
│   └── confirm.tsx                         # reuses dialog for destructive actions
├── lib/
│   ├── qr.ts                               # generateTableToken(), buildTableUrl(slug, token), renderQrPng(url)
│   ├── qr-pdf.ts                           # renderQrSheetPdf(tables): Buffer
│   └── storage.ts                          # mintSignedUploadUrl(path), publicUrl(path)
├── server/
│   ├── services/
│   │   ├── category.ts                     # listCategories, createCategory, renameCategory, archiveCategory, reorderCategories
│   │   ├── menu-item.ts                    # listItems, createItem, updateItem, setAvailability, archiveItem
│   │   ├── menu-item-image.ts              # createImageRecord, removeImage, listForItem
│   │   ├── table.ts                        # listTables, bulkCreateTables, renameTable, archiveTable
│   │   └── qr.ts                           # buildTableQrUrl, generateQrSheetPdf
│   └── actions/
│       ├── category.ts                     # createCategoryAction, renameCategoryAction, archiveCategoryAction, reorderCategoriesAction
│       ├── menu-item.ts                    # createItemAction, updateItemAction, setAvailabilityAction, archiveItemAction
│       ├── menu-item-image.ts              # mintUploadUrlAction, attachImageAction, removeImageAction
│       └── table.ts                        # bulkCreateTablesAction, renameTableAction, archiveTableAction, generateQrPdfAction
└── __tests__/
    ├── lib/qr.test.ts
    ├── lib/qr-pdf.test.ts
    ├── server/services/category.test.ts
    ├── server/services/menu-item.test.ts
    ├── server/services/menu-item-image.test.ts
    ├── server/services/table.test.ts
    └── e2e/
        ├── menu.spec.ts                    # add category → add item → toggle availability
        └── tables.spec.ts                  # bulk-create 10 tables → download QR PDF

packages/db/prisma/
└── migrations/<timestamp>_menu_tables/migration.sql

packages/shared/src/zod/
├── category.ts
├── menu-item.ts
└── table.ts
```

---

## Conventions Reinforced

- **Pure services** (`server/services/*.ts`) — take `restaurantId` + input, return `ActionResult`. No auth checks, no session reads. Testable by injecting ids directly.
- **Server actions** (`server/actions/*.ts`) — `"use server"` wrapper that calls `requireMembership()` (NEW helper, added in Task 1), extracts the active `restaurantId`, then delegates to the service.
- **Images** — the client calls `mintUploadUrlAction` to get a signed upload URL, uploads the file directly to Supabase Storage, then calls `attachImageAction` with the final path to record in `MenuItemImage`. The service enforces the 3-image cap.
- **Tokens** — `generateTableToken()` = `crypto.randomBytes(12).toString("base64url")` ≈ 16 chars. Stored in `tables.token` with global unique constraint.
- **Money** — still cents (Int).

---

## Tasks

### Task 1: Extend Prisma schema + requireMembership helper

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (add Category, MenuItem, MenuItemImage, Table, Station enum)
- Create: `packages/db/prisma/migrations/<timestamp>_menu_tables/migration.sql`
- Create: `apps/web/lib/membership.ts` — `requireMembership()` returns `{ user, restaurantId, role }`, redirects on missing

- [ ] **Step 1: Update schema**

Append to `packages/db/prisma/schema.prisma` (before existing models or logical place):

```prisma
enum Station {
  kitchen
  bar
  both
}

model Category {
  id           String      @id @default(cuid())
  restaurantId String
  restaurant   Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  name         String
  sortOrder    Int         @default(0)
  isArchived   Boolean     @default(false)
  createdAt    DateTime    @default(now())
  items        MenuItem[]

  @@index([restaurantId, isArchived, sortOrder])
}

model MenuItem {
  id               String           @id @default(cuid())
  restaurantId     String
  restaurant       Restaurant       @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  categoryId       String
  category         Category         @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  name             String
  description      String?
  priceCents       Int
  station          Station
  isAvailable      Boolean          @default(true)
  isArchived       Boolean          @default(false)
  sortOrder        Int              @default(0)
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
  images           MenuItemImage[]

  @@index([restaurantId, isArchived])
  @@index([categoryId, sortOrder])
}

model MenuItemImage {
  id          String    @id @default(cuid())
  menuItemId  String
  menuItem    MenuItem  @relation(fields: [menuItemId], references: [id], onDelete: Cascade)
  path        String    // object key in Supabase Storage (e.g. "rest_abc/item_xyz/1.jpg")
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())

  @@index([menuItemId, sortOrder])
}

model Table {
  id           String      @id @default(cuid())
  restaurantId String
  restaurant   Restaurant  @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  number       Int
  label        String?
  token        String      @unique // 16-char URL-safe random, globally unique
  isArchived   Boolean     @default(false)
  createdAt    DateTime    @default(now())

  @@unique([restaurantId, number])
  @@index([restaurantId, isArchived])
}
```

Also add these backrefs to the existing `Restaurant` model:

```prisma
  categories Category[]
  menuItems  MenuItem[]
  tables     Table[]
```

- [ ] **Step 2: Generate migration**

```bash
cd /Users/marios/Desktop/Cursor/restaurant
pnpm -F @app/db exec prisma migrate dev --name menu_tables
```

Expected: migration applied to cloud DB. Verify in Supabase Table Editor.

- [ ] **Step 3: Create `apps/web/lib/membership.ts`**

```ts
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";

export async function requireMembership() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const m = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { restaurantId: true, role: true },
  });
  if (!m) redirect("/onboarding");
  return { user, restaurantId: m.restaurantId, role: m.role };
}
```

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(db): add Category, MenuItem, MenuItemImage, Table schema + requireMembership helper"
```

---

### Task 2: Shared zod schemas for Phase 1B entities

**Files:**
- Create: `packages/shared/src/zod/category.ts`, `menu-item.ts`, `table.ts`
- Modify: `packages/shared/src/index.ts` (export new modules)

- [ ] **Step 1: Create `packages/shared/src/zod/category.ts`**

```ts
import { z } from "zod";

export const CreateCategoryInput = z.object({
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateCategoryInput = z.infer<typeof CreateCategoryInput>;

export const RenameCategoryInput = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
});
export type RenameCategoryInput = z.infer<typeof RenameCategoryInput>;

export const ReorderCategoriesInput = z.object({
  orderedIds: z.array(z.string()).min(1),
});
export type ReorderCategoriesInput = z.infer<typeof ReorderCategoriesInput>;
```

- [ ] **Step 2: Create `packages/shared/src/zod/menu-item.ts`**

```ts
import { z } from "zod";

export const STATIONS = ["kitchen", "bar", "both"] as const;
export const StationSchema = z.enum(STATIONS);
export type Station = z.infer<typeof StationSchema>;

export const CreateMenuItemInput = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  station: StationSchema,
});
export type CreateMenuItemInput = z.infer<typeof CreateMenuItemInput>;

export const UpdateMenuItemInput = CreateMenuItemInput.extend({
  id: z.string(),
}).partial({ categoryId: true, name: true, description: true, priceCents: true, station: true });
export type UpdateMenuItemInput = z.infer<typeof UpdateMenuItemInput>;

export const SetAvailabilityInput = z.object({
  id: z.string(),
  isAvailable: z.boolean(),
});
export type SetAvailabilityInput = z.infer<typeof SetAvailabilityInput>;
```

- [ ] **Step 3: Create `packages/shared/src/zod/table.ts`**

```ts
import { z } from "zod";

export const BulkCreateTablesInput = z.object({
  count: z.coerce.number().int().min(1).max(200),
  startAt: z.coerce.number().int().min(1).optional(),
  labelPrefix: z.string().trim().max(40).optional(),
});
export type BulkCreateTablesInput = z.infer<typeof BulkCreateTablesInput>;

export const RenameTableInput = z.object({
  id: z.string(),
  label: z.string().trim().max(40).nullable(),
});
export type RenameTableInput = z.infer<typeof RenameTableInput>;

export const ArchiveTableInput = z.object({ id: z.string() });
export type ArchiveTableInput = z.infer<typeof ArchiveTableInput>;
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

```ts
export * from "./zod/auth.js";
export * from "./zod/restaurant.js";
export * from "./zod/category.js";
export * from "./zod/menu-item.js";
export * from "./zod/table.js";
```

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm -F @app/shared typecheck
pnpm -F @app/web typecheck
git add -A && git commit -m "feat(shared): zod schemas for category, menu-item, table"
```

---

### Task 3: Category service + action with TDD

**Files:**
- Create: `apps/web/server/services/category.ts`, `server/actions/category.ts`
- Create: `apps/web/__tests__/server/services/category.test.ts`

- [ ] **Step 1: Write failing test `apps/web/__tests__/server/services/category.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  listCategories,
  createCategory,
  renameCategory,
  archiveCategory,
  reorderCategories,
} from "@/server/services/category";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";

async function seedRestaurant() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  return r.id;
}

describe("category service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates a category with incremented sortOrder when unspecified", async () => {
    const rId = await seedRestaurant();
    const a = await createCategory(rId, { name: "Starters" });
    const b = await createCategory(rId, { name: "Mains" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    const aRow = await prisma.category.findUnique({ where: { id: a.data.id } });
    const bRow = await prisma.category.findUnique({ where: { id: b.data.id } });
    expect(aRow!.sortOrder).toBe(0);
    expect(bRow!.sortOrder).toBe(1);
  });

  it("lists categories scoped to restaurant, excluding archived by default", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await createCategory(r1, { name: "A" });
    await createCategory(r1, { name: "B" });
    const archived = await createCategory(r1, { name: "C" });
    if (archived.ok) await archiveCategory(r1, archived.data.id);
    await createCategory(r2, { name: "D" });

    const list = await listCategories(r1);
    expect(list.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("rename is scoped — returns NOT_FOUND when category belongs to another tenant", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    const c = await createCategory(r1, { name: "Starters" });
    if (!c.ok) return;
    const result = await renameCategory(r2, { id: c.data.id, name: "Oops" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("NOT_FOUND");
  });

  it("reorder updates sortOrder to match array index", async () => {
    const rId = await seedRestaurant();
    const a = await createCategory(rId, { name: "A" });
    const b = await createCategory(rId, { name: "B" });
    const c = await createCategory(rId, { name: "C" });
    if (!a.ok || !b.ok || !c.ok) return;
    await reorderCategories(rId, { orderedIds: [c.data.id, a.data.id, b.data.id] });
    const list = await listCategories(rId);
    expect(list.map((x) => x.name)).toEqual(["C", "A", "B"]);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm -F @app/web test category`
Expected: FAIL — module `@/server/services/category` not found.

- [ ] **Step 3: Implement `apps/web/server/services/category.ts`**

```ts
import { Prisma } from "@app/db";
import { prisma } from "@/lib/db";
import {
  CreateCategoryInput,
  RenameCategoryInput,
  ReorderCategoriesInput,
} from "@app/shared/zod/category";
import type { ActionResult } from "@/server/actions/auth";

export async function listCategories(restaurantId: string) {
  return prisma.category.findMany({
    where: { restaurantId, isArchived: false },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, sortOrder: true, createdAt: true },
  });
}

export async function createCategory(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateCategoryInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const sortOrder =
    parsed.data.sortOrder ??
    (await nextSortOrder(restaurantId));

  const row = await prisma.category.create({
    data: { restaurantId, name: parsed.data.name, sortOrder },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function renameCategory(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = RenameCategoryInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  const { count } = await prisma.category.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { name: parsed.data.name },
  });
  if (count === 0) return notFound();
  return { ok: true, data: { id: parsed.data.id } };
}

export async function archiveCategory(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { count } = await prisma.category.updateMany({
    where: { id, restaurantId },
    data: { isArchived: true },
  });
  if (count === 0) return notFound();
  return { ok: true, data: { id } };
}

export async function reorderCategories(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ updated: number }>> {
  const parsed = ReorderCategoriesInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, idx) =>
      prisma.category.updateMany({
        where: { id, restaurantId },
        data: { sortOrder: idx },
      }),
    ),
  );
  return { ok: true, data: { updated: parsed.data.orderedIds.length } };
}

async function nextSortOrder(restaurantId: string): Promise<number> {
  const top = await prisma.category.findFirst({
    where: { restaurantId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (top?.sortOrder ?? -1) + 1;
}

function validationError(error: Prisma.PrismaClientKnownRequestError | { issues: { path: (string | number)[]; message: string }[] }): { ok: false; error: { code: "VALIDATION"; message: string; fields: Record<string, string> } } {
  const issues = "issues" in error ? error.issues : [];
  return {
    ok: false,
    error: {
      code: "VALIDATION",
      message: "Invalid input.",
      fields: Object.fromEntries(issues.map((i) => [i.path.join("."), i.message])),
    },
  };
}

function notFound(): { ok: false; error: { code: "NOT_FOUND"; message: string } } {
  return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };
}
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm -F @app/web test category`
Expected: 4 passed.

- [ ] **Step 5: Implement `apps/web/server/actions/category.ts`**

```ts
"use server";

import { requireMembership } from "@/lib/membership";
import {
  createCategory,
  renameCategory,
  archiveCategory,
  reorderCategories,
} from "@/server/services/category";

export async function createCategoryAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return createCategory(restaurantId, raw);
}

export async function renameCategoryAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return renameCategory(restaurantId, raw);
}

export async function archiveCategoryAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveCategory(restaurantId, id);
}

export async function reorderCategoriesAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return reorderCategories(restaurantId, raw);
}
```

- [ ] **Step 6: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): category service + server actions with TDD"
```

---

### Task 4: MenuItem service + action with TDD

**Files:**
- Create: `apps/web/server/services/menu-item.ts`, `server/actions/menu-item.ts`
- Create: `apps/web/__tests__/server/services/menu-item.test.ts`

- [ ] **Step 1: Write failing test `apps/web/__tests__/server/services/menu-item.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { createCategory } from "@/server/services/category";
import {
  listItems,
  createItem,
  updateItem,
  setAvailability,
  archiveItem,
} from "@/server/services/menu-item";

async function seed() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  const cat = await createCategory(r.id, { name: "Starters" });
  if (!cat.ok) throw new Error("seed failed");
  return { restaurantId: r.id, categoryId: cat.data.id };
}

describe("menu-item service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("creates an item in a category", async () => {
    const { restaurantId, categoryId } = await seed();
    const r = await createItem(restaurantId, {
      categoryId, name: "Bruschetta", priceCents: 650, station: "kitchen",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const row = await prisma.menuItem.findUnique({ where: { id: r.data.id } });
    expect(row!.priceCents).toBe(650);
    expect(row!.station).toBe("kitchen");
    expect(row!.isAvailable).toBe(true);
  });

  it("rejects creating an item in another tenant's category", async () => {
    const a = await seed();
    const b = await seed();
    const r = await createItem(a.restaurantId, {
      categoryId: b.categoryId,
      name: "X", priceCents: 100, station: "kitchen",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("lists items for a restaurant, skipping archived", async () => {
    const { restaurantId, categoryId } = await seed();
    const a = await createItem(restaurantId, { categoryId, name: "A", priceCents: 100, station: "kitchen" });
    const b = await createItem(restaurantId, { categoryId, name: "B", priceCents: 200, station: "bar" });
    if (a.ok) await archiveItem(restaurantId, a.data.id);
    const list = await listItems(restaurantId, { categoryId });
    expect(list.map((i) => i.name)).toEqual(["B"]);
  });

  it("setAvailability toggles flag", async () => {
    const { restaurantId, categoryId } = await seed();
    const r = await createItem(restaurantId, { categoryId, name: "X", priceCents: 100, station: "kitchen" });
    if (!r.ok) return;
    await setAvailability(restaurantId, { id: r.data.id, isAvailable: false });
    const row = await prisma.menuItem.findUnique({ where: { id: r.data.id } });
    expect(row!.isAvailable).toBe(false);
  });

  it("update validates + scopes to tenant", async () => {
    const a = await seed();
    const b = await seed();
    const item = await createItem(a.restaurantId, {
      categoryId: a.categoryId, name: "A", priceCents: 100, station: "kitchen",
    });
    if (!item.ok) return;
    const wrong = await updateItem(b.restaurantId, { id: item.data.id, name: "Hacked" });
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm -F @app/web test menu-item`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/web/server/services/menu-item.ts`**

```ts
import { prisma } from "@/lib/db";
import type { Prisma } from "@app/db";
import {
  CreateMenuItemInput,
  UpdateMenuItemInput,
  SetAvailabilityInput,
} from "@app/shared/zod/menu-item";
import type { ActionResult } from "@/server/actions/auth";

type ListFilters = { categoryId?: string; includeArchived?: boolean };

export async function listItems(restaurantId: string, filters: ListFilters = {}) {
  const where: Prisma.MenuItemWhereInput = {
    restaurantId,
    ...(filters.includeArchived ? {} : { isArchived: false }),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
  };
  return prisma.menuItem.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true, name: true, description: true, priceCents: true,
      station: true, isAvailable: true, categoryId: true, sortOrder: true,
      images: { select: { id: true, path: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function createItem(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateMenuItemInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { categoryId, name, description, priceCents, station } = parsed.data;

  // Verify category belongs to this tenant before inserting
  const cat = await prisma.category.findFirst({
    where: { id: categoryId, restaurantId },
    select: { id: true },
  });
  if (!cat) return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };

  const row = await prisma.menuItem.create({
    data: {
      restaurantId, categoryId, name,
      description: description ?? null,
      priceCents, station,
    },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function updateItem(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateMenuItemInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);

  // If moving category, verify the new category belongs to same tenant
  if (parsed.data.categoryId) {
    const cat = await prisma.category.findFirst({
      where: { id: parsed.data.categoryId, restaurantId },
      select: { id: true },
    });
    if (!cat) return { ok: false, error: { code: "NOT_FOUND", message: "Category not found." } };
  }

  const { id, ...updates } = parsed.data;
  const { count } = await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: updates,
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  return { ok: true, data: { id } };
}

export async function setAvailability(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = SetAvailabilityInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { count } = await prisma.menuItem.updateMany({
    where: { id: parsed.data.id, restaurantId },
    data: { isAvailable: parsed.data.isAvailable },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  return { ok: true, data: { id: parsed.data.id } };
}

export async function archiveItem(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const { count } = await prisma.menuItem.updateMany({
    where: { id, restaurantId },
    data: { isArchived: true },
  });
  if (count === 0) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  return { ok: true, data: { id } };
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
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm -F @app/web test menu-item`
Expected: 5 passed.

- [ ] **Step 5: Implement `apps/web/server/actions/menu-item.ts`**

```ts
"use server";

import { requireMembership } from "@/lib/membership";
import {
  createItem, updateItem, setAvailability, archiveItem,
} from "@/server/services/menu-item";

export async function createItemAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return createItem(restaurantId, raw);
}

export async function updateItemAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return updateItem(restaurantId, raw);
}

export async function setAvailabilityAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return setAvailability(restaurantId, raw);
}

export async function archiveItemAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveItem(restaurantId, id);
}
```

- [ ] **Step 6: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): menu-item service + server actions with TDD"
```

---

### Task 5: Storage bucket + image upload flow with TDD

**Files:**
- Create: `apps/web/lib/storage.ts`
- Create: `apps/web/server/services/menu-item-image.ts`, `server/actions/menu-item-image.ts`
- Create: `apps/web/__tests__/server/services/menu-item-image.test.ts`

**Manual prerequisite:** Create Supabase Storage bucket before running tests.

In Supabase dashboard → Storage → New bucket:
- Name: `menu-images`
- Public: **OFF** (private; access via signed URLs only)
- Allowed MIME types: `image/jpeg,image/png,image/webp`
- File size limit: `5 MB`

Add a policy so authenticated users can read any file (we sign URLs client-side via the server). For Phase 1B, one permissive policy via the dashboard:
- Policy name: `authenticated-read`
- Target: `SELECT`
- Policy: `auth.role() = 'authenticated'`

Or more restrictive: we use the service-role client server-side to mint signed URLs, so no bucket policies are strictly needed. Rely on service-role for all access in Phase 1B — bucket stays private.

- [ ] **Step 1: Create `apps/web/lib/storage.ts`**

```ts
import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const MENU_IMAGES_BUCKET = "menu-images";

export async function mintUploadUrl(path: string, expiresIn = 60) {
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
```

- [ ] **Step 2: Write failing test `apps/web/__tests__/server/services/menu-item-image.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import { createCategory } from "@/server/services/category";
import { createItem } from "@/server/services/menu-item";
import {
  attachImage,
  removeImage,
  listItemImages,
  MAX_IMAGES_PER_ITEM,
} from "@/server/services/menu-item-image";

async function seedItem() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  const cat = await createCategory(r.id, { name: "Starters" });
  if (!cat.ok) throw new Error();
  const item = await createItem(r.id, {
    categoryId: cat.data.id, name: "X", priceCents: 100, station: "kitchen",
  });
  if (!item.ok) throw new Error();
  return { restaurantId: r.id, itemId: item.data.id };
}

describe("menu-item-image service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("attaches an image record", async () => {
    const { restaurantId, itemId } = await seedItem();
    const r = await attachImage(restaurantId, { itemId, path: "rest/item/1.jpg" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const list = await listItemImages(restaurantId, itemId);
    expect(list).toHaveLength(1);
    expect(list[0]!.path).toBe("rest/item/1.jpg");
  });

  it("enforces MAX_IMAGES_PER_ITEM", async () => {
    const { restaurantId, itemId } = await seedItem();
    for (let i = 0; i < MAX_IMAGES_PER_ITEM; i++) {
      await attachImage(restaurantId, { itemId, path: `p/${i}.jpg` });
    }
    const over = await attachImage(restaurantId, { itemId, path: "p/extra.jpg" });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.error.code).toBe("LIMIT_REACHED");
  });

  it("scopes removal to tenant", async () => {
    const a = await seedItem();
    const b = await seedItem();
    const add = await attachImage(a.restaurantId, { itemId: a.itemId, path: "a/1.jpg" });
    if (!add.ok) return;
    const wrong = await removeImage(b.restaurantId, add.data.id);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `pnpm -F @app/web test menu-item-image`
Expected: FAIL.

- [ ] **Step 4: Implement `apps/web/server/services/menu-item-image.ts`**

```ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import type { ActionResult } from "@/server/actions/auth";

export const MAX_IMAGES_PER_ITEM = 3;

const AttachInput = z.object({
  itemId: z.string(),
  path: z.string().min(1).max(200),
});

export async function listItemImages(restaurantId: string, itemId: string) {
  const ownedItem = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    select: { id: true },
  });
  if (!ownedItem) return [];
  return prisma.menuItemImage.findMany({
    where: { menuItemId: itemId },
    orderBy: { sortOrder: "asc" },
    select: { id: true, path: true, sortOrder: true },
  });
}

export async function attachImage(
  restaurantId: string,
  raw: unknown,
): Promise<ActionResult<{ id: string }>> {
  const parsed = AttachInput.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error);
  const { itemId, path } = parsed.data;

  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    select: { id: true, _count: { select: { images: true } } },
  });
  if (!item) return { ok: false, error: { code: "NOT_FOUND", message: "Item not found." } };
  if (item._count.images >= MAX_IMAGES_PER_ITEM) {
    return { ok: false, error: { code: "LIMIT_REACHED", message: `Max ${MAX_IMAGES_PER_ITEM} images per item.` } };
  }

  const row = await prisma.menuItemImage.create({
    data: { menuItemId: itemId, path, sortOrder: item._count.images },
    select: { id: true },
  });
  return { ok: true, data: { id: row.id } };
}

export async function removeImage(
  restaurantId: string,
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const owned = await prisma.menuItemImage.findFirst({
    where: { id, menuItem: { restaurantId } },
    select: { id: true, path: true },
  });
  if (!owned) return { ok: false, error: { code: "NOT_FOUND", message: "Image not found." } };
  await prisma.menuItemImage.delete({ where: { id } });
  return { ok: true, data: { id } };
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
```

- [ ] **Step 5: Run, verify PASS**

Run: `pnpm -F @app/web test menu-item-image`
Expected: 3 passed.

- [ ] **Step 6: Implement `apps/web/server/actions/menu-item-image.ts`**

```ts
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
  // Look up path BEFORE deleting so we can also remove the storage object
  const img = await prisma.menuItemImage.findFirst({
    where: { id, menuItem: { restaurantId } },
    select: { path: true },
  });
  const result = await removeImage(restaurantId, id);
  if (result.ok && img) {
    await removeObject(img.path).catch(() => {}); // best-effort; row already deleted
  }
  return result;
}
```

- [ ] **Step 7: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): menu-item image service + signed-upload actions with 3-image cap"
```

---

### Task 6: QR lib (token + PNG rendering) with TDD

**Files:**
- Create: `apps/web/lib/qr.ts`
- Create: `apps/web/__tests__/lib/qr.test.ts`
- Modify: `apps/web/package.json` (add `qrcode`)

- [ ] **Step 1: Install `qrcode`**

```bash
pnpm -F @app/web add qrcode
pnpm -F @app/web add -D @types/qrcode
```

- [ ] **Step 2: Write failing test `apps/web/__tests__/lib/qr.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { generateTableToken, buildTableUrl, renderQrPng } from "@/lib/qr";

describe("qr", () => {
  it("generates a 16-char URL-safe token", () => {
    const a = generateTableToken();
    const b = generateTableToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(a).not.toBe(b);
  });

  it("builds a table URL", () => {
    expect(buildTableUrl("https://example.com", "the-fork", "abcDEF1234567890"))
      .toBe("https://example.com/r/the-fork/t/abcDEF1234567890");
  });

  it("renders a PNG buffer starting with the PNG magic number", async () => {
    const buf = await renderQrPng("https://example.com/r/x/t/y");
    expect(buf.length).toBeGreaterThan(100);
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `pnpm -F @app/web test qr`
Expected: FAIL.

- [ ] **Step 4: Implement `apps/web/lib/qr.ts`**

```ts
import crypto from "node:crypto";
import QRCode from "qrcode";

export function generateTableToken(): string {
  // 12 random bytes → base64url is 16 chars (no padding)
  return crypto.randomBytes(12).toString("base64url");
}

export function buildTableUrl(baseUrl: string, slug: string, token: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/r/${slug}/t/${token}`;
}

export async function renderQrPng(url: string, size = 1024): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", width: size, margin: 2, errorCorrectionLevel: "M" });
}
```

- [ ] **Step 5: Run, verify PASS**

Run: `pnpm -F @app/web test qr`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat(web): add qr lib (token generator + PNG render) with TDD"
```

---

### Task 7: Table service + actions with TDD

**Files:**
- Create: `apps/web/server/services/table.ts`, `server/actions/table.ts`
- Create: `apps/web/__tests__/server/services/table.test.ts`

- [ ] **Step 1: Write failing test `apps/web/__tests__/server/services/table.test.ts`**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/db";
import { resetDb } from "../../_helpers/db";
import { resetSupabaseAuthUsers } from "../../_helpers/supabase";
import {
  listTables,
  bulkCreateTables,
  renameTable,
  archiveTable,
} from "@/server/services/table";

async function seedRestaurant() {
  const r = await prisma.restaurant.create({
    data: { slug: `r-${Date.now()}`, name: "R", currency: "EUR" },
    select: { id: true },
  });
  return r.id;
}

describe("table service", () => {
  beforeEach(async () => {
    await resetDb();
    await resetSupabaseAuthUsers();
  });

  it("bulk-creates N tables numbered 1..N with unique 16-char tokens", async () => {
    const rId = await seedRestaurant();
    const r = await bulkCreateTables(rId, { count: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.count).toBe(10);
    const tables = await prisma.table.findMany({ where: { restaurantId: rId }, orderBy: { number: "asc" } });
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    for (const t of tables) {
      expect(t.token).toMatch(/^[A-Za-z0-9_-]{16}$/);
    }
    const uniqueTokens = new Set(tables.map((t) => t.token));
    expect(uniqueTokens.size).toBe(10);
  });

  it("bulk-create respects startAt and skips existing numbers", async () => {
    const rId = await seedRestaurant();
    await bulkCreateTables(rId, { count: 3 });           // 1,2,3
    const r = await bulkCreateTables(rId, { count: 2, startAt: 10 }); // 10,11
    expect(r.ok).toBe(true);
    const tables = await prisma.table.findMany({ where: { restaurantId: rId }, orderBy: { number: "asc" } });
    expect(tables.map((t) => t.number)).toEqual([1, 2, 3, 10, 11]);
  });

  it("listTables scopes to tenant, excludes archived", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await bulkCreateTables(r1, { count: 2 });
    await bulkCreateTables(r2, { count: 3 });
    const one = await prisma.table.findFirst({ where: { restaurantId: r1 } });
    if (one) await archiveTable(r1, one.id);
    const list = await listTables(r1);
    expect(list).toHaveLength(1);
  });

  it("rename updates the label", async () => {
    const rId = await seedRestaurant();
    await bulkCreateTables(rId, { count: 1 });
    const t = await prisma.table.findFirstOrThrow({ where: { restaurantId: rId } });
    const r = await renameTable(rId, { id: t.id, label: "Patio 1" });
    expect(r.ok).toBe(true);
    const after = await prisma.table.findUnique({ where: { id: t.id } });
    expect(after!.label).toBe("Patio 1");
  });

  it("archive is scoped", async () => {
    const r1 = await seedRestaurant();
    const r2 = await seedRestaurant();
    await bulkCreateTables(r1, { count: 1 });
    const t = await prisma.table.findFirstOrThrow({ where: { restaurantId: r1 } });
    const wrong = await archiveTable(r2, t.id);
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) expect(wrong.error.code).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `pnpm -F @app/web test table`
Expected: FAIL.

- [ ] **Step 3: Implement `apps/web/server/services/table.ts`**

```ts
import { prisma } from "@/lib/db";
import { generateTableToken } from "@/lib/qr";
import {
  BulkCreateTablesInput,
  RenameTableInput,
  ArchiveTableInput,
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

  // Pre-compute numbers; skip any that already exist.
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
```

- [ ] **Step 4: Run, verify PASS**

Run: `pnpm -F @app/web test table`
Expected: 5 passed.

- [ ] **Step 5: Implement `apps/web/server/actions/table.ts`**

```ts
"use server";

import { requireMembership } from "@/lib/membership";
import {
  bulkCreateTables, renameTable, archiveTable,
} from "@/server/services/table";

export async function bulkCreateTablesAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return bulkCreateTables(restaurantId, raw);
}

export async function renameTableAction(raw: unknown) {
  const { restaurantId } = await requireMembership();
  return renameTable(restaurantId, raw);
}

export async function archiveTableAction(id: string) {
  const { restaurantId } = await requireMembership();
  return archiveTable(restaurantId, id);
}
```

- [ ] **Step 6: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): table service + bulk-create action with TDD"
```

---

### Task 8: QR PDF sheet generator with TDD

**Files:**
- Create: `apps/web/lib/qr-pdf.ts`
- Create: `apps/web/__tests__/lib/qr-pdf.test.ts`
- Modify: `apps/web/package.json` (add `pdf-lib`)

- [ ] **Step 1: Install `pdf-lib`**

```bash
pnpm -F @app/web add pdf-lib
```

- [ ] **Step 2: Write failing test `apps/web/__tests__/lib/qr-pdf.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { renderQrSheetPdf } from "@/lib/qr-pdf";

describe("renderQrSheetPdf", () => {
  it("returns a PDF buffer for a single table", async () => {
    const buf = await renderQrSheetPdf({
      restaurantName: "The Golden Fork",
      baseUrl: "https://example.com",
      slug: "the-golden-fork",
      tables: [{ number: 1, label: null, token: "abcDEF1234567890" }],
    });
    expect(buf.length).toBeGreaterThan(100);
    // PDF signature: %PDF-
    expect(buf[0]).toBe(0x25);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x44);
    expect(buf[3]).toBe(0x46);
  });

  it("paginates when more than 4 tables", async () => {
    const tables = Array.from({ length: 5 }, (_, i) => ({
      number: i + 1, label: null, token: `tok${i.toString().padStart(13, "0")}`,
    }));
    const buf = await renderQrSheetPdf({
      restaurantName: "R", baseUrl: "https://example.com", slug: "r", tables,
    });
    // Very coarse: 2 pages should be materially larger than 1
    expect(buf.length).toBeGreaterThan(2000);
  });
});
```

- [ ] **Step 3: Run, verify FAIL**

Run: `pnpm -F @app/web test qr-pdf`
Expected: FAIL.

- [ ] **Step 4: Implement `apps/web/lib/qr-pdf.ts`**

```ts
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { buildTableUrl, renderQrPng } from "@/lib/qr";

type TableInput = { number: number; label: string | null; token: string };

type RenderInput = {
  restaurantName: string;
  baseUrl: string;
  slug: string;
  tables: TableInput[];
};

const PAGE_W = 595.28; // A4 width in pt
const PAGE_H = 841.89;
const MARGIN = 36;
const COLS = 2;
const ROWS = 2; // 4 per page
const CELL_W = (PAGE_W - MARGIN * 2) / COLS;
const CELL_H = (PAGE_H - MARGIN * 2) / ROWS;
const QR_SIZE = 200;

export async function renderQrSheetPdf({ restaurantName, baseUrl, slug, tables }: RenderInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  for (let i = 0; i < tables.length; i += COLS * ROWS) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    const batch = tables.slice(i, i + COLS * ROWS);

    for (let j = 0; j < batch.length; j++) {
      const col = j % COLS;
      const row = Math.floor(j / COLS);
      const x = MARGIN + col * CELL_W;
      const y = PAGE_H - MARGIN - (row + 1) * CELL_H;
      const t = batch[j]!;

      const url = buildTableUrl(baseUrl, slug, t.token);
      const png = await renderQrPng(url, QR_SIZE);
      const img = await pdf.embedPng(png);

      const qrX = x + (CELL_W - QR_SIZE) / 2;
      const qrY = y + (CELL_H - QR_SIZE) / 2 + 20;
      page.drawImage(img, { x: qrX, y: qrY, width: QR_SIZE, height: QR_SIZE });

      const label = t.label ?? `Table ${t.number}`;
      page.drawText(label, {
        x: x + CELL_W / 2 - (label.length * 3.5),
        y: qrY - 18,
        size: 14,
        font: fontBold,
        color: rgb(0.1, 0.1, 0.1),
      });
      page.drawText(restaurantName, {
        x: x + CELL_W / 2 - (restaurantName.length * 2.5),
        y: qrY - 34,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
    }
  }

  const bytes = await pdf.save();
  return Buffer.from(bytes);
}
```

- [ ] **Step 5: Run, verify PASS**

Run: `pnpm -F @app/web test qr-pdf`
Expected: 2 passed.

- [ ] **Step 6: Implement `apps/web/server/services/qr.ts`** and `actions/qr.ts`

`apps/web/server/services/qr.ts`:
```ts
import { prisma } from "@/lib/db";
import { renderQrSheetPdf } from "@/lib/qr-pdf";

export async function generateQrSheetPdf(restaurantId: string, baseUrl: string): Promise<Buffer> {
  const r = await prisma.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    select: { name: true, slug: true },
  });
  const tables = await prisma.table.findMany({
    where: { restaurantId, isArchived: false },
    orderBy: { number: "asc" },
    select: { number: true, label: true, token: true },
  });
  return renderQrSheetPdf({
    restaurantName: r.name, baseUrl, slug: r.slug, tables,
  });
}
```

`apps/web/server/actions/qr.ts`:
```ts
"use server";

import { requireMembership } from "@/lib/membership";
import { generateQrSheetPdf } from "@/server/services/qr";
import type { ActionResult } from "@/server/actions/auth";

export async function generateQrPdfAction(): Promise<ActionResult<{ base64: string; filename: string }>> {
  const { restaurantId } = await requireMembership();
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ?? "http://localhost:3000";
  const normalized = baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`;
  const pdf = await generateQrSheetPdf(restaurantId, normalized);
  return {
    ok: true,
    data: { base64: pdf.toString("base64"), filename: `qr-tables-${Date.now()}.pdf` },
  };
}
```

- [ ] **Step 7: Commit**

```bash
pnpm typecheck
git add -A && git commit -m "feat(web): QR PDF sheet generator + server action"
```

---

### Task 9: Menu admin UI

**Files:**
- Create: `apps/web/app/(admin)/menu/page.tsx`
- Create: `apps/web/components/ui/dialog.tsx`, `switch.tsx`
- Create: `apps/web/components/admin/menu/category-list.tsx`, `item-grid.tsx`, `item-dialog.tsx`, `item-card.tsx`, `image-uploader.tsx`

The page shows a sidebar of categories on the left and a grid of items for the selected category on the right. An "Add category" button at the bottom of the sidebar. An "Add item" button in the grid header. Each item shows its thumbnail, name, price, and an availability switch. Click an item to open the edit dialog.

State lives in URL (`?category=<id>`) so server components can render the right content. Mutations go through server actions and `router.refresh()`.

Keep it minimal. No drag-and-drop reorder in this task (sortOrder API exists; UI for reorder can be Phase 2). No CSV import. No bulk edit.

- [ ] **Step 1: Create `apps/web/components/ui/dialog.tsx`**

```tsx
"use client";

import { type ReactNode, useEffect } from "react";

export function Dialog({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `apps/web/components/ui/switch.tsx`**

```tsx
"use client";

export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-brand-500" : "bg-slate-300"} disabled:opacity-50`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/(admin)/menu/page.tsx`**

```tsx
import { requireMembership } from "@/lib/membership";
import { listCategories } from "@/server/services/category";
import { listItems } from "@/server/services/menu-item";
import { CategoryList } from "@/components/admin/menu/category-list";
import { ItemGrid } from "@/components/admin/menu/item-grid";

export const metadata = { title: "Menu" };
export const dynamic = "force-dynamic";

export default async function MenuPage({
  searchParams,
}: { searchParams: { category?: string } }) {
  const { restaurantId } = await requireMembership();
  const categories = await listCategories(restaurantId);
  const activeId = searchParams.category ?? categories[0]?.id ?? null;
  const items = activeId ? await listItems(restaurantId, { categoryId: activeId }) : [];

  return (
    <div className="flex h-full gap-6">
      <CategoryList categories={categories} activeId={activeId} />
      <div className="flex-1">
        <ItemGrid
          categories={categories}
          activeCategoryId={activeId}
          items={items}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/admin/menu/category-list.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCategoryAction } from "@/server/actions/category";

type Cat = { id: string; name: string };

export function CategoryList({
  categories, activeId,
}: { categories: Cat[]; activeId: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const r = await createCategoryAction({ name });
      if (!r.ok) { setError(r.error.message); return; }
      setName("");
      router.refresh();
    });
  };

  return (
    <aside className="w-56 shrink-0 border-r pr-4">
      <h1 className="mb-4 text-lg font-semibold">Menu</h1>
      <nav className="flex flex-col gap-1">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/menu?category=${c.id}`}
            className={`rounded-md px-3 py-2 text-sm ${activeId === c.id ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}
          >
            {c.name}
          </Link>
        ))}
      </nav>
      <div className="mt-6 space-y-2 border-t pt-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New category"
          className="input"
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="w-full rounded-md bg-brand-500 px-3 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add category"}
        </button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
    </aside>
  );
}
```

- [ ] **Step 5: Create `apps/web/components/admin/menu/item-grid.tsx`**

```tsx
"use client";

import { useState } from "react";
import { ItemCard } from "./item-card";
import { ItemDialog } from "./item-dialog";

type Cat = { id: string; name: string };
type Item = {
  id: string; name: string; description: string | null; priceCents: number;
  station: "kitchen" | "bar" | "both"; isAvailable: boolean; categoryId: string;
  images: { id: string; path: string; sortOrder: number }[];
};

export function ItemGrid({
  categories, activeCategoryId, items,
}: { categories: Cat[]; activeCategoryId: string | null; items: Item[] }) {
  const [editing, setEditing] = useState<Item | null>(null);
  const [creating, setCreating] = useState(false);

  if (!activeCategoryId) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
        Create a category on the left to start adding items.
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{items.length} item{items.length === 1 ? "" : "s"}</h2>
        <button
          onClick={() => setCreating(true)}
          className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
        >
          Add item
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onEdit={() => setEditing(item)} />
        ))}
      </div>
      {creating && (
        <ItemDialog
          open
          onClose={() => setCreating(false)}
          categories={categories}
          defaultCategoryId={activeCategoryId}
        />
      )}
      {editing && (
        <ItemDialog
          open
          onClose={() => setEditing(null)}
          categories={categories}
          item={editing}
        />
      )}
    </>
  );
}
```

- [ ] **Step 6: Create `apps/web/components/admin/menu/item-card.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { setAvailabilityAction } from "@/server/actions/menu-item";

type Item = {
  id: string; name: string; description: string | null; priceCents: number;
  station: "kitchen" | "bar" | "both"; isAvailable: boolean;
  images: { id: string; path: string; sortOrder: number }[];
};

export function ItemCard({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const toggle = (next: boolean) => {
    startTransition(async () => {
      await setAvailabilityAction({ id: item.id, isAvailable: next });
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="aspect-video bg-slate-100 text-center text-xs text-slate-400">
        {item.images.length > 0 ? "[image]" : "no image"}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <button onClick={onEdit} className="text-left">
            <h3 className="font-medium hover:text-brand-700">{item.name}</h3>
            {item.description && (
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.description}</p>
            )}
          </button>
          <span className="shrink-0 text-sm font-semibold">
            €{(item.priceCents / 100).toFixed(2)}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">
            {item.station}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600">
              {item.isAvailable ? "available" : "86'd"}
            </span>
            <Switch
              checked={item.isAvailable}
              onChange={toggle}
              label="Availability"
              disabled={pending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `apps/web/components/admin/menu/item-dialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateMenuItemInput, STATIONS, type Station } from "@app/shared/zod/menu-item";
import { createItemAction, updateItemAction, archiveItemAction } from "@/server/actions/menu-item";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

type Cat = { id: string; name: string };
type ExistingItem = {
  id: string; name: string; description: string | null; priceCents: number;
  station: Station; categoryId: string;
};

type FormValues = {
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  station: Station;
};

export function ItemDialog({
  open, onClose, categories, item, defaultCategoryId,
}: {
  open: boolean;
  onClose: () => void;
  categories: Cat[];
  item?: ExistingItem;
  defaultCategoryId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: FormValues = item
    ? {
        categoryId: item.categoryId, name: item.name,
        description: item.description ?? "",
        priceCents: item.priceCents, station: item.station,
      }
    : {
        categoryId: defaultCategoryId ?? categories[0]?.id ?? "",
        name: "", description: "", priceCents: 0, station: "kitchen",
      };

  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(CreateMenuItemInput),
    defaultValues: defaults,
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    startTransition(async () => {
      const r = item
        ? await updateItemAction({ id: item.id, ...values })
        : await createItemAction(values);
      if (!r.ok) { setServerError(r.error.message); return; }
      onClose();
      router.refresh();
    });
  };

  const onArchive = () => {
    if (!item) return;
    if (!confirm("Archive this item?")) return;
    startTransition(async () => {
      await archiveItemAction(item.id);
      onClose();
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title={item ? "Edit item" : "Add item"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="categoryId" label="Category" error={errors.categoryId?.message}>
          <select {...register("categoryId")} className="input">
            {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </Field>
        <Field id="name" label="Name" error={errors.name?.message}>
          <input {...register("name")} className="input" />
        </Field>
        <Field id="description" label="Description" error={errors.description?.message}>
          <textarea {...register("description")} className="input" rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="priceCents" label="Price (cents)" error={errors.priceCents?.message}>
            <input
              {...register("priceCents", { valueAsNumber: true })}
              type="number" className="input" min={0} step={1}
            />
          </Field>
          <Field id="station" label="Station" error={errors.station?.message}>
            <select {...register("station")} className="input">
              {STATIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </Field>
        </div>
        {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
        <div className="flex items-center justify-between pt-2">
          {item ? (
            <button type="button" onClick={onArchive} disabled={pending} className="text-sm text-red-600 hover:underline">
              Archive
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit" disabled={pending}
              className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {pending ? "Saving…" : item ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
```

(Image uploader is deferred to a polish pass — items can be created/edited without images in Phase 1B-9. Image upload flow is wired in Task 10 integration if time permits, otherwise Phase 1B-i1.)

- [ ] **Step 8: Manual smoke-check + commit**

```bash
pnpm typecheck
pnpm -F @app/web dev
```

Open http://localhost:3000/menu, sign in, add a category, add an item, toggle availability. Ctrl+C. Then:

```bash
git add -A && git commit -m "feat(web): admin /menu page with category sidebar + item grid + dialogs"
```

---

### Task 10: Tables admin UI + QR PDF download

**Files:**
- Create: `apps/web/app/(admin)/tables/page.tsx`
- Create: `apps/web/components/admin/tables/{table-grid,table-card,bulk-create-dialog}.tsx`

- [ ] **Step 1: Create `apps/web/app/(admin)/tables/page.tsx`**

```tsx
import { requireMembership } from "@/lib/membership";
import { listTables } from "@/server/services/table";
import { TableGrid } from "@/components/admin/tables/table-grid";

export const metadata = { title: "Tables" };
export const dynamic = "force-dynamic";

export default async function TablesPage() {
  const { restaurantId } = await requireMembership();
  const tables = await listTables(restaurantId);
  return <TableGrid tables={tables} />;
}
```

- [ ] **Step 2: Create `apps/web/components/admin/tables/table-grid.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableCard } from "./table-card";
import { BulkCreateDialog } from "./bulk-create-dialog";
import { generateQrPdfAction } from "@/server/actions/qr";

type Table = { id: string; number: number; label: string | null; token: string };

export function TableGrid({ tables }: { tables: Table[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const downloadPdf = () => {
    setError(null);
    startTransition(async () => {
      const r = await generateQrPdfAction();
      if (!r.ok) { setError(r.error.message); return; }
      const bytes = Uint8Array.from(atob(r.data.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.data.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Tables</h1>
        <div className="flex gap-2">
          <button
            onClick={downloadPdf}
            disabled={pending || tables.length === 0}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            {pending ? "Generating…" : "Print QR codes"}
          </button>
          <button
            onClick={() => setCreating(true)}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600"
          >
            Add tables
          </button>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {tables.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-slate-500">
          No tables yet. Click "Add tables" to create them in bulk.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {tables.map((t) => (
            <TableCard key={t.id} table={t} onChanged={() => router.refresh()} />
          ))}
        </div>
      )}
      {creating && (
        <BulkCreateDialog
          open
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/components/admin/tables/table-card.tsx`**

```tsx
"use client";

import { useTransition } from "react";
import { archiveTableAction, renameTableAction } from "@/server/actions/table";

type Table = { id: string; number: number; label: string | null; token: string };

export function TableCard({ table, onChanged }: { table: Table; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();

  const archive = () => {
    if (!confirm(`Archive table ${table.number}?`)) return;
    startTransition(async () => {
      await archiveTableAction(table.id);
      onChanged();
    });
  };

  const rename = () => {
    const label = prompt(`Label for table ${table.number}`, table.label ?? "") ?? null;
    if (label === null) return;
    startTransition(async () => {
      await renameTableAction({ id: table.id, label: label.trim() || null });
      onChanged();
    });
  };

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4 text-center shadow-sm">
      <div className="text-xs text-slate-500">Table</div>
      <div className="text-2xl font-semibold">{table.number}</div>
      <div className="text-xs text-slate-500 truncate w-full" title={table.label ?? ""}>
        {table.label ?? " "}
      </div>
      <code className="block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500" title={table.token}>
        {table.token.slice(0, 8)}…
      </code>
      <div className="mt-2 flex gap-2">
        <button onClick={rename} disabled={pending} className="text-xs text-brand-600 hover:underline">
          Rename
        </button>
        <button onClick={archive} disabled={pending} className="text-xs text-red-600 hover:underline">
          Archive
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/admin/tables/bulk-create-dialog.tsx`**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BulkCreateTablesInput } from "@app/shared/zod/table";
import { bulkCreateTablesAction } from "@/server/actions/table";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";

type FormValues = { count: number; startAt?: number; labelPrefix?: string };

export function BulkCreateDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const {
    register, handleSubmit, formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(BulkCreateTablesInput),
    defaultValues: { count: 10 },
  });

  const onSubmit = (values: FormValues) => {
    setError(null);
    startTransition(async () => {
      const r = await bulkCreateTablesAction(values);
      if (!r.ok) { setError(r.error.message); return; }
      onCreated();
    });
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add tables">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Field id="count" label="How many?" error={errors.count?.message}>
          <input
            {...register("count", { valueAsNumber: true })}
            type="number" className="input" min={1} max={200}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field id="startAt" label="Start at number" error={errors.startAt?.message}>
            <input
              {...register("startAt", { valueAsNumber: true })}
              type="number" className="input" min={1} placeholder="auto"
            />
          </Field>
          <Field id="labelPrefix" label="Label prefix (optional)" error={errors.labelPrefix?.message}>
            <input {...register("labelPrefix")} className="input" placeholder="Patio" />
          </Field>
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50">
            Cancel
          </button>
          <button
            type="submit" disabled={pending}
            className="rounded-md bg-brand-500 px-4 py-2 text-sm text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {pending ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
```

- [ ] **Step 5: Smoke-check + commit**

```bash
pnpm typecheck
pnpm -F @app/web dev
```

Open http://localhost:3000/tables, sign in, bulk-create 5 tables, click "Print QR codes" — PDF downloads with 2 pages (4+1) of QR codes. Ctrl+C.

```bash
git add -A && git commit -m "feat(web): admin /tables page with bulk-create + QR PDF download"
```

---

## Phase 1B — Acceptance Checks

- [ ] `pnpm typecheck && pnpm test` — all green (including new services).
- [ ] Signup → onboarding → `/menu` → add category → add item → toggle availability — works end-to-end locally.
- [ ] `/tables` → bulk-create 10 tables → download QR PDF — renders 3 pages (4+4+2 layout).
- [ ] Tenant scoping verified by unit tests (NOT_FOUND when cross-tenant id passed).
- [ ] CI remains green on PR.
- [ ] Push to main; Vercel auto-deploys; production URLs render `/menu` and `/tables` without 500s (logged-in state).

## Notes for Phase 1C (next plan)

- RLS policies on all tenant tables using `auth.uid()` → membership lookup.
- Populate Supabase `app_metadata.restaurant_id` on onboarding so RLS can read it directly from JWT.
- Active-link highlighting in sidebar.
- Image uploader (deferred UI) — add drag-drop + progress + thumbnails.
- Drag-to-reorder categories.
- Menu item CSV import/export.
