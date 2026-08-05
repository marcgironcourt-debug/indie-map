import { cookies } from "next/headers";
import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE = "im_session";

export const AUTH_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 365;
const AUTH_SESSION_REFRESH_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 180;

export function makeSessionExpiresAt(now = Date.now()) {
  return new Date(now + AUTH_SESSION_TTL_MS);
}

export function makeToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizeUsername(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (!raw) return null;
  const clean = raw.replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 24);
  if (clean.length < 3) return null;
  return clean;
}

export function normalizePassword(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 200) return null;
  return value;
}

function scryptAsync(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(derivedKey as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string | null | undefined) {
  if (!storedHash) return false;
  const parts = storedHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const hash = parts[2];
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const derivedKey = await scryptAsync(password, salt);
  if (expected.length !== derivedKey.length) return false;
  return timingSafeEqual(expected, derivedKey);
}

export function usernameFromEmail(email: string) {
  const base = email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "user";
  return base || "user";
}

export async function makeUniqueUsername(email: string) {
  const base = usernameFromEmail(email);
  for (let i = 0; i < 20; i += 1) {
    const username = i === 0 ? base : `${base}_${i + 1}`;
    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (!existing) return username;
  }
  return `${base}_${randomBytes(4).toString("hex")}`;
}

export async function getCurrentUser() {
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE)?.value;
  if (!raw) return null;

  const token = hashToken(raw);
  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  const now = Date.now();
  const lastSeenAt = session.user.lastSeenAt?.getTime() ?? 0;

  if (now - lastSeenAt > 5 * 60 * 1000) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date(now) },
      select: { id: true },
    }).catch(() => null);
  }

  return session.user;
}

export async function refreshCurrentSession() {
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE)?.value;

  if (!raw) return false;

  const token = hashToken(raw);
  const session = await prisma.userSession.findUnique({
    where: { token },
    select: {
      id: true,
      expiresAt: true,
    },
  });

  if (!session) return false;

  const now = Date.now();

  if (session.expiresAt.getTime() <= now) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => null);

    jar.set(AUTH_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    return false;
  }

  if (session.expiresAt.getTime() - now > AUTH_SESSION_REFRESH_THRESHOLD_MS) {
    return true;
  }

  const expiresAt = makeSessionExpiresAt(now);

  await prisma.userSession.update({
    where: { id: session.id },
    data: { expiresAt },
  });

  jar.set(AUTH_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return true;
}
