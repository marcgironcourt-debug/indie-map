import createMiddleware from "next-intl/middleware";
import {NextRequest, NextResponse} from "next/server";
import {locales, defaultLocale} from "../i18n";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true
});

export default function proxy(req: NextRequest) {
  const {pathname} = req.nextUrl;

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/choose", req.url));
  }

  const res = intlMiddleware(req);

  const seg = pathname.split("/")[1] || "";
  const candidate = (locales as readonly string[]).includes(seg) ? seg : defaultLocale;

  res.cookies.set("NEXT_LOCALE", candidate, {path: "/"});

  return res;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*|api|choose).*)"]
};
