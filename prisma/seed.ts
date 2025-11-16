import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Reset des places...");
  await prisma.place.deleteMany();

  console.log("Insertion des places avec catégories...");
  await prisma.place.createMany({
    data: [
      {
        id: "loco_castelnau",
        name: "Épicerie LOCO Castelnau",
        city: "Montréal",
        address: "337 Rue Castelnau E, Montréal, QC H2R 1P8",
        website: "https://www.epicerieloco.ca",
        lat: 45.538302,
        lng: -73.617971,
        description: "Succursale LOCO près de Castelnau.",
        category: "Épicerie zéro déchet",
      },
      {
        id: "loco_verdun",
        name: "Épicerie LOCO Verdun",
        city: "Verdun",
        address: "4437 Rue Wellington, Verdun, QC H4G 1P6",
        website: "https://epicerieloco.ca/loco-verdun",
        lat: 45.454378,
        lng: -73.5676139,
        description: "Succursale LOCO Verdun, épicerie zéro déchet.",
        category: "Épicerie zéro déchet",
      },
      {
        id: "loco_plateau",
        name: "Épicerie LOCO Plateau",
        city: "Montréal",
        address: "368 Av du Mont-Royal E, Montréal, QC H2T 1P9",
        website: "https://www.epicerieloco.ca",
        lat: 45.523474,
        lng: -73.583052,
        description: "Succursale LOCO sur le Plateau Mont-Royal.",
        category: "Épicerie zéro déchet",
      },
      {
        id: "loco_villeray",
        name: "Épicerie LOCO Villeray",
        city: "Montréal",
        address: "422 Rue Jarry E, Montréal, QC H2P 1V3",
        website: "https://epicerieloco.ca",
        lat: 45.543306,
        lng: -73.628303,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet",
      },
      {
        id: "bouquinerie_plateau",
        name: "Bouquinerie du Plateau",
        city: "Montréal",
        address: "437 Av du Mont-Royal E, Montréal, QC",
        website: "https://bouquinerieduplateau.com",
        lat: 45.52518,
        lng: -73.57435,
        description: "Librairie indépendante et bouquinerie emblématique.",
        category: "Librairie & bouquinerie",
      },
      {
        id: "cafe_neve",
        name: "Café Névé",
        city: "Montréal",
        address: "151 Rue Rachel E, Montréal, QC",
        website: "https://cafeneve.com",
        lat: 45.52379,
        lng: -73.57253,
        description: "Café local populaire avec ambiance chaleureuse.",
        category: "Café",
      },
      {
        id: "espace_flo",
        name: "Espace FLO",
        city: "Montréal",
        address: "4306 Rue Sainte-Catherine E, Montréal, QC",
        website: "https://espaceflo.com",
        lat: 45.543751,
        lng: -73.667559,
        description: "Boutique locale avec produits fabriqués au Québec.",
        category: "Boutique locale",
      },
      {
        id: "cafe_myriade",
        name: "Café Myriade",
        city: "Montréal",
        address: "1432 Rue Mackay, Montréal, QC H3G 2H7",
        website: "https://cafemyriade.com",
        lat: 45.49705,
        lng: -73.57891,
        description: "Café indépendant avec torréfaction locale.",
        category: "Café",
      },
      {
        id: "boutique_boreale",
        name: "Boutique Boréale",
        city: "Montréal",
        address: "4 Rue Saint-Paul E, Montréal, QC H2Y 1G1",
        website: "https://www.boutiqueboreale.com",
        lat: 45.505687,
        lng: -73.553581,
        description: "Boutique de cadeaux et d'artisanat local dans le Vieux-Montréal.",
        category: "Boutique locale",
      },
      {
        id: "articho_villeray",
        name: "Articho",
        city: "Montréal",
        address: "300 Rue Villeray, Montréal, QC H2R 1G7",
        website: "https://articho.ca",
        lat: 45.5395717,
        lng: -73.6235742,
        description: "Boutique indépendante proposant des créations locales et artisanales dans Villeray.",
        category: "Boutique locale",
      },
      {
        id: "unicorn_mile_end",
        name: "Boutique Unicorn",
        city: "Montréal",
        address: "5135 Boulevard Saint-Laurent, Montréal, QC H2T 1R9",
        website: "https://www.boutiqueunicorn.com",
        lat: 45.5235374,
        lng: -73.5934975,
        description: "Boutique indépendante de mode locale mettant en lumière des créateurs québécois.",
        category: "Boutique locale",
      },
      {
        id: "empire_mile_end",
        name: "L’Empire de l’échange – Mile End",
        city: "Montréal",
        address: "5225 Boulevard Saint-Laurent, Montréal, QC H2T 1S4",
        website: "https://www.empiremtl.com",
        lat: 45.524204,
        lng: -73.5950112,
        description: "Friperie indépendante du Mile End offrant troc et sélection locale de vêtements.",
        category: "Friperie",
      },
      {
        id: "racines_boreales_hochelaga",
        name: "Racines boréales",
        city: "Montréal",
        address: "4317 Rue Ontario E, Montréal, QC H1V 1K5",
        website: "https://racinesboreales.ca",
        lat: 45.552963,
        lng: -73.540015,
        description: "Épicerie fine indépendante spécialisée dans les produits locaux et saveurs nordiques à Hochelaga.",
        category: "Épicerie locale",
      },
    ],
  });

  const count = await prisma.place.count();
  console.log(`Places insérées: ${count}`);
}

main()
  .catch((e) => {
    console.error("Erreur dans le seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
