import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.business.deleteMany();

  await prisma.business.createMany({
    data: [
      {
        name: "Café des Amis",
        descriptionFr: "Café indépendant avec torréfaction locale et pâtisseries maison.",
        descriptionEn: "Independent café with local roasting and homemade pastries.",
        aiGenerated: false
      },
      {
        name: "Librairie La Page",
        descriptionFr: "Librairie de quartier, sélection engagée et événements auteurs.",
        descriptionEn: "Neighborhood bookstore with curated selection and author events.",
        aiGenerated: false
      }
    ]
  });
}

main()
  .then(() => {
    console.log("✅ Données Business insérées");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
