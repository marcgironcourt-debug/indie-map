import { NextResponse } from "next/server";
import { locales } from "../../../../../i18n";
import { prisma } from "@/lib/prisma";

function normStr(v: unknown, max = 500): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.length > max ? t.slice(0, max) : t;
}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const fd = await req.formData();

    const locale = normStr(fd.get("locale"), 10);
    const name = normStr(fd.get("name"), 200);
    const address = normStr(fd.get("address"), 300);

    if (!locale || !(locales as readonly string[]).includes(locale)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!name || name.length < 2) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (!address || address.length < 5) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const openingHours = normStr(fd.get("openingHours"), 800);
    const phone = normStr(fd.get("phone"), 80);
    const website = normStr(fd.get("website"), 300);

    let photoMime: string | null = null;
    let photoBase64: string | null = null;

    const file = fd.get("photo");
    if (file && typeof file === "object" && "arrayBuffer" in file) {
      const f = file as File;
      if (f.size > 0) {
        if (!f.type || !f.type.startsWith("image/")) {
          return NextResponse.json({ ok: false }, { status: 400 });
        }
        const MAX = 2_000_000;
        if (f.size > MAX) {
          return NextResponse.json({ ok: false, error: "photo_too_large" }, { status: 413 });
        }
        const buf = Buffer.from(await f.arrayBuffer());
        photoMime = f.type;
        photoBase64 = buf.toString("base64");
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = req.headers.get("user-agent") || null;

    await prisma.submission.create({
      data: {
        locale,
        name,
        address,
        openingHours,
        phone,
        website,
        photoMime,
        photoBase64,
        ip,
        userAgent,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[/api/v1/submissions] error", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
