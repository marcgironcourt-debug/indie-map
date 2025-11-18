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
        website: "https://www.epicerieloco.ca/loco-castelnau/",
        lat: 45.538302,
        lng: -73.617971,
        description: "Succursale LOCO près de Castelnau.",
        category: "Épicerie zéro déchet"
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
        category: "Épicerie zéro déchet"
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
        category: "Épicerie zéro déchet"
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
        category: "Épicerie zéro déchet"
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
        category: "Librairie & bouquinerie"
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
        category: "Café"
      },

      {
        id: "cafe_dei_campi",
        name: "Café Dei Campi",
        city: "Montréal",
        address: "6201 Rue Chabot, Montréal, QC H2G 2T3",
        website: "https://cafedeicampi.ca",
        lat: 45.5429336,
        lng: -73.5924071,
        description: "Café italien végétalien, pâtisseries et pains faits maison dans Rosemont.",
        category: "Café"
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
        category: "Boutique locale"
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
        category: "Café"
      },
      {
        id: "boutique_boreale",
        name: "Boutique Boréale",
        city: "Montréal",
        address: "4 Rue Saint-Paul E, Montréal, QC H2Y 1G1",
        website: "https://www.boutiqueboreale.com",
        lat: 45.505687,
        lng: -73.553581,
        description: "Boutique de cadeaux et d'artisanat local.",
        category: "Boutique locale"
      },
      {
        id: "articho_villeray",
        name: "Articho",
        city: "Montréal",
        address: "300 Rue Villeray, Montréal, QC H2R 1G7",
        website: "https://articho.ca",
        lat: 45.5395717,
        lng: -73.6235742,
        description: "Boutique artisanale indépendante.",
        category: "Boutique locale"
      },
      {
        id: "unicorn_mile_end",
        name: "Boutique Unicorn",
        city: "Montréal",
        address: "5135 Boulevard Saint-Laurent, Montréal, QC H2T 1R9",
        website: "https://www.boutiqueunicorn.com",
        lat: 45.5235374,
        lng: -73.5934975,
        description: "Mode locale et créateurs québécois.",
        category: "Mode éthique"
      },

      {
        id: "arloca_st_hubert",
        name: "Arloca",
        city: "Montréal",
        address: "6572 rue St-Hubert, Montréal, QC H2S 2M3",
        website: "https://arloca.com",
        lat: 45.5366037,
        lng: -73.6044411,
        description: "Boutique de cadeaux et objets fabriqués localement au Canada.",
        category: "Boutique locale"
      },
      {
        id: "empire_mile_end",
        name: "L’Empire de l’échange – Mile End",
        city: "Montréal",
        address: "5225 Boulevard Saint-Laurent, Montréal, QC H2T 1S4",
        website: "https://www.empiremtl.com",
        lat: 45.524204,
        lng: -73.5950112,
        description: "Friperie indépendante du Mile End.",
        category: "Friperie"
      },
      {
        id: "racines_boreales_hochelaga",
        name: "Racines boréales",
        city: "Montréal",
        address: "4317 Rue Ontario E, Montréal, QC H1V 1K5",
        website: "https://racinesboreales.ca",
        lat: 45.552963,
        lng: -73.540015,
        description: "Épicerie fine locale.",
        category: "Épicerie locale"
      },
      {
        id: "librairie_lechange",
        name: "Librairie L'Échange",
        city: "Montréal",
        address: "713 Avenue du Mont-Royal E, Montréal, QC H2J 1W7",
        website: null,
        lat: 45.525495,
        lng: -73.581859,
        description: "Librairie de livres d'occasion.",
        category: "Librairie & bouquinerie"
      },
      {
        id: "de_stiil_booksellers",
        name: "De Stiil Booksellers",
        city: "Montréal",
        address: "351 Avenue Duluth E, Montréal, QC H2W 1J3",
        website: "https://destiil.com",
        lat: 45.520475,
        lng: -73.576281,
        description: "Librairie art et design.",
        category: "Librairie spécialisée"
      },
      {
        id: "jennifer_glasgow_mile_end",
        name: "Jennifer Glasgow Design",
        city: "Montréal",
        address: "5145 Boulevard Saint-Laurent, Montréal, QC",
        website: "https://www.jenniferglasgowdesign.com",
        lat: 45.5236062,
        lng: -73.5936195,
        description: "Mode éthique et locale.",
        category: "Mode éthique"
      },
      {
        id: "toque_montreal",
        name: "Restaurant Toqué!",
        city: "Montréal",
        address: "900 Place Jean-Paul-Riopelle, Montréal, QC H2Z 2B2",
        website: "https://www.restaurant-toque.com",
        lat: 45.50288,
        lng: -73.561123,
        description: "Restaurant gastronomique terroir.",
        category: "Restaurant locavore"
      },
      {
        id: "helicoptere_hochelaga",
        name: "Hélicoptère",
        city: "Montréal",
        address: "4255 Rue Ontario E, Montréal, QC H1V 1K4",
        website: "https://helicopteremtl.com",
        lat: 45.552253,
        lng: -73.540218,
        description: "Restaurant farm-to-table local.",
        category: "Restaurant locavore"
      },
      {
        id: "panacee_village",
        name: "Panacée",
        city: "Montréal",
        address: "1701 Rue Atateken, Montréal, QC H2L 3L4",
        website: "https://www.restaurantpanacee.com",
        lat: 45.5191309,
        lng: -73.5604881,
        description: "Cuisine du marché locale.",
        category: "Restaurant locavore"
      },
      {
        id: "les_momes_villeray",
        name: "Les Mômes",
        city: "Montréal",
        address: "586 Rue Villeray, Montréal, QC H2R 1H6",
        website: "https://www.lesmomesmtl.com",
        lat: 45.5423493,
        lng: -73.6219743,
        description: "Bistro terroir.",
        category: "Restaurant locavore"
      },
      {
        id: "o_thym_village",
        name: "O’Thym",
        city: "Montréal",
        address: "1257 Rue Atateken, Montréal, QC H2L 3K9",
        website: "https://www.othym.com",
        lat: 45.5171445,
        lng: -73.5559925,
        description: "Restaurant AVV local.",
        category: "Restaurant locavore abordable"
      },
      {
        id: "caribou_gourmand_mile_end",
        name: "Caribou Gourmand",
        city: "Montréal",
        address: "5308 Boulevard Saint-Laurent, Montréal, QC H2T 1S1",
        website: "https://www.caribougourmand.com",
        lat: 45.5244396,
        lng: -73.5963436,
        description: "Bistro terroir du Mile End.",
        category: "Bistro terroir et local"
      },
      {
        id: "rose_ross_masson",
        name: "Rose Ross",
        city: "Montréal",
        address: "3017 Rue Masson, Montréal, QC H1Y 1X7",
        website: "https://roseross.net",
        lat: 45.548966,
        lng: -73.5745686,
        description: "Restaurant de quartier cuisine du marché.",
        category: "Cuisine du marché"
      },
      {
        id: "hof_kelsten",
        name: "Hof Kelsten",
        city: "Montréal",
        address: "4524 Boulevard Saint-Laurent, Montréal, QC H2T 1R4",
        website: "https://hofkelsten.com",
        lat: 45.5202679,
        lng: -73.5870403,
        description: "Boulangerie artisanale réputée du Mile End.",
        category: "Boulangerie artisanale"
      },
      {
        id: "pain_dans_les_voiles",
        name: "Le Pain dans les Voiles",
        city: "Montréal",
        address: "357 Rue de Castelnau E, Montréal, QC H2R 1R1",
        website: "https://lepaindanslesvoiles.com",
        lat: 45.538767,
        lng: -73.617753,
        description: "Boulangerie artisanale reconnue pour ses pains et viennoiseries.",
        category: "Boulangerie artisanale"
      },
      {
        id: "automne_boulangerie",
        name: "Automne Boulangerie",
        city: "Montréal",
        address: "6500 Avenue Christophe-Colomb, Montréal, QC",
        website: "https://www.automneboulangerie.com",
        lat: 45.5377139,
        lng: -73.6018052,
        description: "Boulangerie artisanale de quartier.",
        category: "Boulangerie artisanale"
      },
      {
        id: "sarrasin_boulangerie",
        name: "Sarrasin Boulangerie",
        city: "Montréal",
        address: "Mile End, Montréal, QC",
        website: "https://sarrasinboulangerie.com",
        lat: 45.5201859,
        lng: -73.596701,
        description: "Micro-boulangerie bio et sans gluten.",
        category: "Boulangerie artisanale"
      },
      {
        id: "dieu_du_ciel_laurier",
        name: "Dieu du Ciel!",
        city: "Montréal",
        address: "21 Avenue Laurier Ouest, Montréal, QC",
        website: "https://www.automneboulangerie.com",
        lat: 45.522839,
        lng: -73.593344,
        description: "Microbrasserie artisanale emblématique du Plateau.",
        category: "Microbrasserie"
      },
      {
        id: "vices_versa_parc_ex",
        name: "Vices & Versa",
        city: "Montréal",
        address: "6631 Boulevard Saint-Laurent, Montréal, QC",
        website: "https://vicesetversa.com",
        lat: 45.5313365,
        lng: -73.6105565,
        description: "Bistro et microbrasseries locales du terroir québécois.",
        category: "Microbrasserie"
      }
    ]
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
