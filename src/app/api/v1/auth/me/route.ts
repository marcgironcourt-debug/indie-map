import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const V1_HEADERS = {
  "X-API-Version": "1",
} as const;

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ ok: true, user: null }, { headers: V1_HEADERS });
    }

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    }, { headers: V1_HEADERS });
  } catch (err) {
    console.error("[/api/v1/auth/me] error", err);
    return NextResponse.json({ ok: false }, { status: 500, headers: V1_HEADERS });
  }
}
