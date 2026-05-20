import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  isContextSuggestionCandidateOpen,
  normalizeContextCategory,
  pickContextPlaces,
  type ContextSuggestionPlace,
} from "@/lib/contextSuggestions";
import { notifyContextSuggestion, notifyReactivation } from "@/lib/pushNotifications";

export const dynamic = "force-dynamic";

type LocalPlace = ContextSuggestionPlace & {
  name: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
};

type RawPlace = {
  id?: unknown;
  name?: unknown;
  city?: unknown;
  country?: unknown;
  category?: unknown;
  openingHours?: unknown;
  timeZone?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  lat?: unknown;
  lng?: unknown;
};

function isRawPlace(value: unknown): value is RawPlace {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

const DEFAULT_COOLDOWN_DAYS = 6;
const DEFAULT_LOCATION_MAX_AGE_DAYS = 5;
const DEFAULT_REACTIVATION_INACTIVE_DAYS = 10;
const DEFAULT_REACTIVATION_COOLDOWN_DAYS = 14;
const CONTEXTUAL_NOTIFICATION_RADIUS_KM = 10;
const REACTIVATION_CATEGORY_KEY = "reactivation";

function getBaseUrl() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "https://preview.marcgironcourt-debugs-projects.vercel.app";

  return raw.replace(/\/+$/, "");
}

function isAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.CONTEXTUAL_NOTIFICATIONS_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function getCooldownDays() {
  const raw = Number(process.env.CONTEXTUAL_NOTIFICATIONS_COOLDOWN_DAYS || DEFAULT_COOLDOWN_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_COOLDOWN_DAYS;
  return Math.max(5, Math.min(14, Math.floor(raw)));
}

function getLocationMaxAgeDays() {
  const raw = Number(process.env.CONTEXTUAL_NOTIFICATIONS_LOCATION_MAX_AGE_DAYS || DEFAULT_LOCATION_MAX_AGE_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_LOCATION_MAX_AGE_DAYS;
  return Math.max(1, Math.min(10, Math.floor(raw)));
}

function getReactivationInactiveDays() {
  const raw = Number(process.env.REACTIVATION_INACTIVE_DAYS || DEFAULT_REACTIVATION_INACTIVE_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_REACTIVATION_INACTIVE_DAYS;
  return Math.max(7, Math.min(30, Math.floor(raw)));
}

function getReactivationCooldownDays() {
  const raw = Number(process.env.REACTIVATION_COOLDOWN_DAYS || DEFAULT_REACTIVATION_COOLDOWN_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_REACTIVATION_COOLDOWN_DAYS;
  return Math.max(7, Math.min(30, Math.floor(raw)));
}

async function readPlaces() {
  const filePath = path.join(process.cwd(), "data", "places.json");
  const raw = await fs.promises.readFile(filePath, "utf8");
  const parsed: unknown = JSON.parse(raw);
  const arr = Array.isArray(parsed) ? parsed : [];

  return arr
    .filter(isRawPlace)
    .map((item): LocalPlace => ({
      id: String(item.id ?? "").trim(),
      name: String(item.name ?? "").trim(),
      city: String(item.city ?? "").trim() || undefined,
      country: String(item.country ?? "").trim() || undefined,
      category: String(item.category ?? "").trim() || undefined,
      openingHours: String(item.openingHours ?? "").trim() || undefined,
      timeZone: String(item.timeZone ?? "").trim() || undefined,
      createdAt: String(item.createdAt ?? "").trim() || undefined,
      updatedAt: String(item.updatedAt ?? "").trim() || undefined,
      lat: typeof item.lat === "number" ? item.lat : undefined,
      lng: typeof item.lng === "number" ? item.lng : undefined,
    }))
    .filter((item) => {
      return (
        item.id.length > 0 &&
        item.name.length > 0 &&
        Number.isFinite(item.lat) &&
        Number.isFinite(item.lng)
      );
    });
}

function normalizeLoose(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function preferredPoolForUser(places: LocalPlace[], homeCity: string | null | undefined) {
  const city = normalizeLoose(homeCity);
  if (!city) return places;

  const local = places.filter((place) => normalizeLoose(place.city) === city);
  return local.length > 0 ? local : places;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

function buildReactivationCopy(locale: string | null | undefined) {
  const isFr = locale !== "en";

  if (isFr) {
    return {
      title: "Ça fait un moment",
      body: "Reviens trouver une idée locale pour ta prochaine sortie.",
    };
  }

  return {
    title: "It’s been a while",
    body: "Come back and find a local idea for your next outing.",
  };
}

function buildCopy(params: {
  locale: string | null | undefined;
  categoryKey: string;
  placeName: string;
}) {
  const isFr = params.locale !== "en";
  const name = params.placeName;

  if (isFr) {
    if (params.categoryKey === "cafe") {
      return {
        title: "Besoin d’une vraie pause ?",
        body: `Passe chez ${name} pour boire un café proche de toi et ralentir un moment.`,
      };
    }

    if (params.categoryKey === "boulangerie") {
      return {
        title: "Une envie de pain ou de douceur ?",
        body: `${name} est tout près pour prendre du pain, une viennoiserie ou quelque chose de bon.`,
      };
    }

    if (params.categoryKey === "restaurant") {
      return {
        title: "Et si tu mangeais local ?",
        body: `${name} n’est pas loin pour découvrir une table locale.`,
      };
    }

    if (params.categoryKey === "brunch") {
      return {
        title: "Envie d’un brunch près de toi ?",
        body: `${name} est proche de toi pour manger, boire un café et prendre le temps.`,
      };
    }

    if (params.categoryKey === "bar") {
      return {
        title: "Envie de sortir un peu ?",
        body: `${name} est pas loin pour boire un verre dans un lieu local.`,
      };
    }

    if (params.categoryKey === "epicerie") {
      return {
        title: "Tes prochaines courses peuvent être plus locales",
        body: `${name} est tout près pour remplir ton panier autrement.`,
      };
    }

    if (params.categoryKey === "ferme") {
      return {
        title: "Envie de produits plus directs ?",
        body: `${name} est à proximité pour acheter des produits locaux et retrouver un lien avec les producteurs.`,
      };
    }

    if (params.categoryKey === "librairie") {
      return {
        title: "Un livre à chercher près de toi ?",
        body: `${name} est proche de toi pour feuilleter, demander conseil ou repartir avec une lecture.`,
      };
    }

    if (params.categoryKey === "boutique") {
      return {
        title: "Quelque chose à trouver près de toi ?",
        body: `${name} est pas loin pour chercher un objet, un cadeau ou une pièce locale.`,
      };
    }

    if (params.categoryKey === "atelier") {
      return {
        title: "Voir un savoir-faire local ?",
        body: `${name} est à proximité pour découvrir un atelier, une création ou le travail d’un artisan.`,
      };
    }

    if (params.categoryKey === "alternatif") {
      return {
        title: "Envie d’un lieu qui change ?",
        body: `${name} est proche de toi pour boire un verre, voir un événement ou découvrir une autre ambiance.`,
      };
    }

    if (params.categoryKey === "marche") {
      return {
        title: "Faire un tour au marché ?",
        body: `${name} est pas loin pour marcher, choisir des produits et rencontrer des producteurs locaux.`,
      };
    }

    return {
      title: "Un lieu local à découvrir",
      body: `${name} est à proximité si tu veux faire quelque chose de différent près de toi.`,
    };
  }

  if (params.categoryKey === "cafe") {
    return {
      title: "Need a real break?",
      body: `Stop by ${name} for a nearby coffee and a moment to slow down.`,
    };
  }

  if (params.categoryKey === "boulangerie") {
    return {
      title: "Craving bread or something sweet?",
      body: `${name} is close by for bread, a pastry, or something good.`,
    };
  }

  if (params.categoryKey === "restaurant") {
    return {
      title: "What about eating local?",
      body: `${name} is not far away to discover a local table.`,
    };
  }

  if (params.categoryKey === "brunch") {
    return {
      title: "Want brunch nearby?",
      body: `${name} is close to you for food, coffee, and taking your time.`,
    };
  }

  if (params.categoryKey === "bar") {
    return {
      title: "Feel like going out?",
      body: `${name} is nearby for a drink in a local place.`,
    };
  }

  if (params.categoryKey === "epicerie") {
    return {
      title: "Your next groceries can be more local",
      body: `${name} is close by if you want to fill your basket differently.`,
    };
  }

  if (params.categoryKey === "ferme") {
    return {
      title: "Want products with a more direct link?",
      body: `${name} is nearby for local products and a closer link with producers.`,
    };
  }

  if (params.categoryKey === "librairie") {
    return {
      title: "Looking for a book nearby?",
      body: `${name} is close to you if you want to browse, ask for advice, or leave with a read.`,
    };
  }

  if (params.categoryKey === "boutique") {
    return {
      title: "Looking for something nearby?",
      body: `${name} is nearby if you want to find an object, a gift, or a local piece.`,
    };
  }

  if (params.categoryKey === "atelier") {
    return {
      title: "Want to see local craft?",
      body: `${name} is nearby to discover a workshop, a creation, or an artisan’s work.`,
    };
  }

  if (params.categoryKey === "alternatif") {
    return {
      title: "Want a place that feels different?",
      body: `${name} is close to you for a drink, an event, or a different atmosphere.`,
    };
  }

  if (params.categoryKey === "marche") {
    return {
      title: "Want to walk through a market?",
      body: `${name} is nearby if you want to walk around, choose products, and meet local producers.`,
    };
  }

  return {
    title: "A local place to discover",
    body: `${name} is nearby if you want to do something different close to you.`,
  };
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dryRun") === "1";
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 25) || 25));
  const now = new Date();
  const cooldownDays = getCooldownDays();
  const cooldownSince = new Date(now.getTime() - cooldownDays * 24 * 60 * 60 * 1000);
  const locationMaxAgeDays = getLocationMaxAgeDays();
  const locationFreshSince = new Date(now.getTime() - locationMaxAgeDays * 24 * 60 * 60 * 1000);
  const reactivationInactiveDays = getReactivationInactiveDays();
  const reactivationCooldownDays = getReactivationCooldownDays();
  const reactivationInactiveSince = new Date(now.getTime() - reactivationInactiveDays * 24 * 60 * 60 * 1000);
  const reactivationCooldownSince = new Date(now.getTime() - reactivationCooldownDays * 24 * 60 * 60 * 1000);

  const places = await readPlaces();

  const users = await prisma.user.findMany({
    where: {
      pushDevices: {
        some: {
          platform: {
            in: ["ios", "android", "web"],
          },
        },
      },
    },
    select: {
      id: true,
      preferredLocale: true,
      homeCity: true,
      lastKnownLat: true,
      lastKnownLng: true,
      lastKnownLocationAt: true,
      lastSeenAt: true,
    },
    take: limit,
    orderBy: {
      createdAt: "asc",
    },
  });

  const results: Array<{
    userId: string;
    status: "skipped_recent" | "skipped_no_location" | "skipped_no_place" | "dry_run" | "sent" | "sent_reactivation" | "not_sent" | "not_sent_reactivation";
    placeId?: string;
    categoryKey?: string;
    attempted?: number;
    sent?: number;
  }> = [];

  for (const user of users) {
    const recent = await prisma.contextualNotificationLog.findFirst({
      where: {
        userId: user.id,
        sentAt: {
          gte: cooldownSince,
        },
      },
      select: {
        id: true,
      },
    });

    if (recent) {
      results.push({ userId: user.id, status: "skipped_recent" });
      continue;
    }

    if (!user.lastSeenAt || user.lastSeenAt <= reactivationInactiveSince) {
      const recentReactivation = await prisma.contextualNotificationLog.findFirst({
        where: {
          userId: user.id,
          categoryKey: REACTIVATION_CATEGORY_KEY,
          sentAt: {
            gte: reactivationCooldownSince,
          },
        },
        select: {
          id: true,
        },
      });

      if (!recentReactivation) {
        const locale = user.preferredLocale === "en" ? "en" : "fr";
        const copy = buildReactivationCopy(user.preferredLocale);
        const notificationUrl = `${getBaseUrl()}/${locale}`;

        if (dryRun) {
          results.push({
            userId: user.id,
            status: "dry_run",
            categoryKey: REACTIVATION_CATEGORY_KEY,
          });
          continue;
        }

        const sent = await notifyReactivation({
          userId: user.id,
          title: copy.title,
          body: copy.body,
          url: notificationUrl,
        });

        if (sent.sent > 0) {
          await prisma.contextualNotificationLog.create({
            data: {
              userId: user.id,
              categoryKey: REACTIVATION_CATEGORY_KEY,
              title: copy.title,
              body: copy.body,
            },
          });

          results.push({
            userId: user.id,
            status: "sent_reactivation",
            categoryKey: REACTIVATION_CATEGORY_KEY,
            attempted: sent.attempted,
            sent: sent.sent,
          });
          continue;
        }

        results.push({
          userId: user.id,
          status: "not_sent_reactivation",
          categoryKey: REACTIVATION_CATEGORY_KEY,
          attempted: sent.attempted,
          sent: sent.sent,
        });
        continue;
      }
    }

    const userLat = Number(user.lastKnownLat);
    const userLng = Number(user.lastKnownLng);

    if (
      !Number.isFinite(userLat) ||
      !Number.isFinite(userLng) ||
      !user.lastKnownLocationAt ||
      user.lastKnownLocationAt < locationFreshSince
    ) {
      results.push({ userId: user.id, status: "skipped_no_location" });
      continue;
    }

    const nearbyPlaces = places.filter((place) => {
      const lat = Number(place.lat);
      const lng = Number(place.lng);
      return Number.isFinite(lat) && Number.isFinite(lng) && haversineKm(userLat, userLng, lat, lng) <= CONTEXTUAL_NOTIFICATION_RADIUS_KM;
    });

    const pool = preferredPoolForUser(nearbyPlaces, user.homeCity);
    const openCandidates = pickContextPlaces(pool.filter(isContextSuggestionCandidateOpen), now);
    const fallbackCandidates = pickContextPlaces(pool, now);
    const place = openCandidates[0] ?? fallbackCandidates[0] ?? null;

    if (!place) {
      results.push({ userId: user.id, status: "skipped_no_place" });
      continue;
    }

    const categoryKey = normalizeContextCategory(place.category);
    const copy = buildCopy({
      locale: user.preferredLocale,
      categoryKey,
      placeName: place.name,
    });

    const locale = user.preferredLocale === "en" ? "en" : "fr";
    const notificationUrl = `${getBaseUrl()}/${locale}/carte?discover=${encodeURIComponent(place.id)}`;

    if (dryRun) {
      results.push({
        userId: user.id,
        status: "dry_run",
        placeId: place.id,
        categoryKey,
      });
      continue;
    }

    const sent = await notifyContextSuggestion({
      userId: user.id,
      title: copy.title,
      body: copy.body,
      url: notificationUrl,
      placeId: place.id,
      categoryKey,
    });

    if (sent.sent > 0) {
      await prisma.contextualNotificationLog.create({
        data: {
          userId: user.id,
          categoryKey,
          placeId: place.id,
          title: copy.title,
          body: copy.body,
        },
      });

      results.push({
        userId: user.id,
        status: "sent",
        placeId: place.id,
        categoryKey,
        attempted: sent.attempted,
        sent: sent.sent,
      });
    } else {
      results.push({
        userId: user.id,
        status: "not_sent",
        placeId: place.id,
        categoryKey,
        attempted: sent.attempted,
        sent: sent.sent,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    dryRun,
    cooldownDays,
    checkedUsers: users.length,
    locationMaxAgeDays,
    reactivationInactiveDays,
    reactivationCooldownDays,
    results,
  });
}
