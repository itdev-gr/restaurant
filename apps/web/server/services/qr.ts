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
