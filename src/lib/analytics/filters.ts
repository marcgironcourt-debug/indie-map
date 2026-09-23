export const FILTER_COOKIE = "indie-analytics-filters-v1";
export const VIEWS = ["summary", "audience", "accounts", "usage", "places", "quality"] as const;
export type Filters = { view: string; period: string; from: string; to: string; traffic: string; platform: string; place: string };
export type Query = Record<string, string | string[] | undefined>;
const scalar = (v: unknown) => typeof v === "string" ? v : "";
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function resolveFilters(query: Query, saved: Partial<Filters> = {}, now = new Date()): Filters {
  const value = (key: keyof Filters) => scalar(query[key]) || scalar(saved[key]);
  const today = now.toISOString().slice(0, 10);
  const period = ["today", "yesterday", "7d", "30d", "all", "custom"].includes(value("period")) ? value("period") : "today";
  let from = value("from"), to = value("to");
  if (!validDate(from)) from = today;
  if (!validDate(to)) to = today;
  if (from > to) [from, to] = [to, from];
  return { view: VIEWS.includes(value("view") as typeof VIEWS[number]) ? value("view") : "summary", period, from, to,
    traffic: ["external", "test", "all"].includes(value("traffic")) ? value("traffic") : "external",
    platform: ["all", "ios", "android", "web"].includes(value("platform")) ? value("platform") : "all",
    place: scalar(query.place).slice(0, 200) };
}
export function periodRange(filters: Filters, now = new Date()) {
  const day = 86_400_000;
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  let start = today, end = now;
  if (filters.period === "all") return { start: null, end: now, previousStart: null, previousEnd: null, label: "Depuis le début du suivi" };
  if (filters.period === "yesterday") { start = new Date(+today - day); end = today; }
  if (filters.period === "7d" || filters.period === "30d") start = new Date(+today - (filters.period === "7d" ? 6 : 29) * day);
  if (filters.period === "custom") { start = new Date(filters.from + "T00:00:00Z"); end = new Date(Math.min(+new Date(filters.to + "T00:00:00Z") + day, +now)); }
  if (+start > +end) start = end;
  const duration = +end - +start;
  const format = (d: Date) => d.toLocaleDateString("fr-FR", {timeZone: "UTC"});
  return {start, end, previousStart: new Date(+start - duration), previousEnd: start,
    label: filters.period === "today" ? `Aujourd’hui · ${format(today)}` : filters.period === "yesterday" ? `Hier · ${format(start)}` : `${format(start)} → ${format(new Date(Math.max(+start, +end - 1)))}`};
}
