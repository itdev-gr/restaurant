import { prisma } from "./index.js";

async function main() {
  console.log("Seed: nothing to seed yet (Phase 1A).");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
