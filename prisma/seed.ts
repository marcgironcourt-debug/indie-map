import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.place.deleteMany();
  await prisma.business.deleteMany();

  // --- Lieux avec coordonnées déjà connues ---
  await prisma.place.create({
    data: {
      name: "Café Myriade",
      city: "Montréal",
      address: "1432 Rue Mackay, Montréal, QC H3G 2H7",
      website: "https://cafemyriade.com",
      lat: 45.49705,
      lng: -73.57891,
      description: "Café indépendant avec torréfaction locale."
    }
  });

  await prisma.place.create({
    data: {
      name: "Espace FLO",
      city: "Montréal",
      address: "4306 Rue Sainte-Catherine E, Montréal, QC",
      website: "https://espaceflo.com",
      lat: 45.59376,
      lng: -73.53591,
      description: "Boutique locale avec produits fabriqués au Québec."
    }
  });

  await prisma.place.create({
    data: {
      name: "Bouquinerie du Plateau",
      city: "Montréal",
      address: "437 Avenue du Mont-Royal E, Montréal, QC",
      website: "https://bouquinerieduplateau.com",
      lat: 45.52518,
      lng: -73.57435,
      description: "Librairie indépendante et bouquinerie emblématique."
    }
  });

  await prisma.place.create({
    data: {
      name: "Café Névé",
      city: "Montréal",
      address: "151 Rue Rachel E, Montréal, QC",
      website: "https://cafeneve.com",
      lat: 45.52379,
      lng: -73.57253,
      description: "Café local populaire avec ambiance chaleureuse."
    }
  });

  await prisma.place.create({
    data: {
      name: "L’Oblique",
      city: "Montréal",
      address: "4333 Rue Rivard, Montréal, QC",
      website: "https://l-oblique.com",
      lat: 45.52881,
      lng: -73.58118,
      description: "Boutique de disques indépendante depuis 1987."
    }
  });

  await prisma.place.create({
    data: {
      name: "Épicerie LOCO Villeray",
      city: "Montréal",
      address: "422 Rue Jarry E, Montréal, QC H2P 1V3",
      website: "https://epicerieloco.ca",
      lat: 45.543306,
      lng: -73.628303,
      description: "Épicerie zéro déchet LOCO dans Villeray."
    }
  });

  // --- Autres succursales LOCO (sans coordonnées pour l'instant) ---
  await prisma.place.create({
    data: {
      name: "Épicerie LOCO Verdun",
      city: "Verdun",
      address: "4437 Rue Wellington, Verdun, QC H4G 1W6",
      website: "https://epicerieloco.ca/loco-verdun",
      lat: 45.454378,
      lng: -73.5676139,
      description: "Succursale LOCO Verdun, épicerie zéro déchet."
    }
  });

  await prisma.place.create({
    data: {
      name: "Épicerie LOCO Plateau",
      city: "Montréal",
      address: "368 Av Du Mont-Royal E, Montréal, QC H2T 1P9",
      website: "https://www.epicerieloco.ca",
      lat: 45.523474,
      lng: -73.583052,
      description: "Succursale LOCO sur le Plateau Mont-Royal."
    }
  });

  await prisma.place.create({
    data: {
      name: "Épicerie LOCO Castelnau",
      city: "Montréal",
      address: "337 Rue Castelnau E, Montréal, QC H2R 1P8",
      website: "https://www.epicerieloco.ca",
      lat: 45.538302,
      lng: -73.617971,
      description: "Succursale LOCO près de Castelnau."
    }
  });

  console.log("✅ Places seeded");

  await prisma.business.create({
    data: {
      name: "Café des Amis",
      descriptionFr: "Café indépendant avec torréfaction locale et pâtisseries maison.",
      descriptionEn: "Independent café with local roasting and homemade pastries.",
      aiGenerated: false
    }
  });

  await prisma.business.create({
    data: {
      name: "Librairie La Page",
      descriptionFr: "Librairie de quartier, sélection engagée et événements auteurs.",
      descriptionEn: "Neighborhood bookstore with curated selection and author events.",
      aiGenerated: false
    }
  });

  await prisma.business.create({
    data: {
      name: "Espace FLO",
      descriptionFr: "Boutique locale proposant uniquement des produits fabriqués au Québec, éthique et écoresponsable.",
      descriptionEn: "Local boutique offering goods exclusively made in Quebec, ethical and eco-responsible.",
      aiGenerated: false
    }
  });

  console.log("✅ Business seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
