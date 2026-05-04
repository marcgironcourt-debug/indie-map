import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

function normPlatform(value: unknown) {
  if (typeof value !== "string") return null;
  const platform = value.trim().toLowerCase();
  if (platform !== "ios" && platform !== "android" && platform !== "web") return null;
  return platform;
}

function normToken(value: unknown) {
  if (typeof value !== "string") return null;
  const token = value.trim();
  if (!token || token.length < 16 || token.length > 2000) return null;
  return token;
}

function normSubscription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const subscription = value as {
    endpoint?: unknown;
    keys?: {
      p256dh?: unknown;
      auth?: unknown;
    };
  };

  if (typeof subscription.endpoint !== "string") return null;
  if (!subscription.endpoint.trim()) return null;
  if (!subscription.keys || typeof subscription.keys !== "object") return null;
  if (typeof subscription.keys.p256dh !== "string" || !subscription.keys.p256dh.trim()) return null;
  if (typeof subscription.keys.auth !== "string" || !subscription.keys.auth.trim()) return null;

  return JSON.stringify(subscription);
}

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ ok: false }, { status: 401, headers: V1_HEADERS });
    }

    const body = await req.json().catch(() => null);
    const platform = normPlatform(body?.platform);
    const subscription = normSubscription(body?.subscription);
    const token = normToken(body?.token ?? (subscription ? JSON.parse(subscription).endpoint : null));

    if (!platform || !token) {
      return NextResponse.json({ ok: false, error: "invalid_device" }, { status: 400, headers: V1_HEADERS });
    }

    if ((platform === "android" || platform === "web") && !subscription) {
      return NextResponse.json({ ok: false, error: "invalid_subscription" }, { status: 400, headers: V1_HEADERS });
    }

    const device = await prisma.pushDevice.upsert({
      where: { token },
      update: {
        userId: currentUser.id,
        platform,
        subscription,
      },
      create: {
        userId: currentUser.id,
        platform,
        token,
        subscription,
      },
      select: {
        id: true,
        platform: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        device: {
          ...device,
          createdAt: device.createdAt.toISOString(),
          updatedAt: device.updatedAt.toISOString(),
        },
      },
      { headers: V1_HEADERS }
    );
  } catch (err) {
    console.error("[/api/v1/me/push-devices] POST error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
