import { requireStationRole } from "@/lib/require-role";
import { prisma } from "@/lib/db";
import { StationBoard } from "@/components/station/station-board";

export const metadata = { title: "Cashier" };
export const dynamic = "force-dynamic";

export default async function CashierPage() {
  const { restaurantId } = await requireStationRole("cashier");

  const orders = await prisma.order.findMany({
    where: {
      restaurantId,
      status: { in: ["received", "preparing", "ready"] },
    },
    orderBy: { createdAt: "asc" },
    include: {
      items: true,
      table: { select: { number: true, label: true } },
    },
    take: 50,
  });

  const tickets = orders.map((o) => ({
    orderId: o.id,
    orderCode: o.code,
    tableNumber: o.table.number,
    tableLabel: o.table.label,
    items: o.items.map((i) => ({
      id: i.id,
      name: i.nameSnapshot,
      qty: i.qty,
      note: i.note,
      station: i.station as "kitchen" | "bar" | "both",
      status: i.status as "received" | "preparing" | "ready" | "served",
    })),
    paymentMethod: o.paymentMethod,
    totalCents: o.totalCents,
    createdAt: o.createdAt.toISOString(),
  }));

  return (
    <StationBoard
      station="cashier"
      restaurantId={restaurantId}
      initialTickets={tickets}
    />
  );
}
