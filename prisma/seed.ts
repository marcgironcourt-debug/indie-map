import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Reset des places...");
  await prisma.place.deleteMany();

  console.log("Insertion des places avec catégories...");
  await prisma.place.createMany({
    data: [
      {

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

        name: "Méga Vrac – Mont-Royal",
        city: "Montréal",
        address: "1951 Avenue du Mont-Royal Est, Montréal, QC H2H 1J5",
        website: "https://megavrac.com",
        lat: 45.534383,
        lng: -73.573445,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet"
      },
{

        name: "Méga Vrac – Masson",
        city: "Montréal",
        address: "3101 Rue Masson, Montréal, QC H1Y 1W1",
        website: "https://megavrac.com",
        lat: 45.5494083,
        lng: -73.5743211,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet"
      },
{

        name: "Méga Vrac – Beaubien",
        city: "Montréal",
        address: "2109 Rue Beaubien Est, Montréal, QC H2G 1M5",
        website: "https://megavrac.com",
        lat: 45.545819,
        lng: -73.594547,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet"
      },
{

        name: "Méga Vrac – Villeray",
        city: "Montréal",
        address: "421 Rue Villeray Est, Montréal, QC H2R 1H2",
        website: "https://megavrac.com",
        lat: 45.541171,
        lng: -73.622908,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet"
      },
{

        name: "Méga Vrac – Hochelaga",
        city: "Montréal",
        address: "3562 Rue Ontario Est, Montréal, QC H1W 1R5",
        website: "https://megavrac.com",
        lat: 45.544539,
        lng: -73.544892,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Épicerie zéro déchet"
      },
{

        name: "Belle et Rebelle",
        city: "Montréal",
        address: "6583A Rue St-Hubert, Montréal, QC H2S 2M5",
        website: "https://belleetrebelle.ca",
        lat: 45.537023,
        lng: -73.604664,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Vêtements"
      },
{

        name: "atelier b",
        city: "Montréal",
        address: "5758 Boulevard St-Laurent, Montréal, QC H2T 1S8",
        website: "https://atelier-b.ca",
        lat: 45.5268613,
        lng: -73.6015982,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Vêtements"
      },
{

        name: "Cokluch",
        city: "Montréal",
        address: "410 Rue Villeray, Montréal, QC H2R 1H3",
        website: "https://cokluch.com",
        lat: 45.5409595,
        lng: -73.6226323,
        description: "Épicerie zéro déchet LOCO dans Villeray.",
        category: "Vêtements"
      },

      {

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

        name: "Boutique Unicorn",
        city: "Montréal",
        address: "5135 Boulevard Saint-Laurent, Montréal, QC H2T 1R9",
        website: "https://www.boutiqueunicorn.com",
        lat: 45.5235374,
        lng: -73.5934975,
        description: "Mode locale et créateurs québécois.",
        category: "Vêtements"
      },

      {

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

        name: "Jennifer Glasgow Design",
        city: "Montréal",
        address: "5145 Boulevard Saint-Laurent, Montréal, QC",
        website: "https://www.jenniferglasgowdesign.com",
        lat: 45.5236062,
        lng: -73.5936195,
        description: "Mode éthique et locale.",
        category: "Vêtements"
      },
      {

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

        name: "Vices & Versa",
        city: "Montréal",
        address: "6631 Boulevard Saint-Laurent, Montréal, QC",
        website: "https://vicesetversa.com",
        lat: 45.5313365,
        lng: -73.6105565,
        description: "Bistro et microbrasseries locales du terroir québécois.",
        category: "Microbrasserie"
      }
    ,
      {
        name: "Romarin - épicerie zéro déchet",
        city: "Montréal",
        address: "5251 Boulevard Saint-Laurent, Montréal, QC H2T 1S4",
        website: "https://www.romarin.ca",
        lat: 45.5244029,
        lng: -73.5953896,
        description: "Épicerie vrac et zéro déchet sur le Plateau.",
        category: "Épicerie zéro déchet"
      },
      {
        name: "Tah-dah !",
        city: "Montréal",
        address: "156 Rue Jean-Talon Est, Montréal, QC H2R 1S7",
        website: "https://www.tah-dah.ca",
        lat: 45.536185,
        lng: -73.61606,
        description: "Boutique cadeaux et objets du quotidien à vocation écoresponsable.",
        category: "Boutique locale"
      },
      {
        name: "Maktaba Bookshop",
        city: "Montréal",
        address: "165 Rue Saint-Paul Ouest, Montréal, QC H2Y 1Z5",
        website: "https://www.maktaba.online",
        lat: 45.5033464,
        lng: -73.5551619,
        description: "Librairie-boutique au cœur du Vieux-Montréal.",
        category: "Librairie"
      },
      {
        name: "La Réserve Naturelle",
        city: "Montréal",
        address: "5854 Rue Saint-Hubert, Montréal, QC H2S 2L7",
        website: "https://www.lareservenaturelle.com",
        lat: 45.5333414,
        lng: -73.5973982,
        description: "Épicerie et boutique axée sur les produits naturels et durables.",
        category: "Boutique locale"
      },
      {
        name: "Slak Atelier-Boutique",
        city: "Montréal",
        address: "352 Rue Villeray Est, Montréal, QC H2R 1G9",
        website: "https://www.slak.ca",
        lat: 45.5402499,
        lng: -73.6231767,
        description: "Atelier-boutique de vêtements confortables et éthiques.",
        category: "Vêtements"
      },
      {
        name: "Café des Habitudes",
        city: "Montréal",
        address: "1104 Rue Saint-Zotique Est, Montréal, QC H2S 2H1",
        website: "https://cafedeshabitudes.co",
        lat: 45.538818,
        lng: -73.603176,
        description: "Café de quartier axé sur les habitudes plus durables.",
        category: "Café"
      },
      {
        name: "Café Rico",
        city: "Montréal",
        address: "1215 Avenue du Mont-Royal Est, Montréal, QC H2J 1X9",
        website: "https://www.caferico.ca",
        lat: 45.529068,
        lng: -73.57841,
        description: "Café-torréfacteur de longue date sur le Plateau.",
        category: "Café"
      },
      {
        name: "Super Condiments",
        city: "Montréal",
        address: "1311 Avenue Van Horne, Outremont, QC H2V 1K7",
        website: "https://www.supercondiments.com",
        lat: 45.5211285,
        lng: -73.6145031,
        description: "Café-épicerie mettant en avant des produits locaux.",
        category: "Café"
      },
      {
        name: "Fanfare Brunch Boulangerie",
        city: "Montréal",
        address: "751 Rue Jarry Est, Montréal, QC H2P 1W3",
        website: "https://www.fanfare-brunch-boulangerie.com",
        lat: 45.546216,
        lng: -73.626834,
        description: "Boulangerie artisanale et brunch de quartier.",
        category: "Boulangerie"
      },
      {
        name: "Café Bloom",
        city: "Montréal",
        address: "1940 Rue du Centre, Montréal, QC H3K 1J2",
        website: "https://www.lecafebloom.com",
        lat: 45.4821607,
        lng: -73.5628779,
        description: "Café-brunch convivial à Pointe-Saint-Charles.",
        category: "Café"
      },
      {
        name: "Candide",
        city: "Montréal",
        address: "551 Rue Saint-Martin, Montréal, QC H3J 2L6",
        website: "https://www.restaurantcandide.com",
        lat: 45.4890629,
        lng: -73.5694589,
        description: "Restaurant locavore axé sur les produits saisonniers.",
        category: "Restaurant"
      },
      {
        name: "BreWskey Taproom",
        city: "Montréal",
        address: "385 Rue de la Commune Est, Montréal, QC H2Y 1H2",
        website: "https://www.brewskey.ca",
        lat: 45.508846,
        lng: -73.551684,
        description: "Taproom de microbrasserie dans le Vieux-Montréal.",
        category: "Microbrasserie"
      },
      {
        name: "Projet Pilote",
        city: "Montréal",
        address: "980 Rue Rachel Est, Montréal, QC H2J 2J3",
        website: "https://www.projetpilote.com",
        lat: 45.525132,
        lng: -73.574626,
        description: "Bar de quartier, microbrasserie et distillerie artisanale.",
        category: "Microbrasserie"
      },
      {
        name: "Wolf & Workman",
        city: "Montréal",
        address: "139 Rue Saint-Paul Ouest, Montréal, QC H2Y 1Z3",
        website: "https://www.wolfandworkman.com",
        lat: 45.5037276,
        lng: -73.5549067,
        description: "Pub moderne mettant en avant les produits locaux.",
        category: "Bar & restaurant"
      },
      {
        name: "vinvinvin",
        city: "Montréal",
        address: "1290 Rue Beaubien Est, Montréal, QC H2S 1P9",
        website: "https://vinvinvin.ca",
        lat: 45.532831,
        lng: -73.605889,
        description: "Bar à vin nature avec une forte sélection locale.",
        category: "Bar à vin"
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
