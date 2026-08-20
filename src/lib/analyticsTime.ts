
export function normalizeTimeZone(value: unknown) {
  if (typeof value !== "string") return null;

  const clean = value.trim().slice(0, 120);
  if (!clean) return null;

  try {
    new Intl.DateTimeFormat("en-US", {
      timeZone: clean,
    }).format(new Date());

    return clean;
  } catch {
    return null;
  }
}

export function parseUtcOffsetMinutes(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN;

  if (!Number.isInteger(parsed)) return null;
  if (parsed < -14 * 60 || parsed > 14 * 60) return null;

  return parsed;
}

export function localDateAndHour(
  date: Date,
  timeZone: string | null,
) {
  const safeTimeZone = timeZone || "UTC";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  const localDate =
    `${values.year}-${values.month}-${values.day}`;

  const localHour = Number(values.hour);

  return {
    localDate,
    localHour:
      Number.isInteger(localHour) &&
      localHour >= 0 &&
      localHour <= 23
        ? localHour
        : null,
  };
}
