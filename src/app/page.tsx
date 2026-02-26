import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { locales, defaultLocale } from "../../i18n";

function pickLocale(accept: string | null): string {
  if (!accept) return defaultLocale;
  const parts = accept.split(",").map(p => p.split(";")[0].trim().toLowerCase());
  for (const part of parts) {
    const short = part.split("-")[0];
    if ((locales as readonly string[]).includes(part)) return part;
    if ((locales as readonly string[]).includes(short)) return short;
  }
  return defaultLocale;
}

export default async function Home() {
  const c = await cookies();
  const saved = (c.get("NEXT_LOCALE")?.value ?? "").toLowerCase();

  if ((locales as readonly string[]).includes(saved)) {
    redirect(`/${saved}`);
  }

  const h = await headers();
  const accept = h.get("accept-language");
  const auto = pickLocale(accept);

  redirect(`/${auto}`);
}
