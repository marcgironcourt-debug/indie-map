import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

async function main() {
  const places = await prisma.place.findMany({
    orderBy: { createdAt: "desc" },
  });

  const outDir = path.join(process.cwd(), "data");
  const outPath = path.join(outDir, "places.json");

  await fs.promises.mkdir(outDir, { recursive: true });
  await fs.promises.writeFile(outPath, JSON.stringify(places, null, 2), "utf8");

  console.log(`Exported ${places.length} places to ${outPath}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
