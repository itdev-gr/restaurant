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
