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
import { notifyContextSuggestion } from "@/lib/pushNotifications";

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

function buildCopy(params: {
  locale: string | null | undefined;
  categoryKey: string;
  placeName: string;
}) {
  const isFr = params.locale !== "en";
  const name = params.placeName;

  if (isFr) {
    if (params.categoryKey === "epicerie") {
      return {
        title: "Besoin de faire des courses ?",
        body: `${name} peut être une bonne option locale maintenant.`,
      };
    }

    if (params.categoryKey === "bar") {
      return {
        title: "Envie de boire un verre ?",
        body: `${name} est une piste locale à regarder maintenant.`,
      };
    }

    if (params.categoryKey === "cafe") {
      return {
        title: "Envie d’un café ?",
        body: `${name} peut être une bonne pause locale maintenant.`,
      };
    }

    if (params.categoryKey === "boulangerie") {
      return {
        title: "Une pause à la boulangerie ?",
        body: `${name} peut être une option locale maintenant.`,
      };
    }

    if (params.categoryKey === "restaurant" || params.categoryKey === "brunch") {
      return {
        title: "Une idée pour manger local ?",
        body: `${name} peut être une bonne option maintenant.`,
      };
    }

    return {
      title: "Une idée locale maintenant ?",
      body: `${name} peut valoir le détour.`,
    };
  }

  if (params.categoryKey === "epicerie") {
    return {
      title: "Need to pick up groceries?",
      body: `${name} could be a good local option right now.`,
    };
  }

  if (params.categoryKey === "bar") {
    return {
      title: "Want to grab a drink?",
      body: `${name} is a local place to check right now.`,
    };
  }

  if (params.categoryKey === "cafe") {
    return {
      title: "Want a coffee?",
      body: `${name} could be a good local pause right now.`,
    };
  }

  if (params.categoryKey === "boulangerie") {
    return {
      title: "Time for a bakery stop?",
      body: `${name} could be a local option right now.`,
    };
  }

  if (params.categoryKey === "restaurant" || params.categoryKey === "brunch") {
    return {
      title: "Looking for a local meal?",
      body: `${name} could be a good option right now.`,
    };
  }

  return {
    title: "A local idea for now?",
    body: `${name} could be worth checking out.`,
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

  const places = await readPlaces();

  const users = await prisma.user.findMany({
    where: {
      pushDevices: {
        some: {
          platform: "ios",
        },
      },
    },
    select: {
      id: true,
      preferredLocale: true,
      homeCity: true,
    },
    take: limit,
    orderBy: {
      createdAt: "asc",
    },
  });

  const results: Array<{
    userId: string;
    status: "skipped_recent" | "skipped_no_place" | "dry_run" | "sent" | "not_sent";
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

    const pool = preferredPoolForUser(places, user.homeCity);
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
    results,
  });
}
