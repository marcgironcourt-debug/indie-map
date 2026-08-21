import type { ReactNode } from "react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import {
  getProfessionalPlaceAnalyticsForUser,
  normalizeProfessionalAnalyticsRange,
} from "@/lib/professionalAnalytics";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    locale: string;
  }>;

  searchParams: Promise<{
    placeId?: string;
    range?: string;
  }>;
};

const COLORS = {
  orange: "#F47A3A",
  orangeSoft: "#E99A67",
  olive: "#8D854D",
  oliveLight: "#B5AA6A",
  cream: "#E9DFC5",
  sage: "#8FA77B",
  sageLight: "#B0C39E",
  clay: "#C96F50",
  mustard: "#C7A451",
  sand: "#D7C6A0",
};

const SOURCE_COLORS = [
  COLORS.orange,
  COLORS.oliveLight,
  COLORS.sage,
  COLORS.clay,
  COLORS.mustard,
  COLORS.sand,
];

const SOURCE_LABELS_FR:
  Record<string, string> = {
    recent_additions: "Ajouts récents",
    recent_additions_all: "Ajouts récents",
    discovery_of_day: "Découverte du jour",
    search_result: "Recherche",
    mini_window: "Carte",
    map: "Carte",
    map_detail: "Carte",
    home_detail: "Accueil",
    home_detail_create: "Accueil",
    personal_space: "Espace personnel",
    personal_space_saved_place: "Favoris",
    shared_list: "Liste partagée",
    shared_list_search: "Liste partagée",
    friend_visited_place: "Profil d’un ami",
    other: "Autres",
    unknown: "Autres",
  };

const SOURCE_LABELS_EN:
  Record<string, string> = {
    recent_additions: "Recent additions",
    recent_additions_all: "Recent additions",
    discovery_of_day: "Discovery of the day",
    search_result: "Search",
    mini_window: "Map",
    map: "Map",
    map_detail: "Map",
    home_detail: "Home",
    home_detail_create: "Home",
    personal_space: "Personal space",
    personal_space_saved_place: "Saved places",
    shared_list: "Shared list",
    shared_list_search: "Shared list",
    friend_visited_place: "Friend profile",
    other: "Other",
    unknown: "Other",
  };

const AGE_LABELS_FR:
  Record<string, string> = {
    "18_24": "18–24 ans",
    "25_34": "25–34 ans",
    "35_44": "35–44 ans",
    "45_54": "45–54 ans",
    "55_64": "55–64 ans",
    "65_plus": "65 ans et +",
  };

const AGE_LABELS_EN:
  Record<string, string> = {
    "18_24": "18–24",
    "25_34": "25–34",
    "35_44": "35–44",
    "45_54": "45–54",
    "55_64": "55–64",
    "65_plus": "65+",
  };

const WEEKDAYS_FR = [
  "",
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
];

const WEEKDAYS_EN = [
  "",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

function numberLabel(
  value: number,
  locale: string,
) {
  return new Intl.NumberFormat(
    locale === "fr"
      ? "fr-FR"
      : "en-US",
  ).format(value);
}

function percent(
  numerator: number,
  denominator: number,
) {
  if (denominator <= 0) {
    return 0;
  }

  return Math.round(
    (numerator / denominator) * 100,
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#22231C]/95 shadow-[0_22px_70px_rgba(0,0,0,0.20)]">
      <div className="border-b border-white/[0.07] px-5 py-5 sm:px-6">
        <h2 className="font-serif text-[23px] font-semibold tracking-tight text-[#F3EBD8]">
          {title}
        </h2>

        {subtitle ? (
          <p className="mt-1 max-w-3xl text-[12px] leading-relaxed text-white/42">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="p-5 sm:p-6">
        {children}
      </div>
    </section>
  );
}

function KpiCard({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#24251E] p-5 shadow-[0_15px_45px_rgba(0,0,0,0.18)]">
      <div
        className="absolute left-0 top-0 h-full w-[4px]"
        style={{
          background: color,
        }}
      />

      <div
        className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.08] blur-xl"
        style={{
          background: color,
        }}
      />

      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/38">
        {label}
      </div>

      <div
        className="mt-3 text-[34px] font-semibold leading-none tracking-[-0.04em]"
        style={{
          color,
        }}
      >
        {value}
      </div>

      <p className="mt-3 min-h-[32px] text-[11px] leading-relaxed text-white/42">
        {detail}
      </p>
    </div>
  );
}

function chartPoints(
  values: number[],
  width: number,
  height: number,
  maxValue: number,
) {
  const left = 48;
  const right = 20;
  const top = 30;
  const bottom = 30;

  return values.map(
    (value, index) => {
      const x =
        values.length === 1
          ? (left + width - right) / 2
          : left +
            (index /
              (values.length - 1)) *
              (width -
                left -
                right);

      const y =
        height -
        bottom -
        (value / maxValue) *
          (height -
            top -
            bottom);

      return {
        x,
        y,
        value,
      };
    },
  );
}

function pathFromPoints(
  points: Array<{
    x: number;
    y: number;
  }>,
) {
  return points
    .map(
      (point, index) =>
        `${
          index === 0
            ? "M"
            : "L"
        } ${point.x.toFixed(
          1,
        )} ${point.y.toFixed(
          1,
        )}`,
    )
    .join(" ");
}

function VisibilityChart({
  rows,
  isFr,
}: {
  rows: Array<{
    date: string;
    views: number;
    visitors: number;
  }>;
  isFr: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-[13px] text-white/35">
        {isFr
          ? "Pas encore de données sur cette période."
          : "No data for this period yet."}
      </div>
    );
  }

  const width = 760;
  const height = 260;

  const maxRaw =
    Math.max(
      1,
      ...rows.map((row) =>
        Math.max(
          row.views,
          row.visitors,
        ),
      ),
    );

  const maxValue =
    Math.max(
      4,
      Math.ceil(
        maxRaw / 4,
      ) * 4,
    );

  const viewsPoints =
    chartPoints(
      rows.map(
        (row) => row.views,
      ),
      width,
      height,
      maxValue,
    );

  const visitorPoints =
    chartPoints(
      rows.map(
        (row) =>
          row.visitors,
      ),
      width,
      height,
      maxValue,
    );

  const viewsPath =
    pathFromPoints(
      viewsPoints,
    );

  const visitorsPath =
    pathFromPoints(
      visitorPoints,
    );

  const yTicks =
    [0, 1, 2, 3, 4].map(
      (index) =>
        Math.round(
          (maxValue / 4) *
            index,
        ),
    );

  const dateIndexes =
    Array.from(
      new Set([
        0,
        Math.floor(
          (rows.length - 1) / 2,
        ),
        rows.length - 1,
      ]),
    );

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-5 text-[11px] font-medium text-white/55">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background:
                COLORS.orange,
            }}
          />
          {isFr
            ? "Vues de fiche"
            : "Place views"}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background:
                COLORS.cream,
            }}
          />
          {isFr
            ? "Visiteurs uniques"
            : "Unique visitors"}
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[620px] w-full"
          aria-label={
            isFr
              ? "Évolution des vues et visiteurs"
              : "Views and visitors trend"
          }
        >
          {yTicks.map(
            (tick) => {
              const y =
                height -
                30 -
                (tick /
                  maxValue) *
                  (height -
                    60);

              return (
                <g key={tick}>
                  <line
                    x1="48"
                    x2={width - 20}
                    y1={y}
                    y2={y}
                    stroke="rgba(255,255,255,0.075)"
                    strokeWidth="1"
                  />

                  <text
                    x="36"
                    y={y + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill="rgba(255,255,255,0.34)"
                  >
                    {tick}
                  </text>
                </g>
              );
            },
          )}

          <defs>
            <linearGradient
              id="visibility-area-v3"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop
                offset="0%"
                stopColor={
                  COLORS.orange
                }
                stopOpacity="0.22"
              />

              <stop
                offset="100%"
                stopColor={
                  COLORS.orange
                }
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {viewsPoints.length >
          1 ? (
            <path
              d={`${viewsPath} L ${
                viewsPoints[
                  viewsPoints.length -
                    1
                ].x
              } ${height - 30} L ${
                viewsPoints[0].x
              } ${height - 30} Z`}
              fill="url(#visibility-area-v3)"
            />
          ) : null}

          <path
            d={viewsPath}
            fill="none"
            stroke={COLORS.orange}
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          <path
            d={visitorsPath}
            fill="none"
            stroke={COLORS.cream}
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="7 6"
          />

          {viewsPoints.map(
            (point, index) => (
              <g
                key={`view-${index}`}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill={
                    COLORS.orange
                  }
                  stroke="#22231C"
                  strokeWidth="2"
                />

              </g>
            ),
          )}

          {visitorPoints.map(
            (point, index) => (
              <g
                key={`visitor-${index}`}
              >
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="3.5"
                  fill={
                    COLORS.cream
                  }
                  stroke="#22231C"
                  strokeWidth="2"
                />

              </g>
            ),
          )}

          {dateIndexes.map(
            (index) => {
              const point =
                viewsPoints[index];

              if (!point) {
                return null;
              }

              return (
                <text
                  key={`date-${index}`}
                  x={point.x}
                  y={height - 7}
                  textAnchor={
                    index === 0
                      ? "start"
                      : index ===
                          rows.length -
                            1
                        ? "end"
                        : "middle"
                  }
                  fontSize="9"
                  fill="rgba(255,255,255,0.30)"
                >
                  {rows[index]
                    ?.date ?? ""}
                </text>
              );
            },
          )}

          {rows.map(
            (row, index) => {
              const point =
                viewsPoints[index];

              if (!point) {
                return null;
              }

              const previousX =
                viewsPoints[
                  index - 1
                ]?.x ?? 48;

              const nextX =
                viewsPoints[
                  index + 1
                ]?.x ??
                width - 20;

              const hoverLeft =
                index === 0
                  ? 48
                  : (
                      previousX +
                      point.x
                    ) / 2;

              const hoverRight =
                index ===
                rows.length - 1
                  ? width - 20
                  : (
                      point.x +
                      nextX
                    ) / 2;

              const tooltipWidth =
                168;

              const tooltipHeight =
                66;

              const tooltipX =
                Math.max(
                  6,
                  Math.min(
                    width -
                      tooltipWidth -
                      6,
                    point.x -
                      tooltipWidth /
                        2,
                  ),
                );

              const tooltipY = 8;

              const formattedDate =
                (() => {
                  try {
                    return new Intl.DateTimeFormat(
                      isFr
                        ? "fr-FR"
                        : "en-US",
                      {
                        day: "numeric",
                        month: "long",
                        timeZone:
                          "UTC",
                      },
                    ).format(
                      new Date(
                        `${row.date}T12:00:00Z`,
                      ),
                    );
                  } catch {
                    return row.date;
                  }
                })();

              return (
                <g
                  key={`hover-${row.date}`}
                  className="group"
                >
                  <rect
                    x={hoverLeft}
                    y="0"
                    width={Math.max(
                      1,
                      hoverRight -
                        hoverLeft,
                    )}
                    height={
                      height - 30
                    }
                    fill="transparent"
                    className="cursor-crosshair"
                  />

                  <line
                    x1={point.x}
                    x2={point.x}
                    y1="28"
                    y2={height - 30}
                    stroke="rgba(243,235,216,0.20)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                    className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                  />

                  <g className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    <rect
                      x={
                        tooltipX
                      }
                      y={
                        tooltipY
                      }
                      width={
                        tooltipWidth
                      }
                      height={
                        tooltipHeight
                      }
                      rx="11"
                      fill="#151610"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth="1"
                    />

                    <text
                      x={
                        tooltipX +
                        12
                      }
                      y={
                        tooltipY +
                        18
                      }
                      fontSize="10"
                      fontWeight="700"
                      fill="#F3EBD8"
                    >
                      {
                        formattedDate
                      }
                    </text>

                    <circle
                      cx={
                        tooltipX +
                        14
                      }
                      cy={
                        tooltipY +
                        36
                      }
                      r="3"
                      fill={
                        COLORS.orange
                      }
                    />

                    <text
                      x={
                        tooltipX +
                        23
                      }
                      y={
                        tooltipY +
                        39
                      }
                      fontSize="9"
                      fill="rgba(255,255,255,0.72)"
                    >
                      {row.views}{" "}
                      {isFr
                        ? row.views > 1
                          ? "vues de fiche"
                          : "vue de fiche"
                        : row.views > 1
                          ? "place views"
                          : "place view"}
                    </text>

                    <circle
                      cx={
                        tooltipX +
                        14
                      }
                      cy={
                        tooltipY +
                        53
                      }
                      r="3"
                      fill={
                        COLORS.cream
                      }
                    />

                    <text
                      x={
                        tooltipX +
                        23
                      }
                      y={
                        tooltipY +
                        56
                      }
                      fontSize="9"
                      fill="rgba(255,255,255,0.72)"
                    >
                      {row.visitors}{" "}
                      {isFr
                        ? row.visitors > 1
                          ? "visiteurs uniques"
                          : "visiteur unique"
                        : row.visitors > 1
                          ? "unique visitors"
                          : "unique visitor"}
                    </text>
                  </g>
                </g>
              );
            },
          )}
        </svg>
      </div>
    </div>
  );
}

type DonutSegment = {
  label: string;
  value: number;
  color: string;
};

function DonutChart({
  segments,
  centerValue,
  centerLabel,
  locale,
}: {
  segments: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  locale: string;
}) {
  const active =
    segments.filter(
      (segment) =>
        segment.value > 0,
    );

  const total =
    active.reduce(
      (sum, segment) =>
        sum + segment.value,
      0,
    );

  let cursor = 0;

  const gradient =
    total > 0
      ? `conic-gradient(${active
          .map((segment) => {
            const start =
              cursor;

            const end =
              cursor +
              (segment.value /
                total) *
                100;

            cursor = end;

            return `${segment.color} ${start}% ${end}%`;
          })
          .join(", ")})`
      : "conic-gradient(rgba(255,255,255,0.08) 0 100%)";

  return (
    <div className="grid gap-6 sm:grid-cols-[180px_1fr] sm:items-center">
      <div className="mx-auto">
        <div
          className="relative h-[170px] w-[170px] rounded-full"
          style={{
            background: gradient,
          }}
        >
          <div className="absolute inset-[17px] flex flex-col items-center justify-center rounded-full bg-[#22231C] text-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]">
            <div className="text-[27px] font-semibold tracking-[-0.04em] text-[#F3EBD8]">
              {centerValue}
            </div>

            <div className="mt-1 max-w-[90px] text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-white/35">
              {centerLabel}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {active.length > 0 ? (
          active.map(
            (segment) => (
              <div
                key={
                  segment.label
                }
                className="flex items-center gap-3"
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    background:
                      segment.color,
                  }}
                />

                <span className="min-w-0 flex-1 text-[12px] text-white/60">
                  {segment.label}
                </span>

                <span className="text-[12px] font-semibold text-[#F3EBD8]">
                  {percent(
                    segment.value,
                    total,
                  )}
                  %
                </span>

                <span className="w-7 text-right text-[10px] text-white/30">
                  {numberLabel(
                    segment.value,
                    locale,
                  )}
                </span>
              </div>
            ),
          )
        ) : (
          <p className="text-[12px] text-white/35">
            —
          </p>
        )}
      </div>
    </div>
  );
}

function HorizontalBars({
  rows,
  locale,
}: {
  rows: Array<{
    label: string;
    value: number;
    color: string;
  }>;
  locale: string;
}) {
  const max =
    Math.max(
      1,
      ...rows.map(
        (row) => row.value,
      ),
    );

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const width =
          row.value === 0
            ? 0
            : Math.max(
                5,
                Math.round(
                  (row.value /
                    max) *
                    100,
                ),
              );

        return (
          <div key={row.label}>
            <div className="mb-1.5 flex items-center justify-between gap-4">
              <span className="text-[12px] text-white/62">
                {row.label}
              </span>

              <span
                className="text-[12px] font-semibold"
                style={{
                  color:
                    row.color,
                }}
              >
                {numberLabel(
                  row.value,
                  locale,
                )}
              </span>
            </div>

            <div className="h-[8px] overflow-hidden rounded-full bg-white/[0.07]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${width}%`,
                  background:
                    row.color,
                  boxShadow:
                    row.value > 0
                      ? `0 0 18px ${row.color}33`
                      : undefined,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Journey({
  uniqueVisitors,
  interestVisitors,
  actionVisitors,
  visitVisitors,
  locale,
  isFr,
}: {
  uniqueVisitors: number;
  interestVisitors: number;
  actionVisitors: number;
  visitVisitors: number;
  locale: string;
  isFr: boolean;
}) {
  const rows = [
    {
      label: isFr
        ? "Ont consulté votre fiche"
        : "Viewed your place",
      value: uniqueVisitors,
      color: COLORS.orange,
    },
    {
      label: isFr
        ? "Ont enregistré, ajouté ou partagé"
        : "Saved, listed or shared",
      value: interestVisitors,
      color: COLORS.oliveLight,
    },
    {
      label: isFr
        ? "Ont effectué une action vers votre établissement"
        : "Took an action toward your business",
      value: actionVisitors,
      color: COLORS.sage,
    },
    {
      label: isFr
        ? "Ont déclaré une visite"
        : "Declared a visit",
      value: visitVisitors,
      color: COLORS.clay,
    },
  ];

  return (
    <div className="space-y-3">
      {rows.map(
        (row, index) => {
          const ratio =
            index === 0
              ? 100
              : percent(
                  row.value,
                  uniqueVisitors,
                );

          return (
            <div
              key={row.label}
              className="rounded-2xl border border-white/[0.06] bg-black/[0.08] px-4 py-3.5"
            >
              <div className="flex items-end justify-between gap-4">
                <div>
                  <div className="text-[12px] font-medium text-white/68">
                    {row.label}
                  </div>

                  <div className="mt-1 text-[10px] text-white/32">
                    {index === 0
                      ? isFr
                        ? "Base des visiteurs uniques"
                        : "Unique visitor base"
                      : `${ratio} %`}
                  </div>
                </div>

                <div
                  className="text-[18px] font-semibold"
                  style={{
                    color:
                      row.color,
                  }}
                >
                  {numberLabel(
                    row.value,
                    locale,
                  )}
                </div>
              </div>

              <div className="mt-3 h-[7px] overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${
                      index === 0
                        ? 100
                        : Math.min(
                            100,
                            ratio,
                          )
                    }%`,
                    background:
                      row.color,
                  }}
                />
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}

function ColumnChart({
  rows,
  isFr,
}: {
  rows: Array<{
    label: string;
    views: number;
    actions: number;
  }>;
  isFr: boolean;
}) {
  const max =
    Math.max(
      1,
      ...rows.flatMap(
        (row) => [
          row.views,
          row.actions,
        ],
      ),
    );

  return (
    <div>
      <div className="mb-4 flex gap-4 text-[10px] text-white/42">
        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background:
                COLORS.orange,
            }}
          />
          {isFr
            ? "Vues"
            : "Views"}
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              background:
                COLORS.sage,
            }}
          />
          {isFr
            ? "Actions vers l’établissement"
            : "Business actions"}
        </div>
      </div>

      <div className="flex h-[190px] items-end gap-2 border-b border-white/[0.08]">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex min-w-0 flex-1 flex-col items-center"
          >
            <div className="flex h-[145px] w-full items-end justify-center gap-1">
              <div className="flex h-full w-[34%] min-w-[5px] flex-col justify-end">
                {row.views >
                0 ? (
                  <div
                    className="mb-1 text-center text-[8px] font-semibold text-[#F47A3A]"
                  >
                    {row.views}
                  </div>
                ) : null}

                <div
                  className="w-full rounded-t-md"
                  style={{
                    height:
                      row.views ===
                      0
                        ? 0
                        : `${Math.max(
                            5,
                            (row.views /
                              max) *
                              85,
                          )}%`,
                    background:
                      COLORS.orange,
                  }}
                />
              </div>

              <div className="flex h-full w-[34%] min-w-[5px] flex-col justify-end">
                {row.actions >
                0 ? (
                  <div className="mb-1 text-center text-[8px] font-semibold text-[#8FA77B]">
                    {row.actions}
                  </div>
                ) : null}

                <div
                  className="w-full rounded-t-md"
                  style={{
                    height:
                      row.actions ===
                      0
                        ? 0
                        : `${Math.max(
                            5,
                            (row.actions /
                              max) *
                              85,
                          )}%`,
                    background:
                      COLORS.sage,
                  }}
                />
              </div>
            </div>

            <div className="mt-2 truncate text-[9px] text-white/38 sm:text-[10px]">
              {row.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrivacyDistribution({
  title,
  explanation,
  unavailableText,
  available,
  sampleSize,
  minimum,
  rows,
  locale,
}: {
  title: string;
  explanation: string;
  unavailableText: string;
  available: boolean;
  sampleSize: number;
  minimum: number;
  rows: Array<{
    label: string;
    value: number;
  }>;
  locale: string;
}) {
  return (
    <div className="rounded-[22px] border border-white/[0.07] bg-black/[0.08] p-4 sm:p-5">
      <h3 className="text-[13px] font-semibold text-[#F3EBD8]">
        {title}
      </h3>

      <p className="mt-1 text-[10px] leading-relaxed text-white/35">
        {explanation}
      </p>

      {available ? (
        <div className="mt-5">
          <HorizontalBars
            locale={locale}
            rows={rows.map(
              (row, index) => ({
                label:
                  row.label,
                value:
                  row.value,
                color:
                  SOURCE_COLORS[
                    index %
                      SOURCE_COLORS.length
                  ],
              }),
            )}
          />

          <p className="mt-4 text-[9px] text-white/28">
            {sampleSize}{" "}
            {locale === "fr"
              ? "visiteurs concernés"
              : "eligible visitors"}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[#8D854D]/20 bg-[#8D854D]/[0.07] px-4 py-4">
          <div className="text-[12px] font-semibold text-[#C9C08A]">
            {unavailableText}
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-white/35">
            {locale === "fr"
              ? `Cette répartition apparaît à partir de ${minimum} visiteurs concernés. Échantillon actuel : ${sampleSize}.`
              : `This breakdown appears from ${minimum} eligible visitors. Current sample: ${sampleSize}.`}
          </p>
        </div>
      )}
    </div>
  );
}

export default async function ProfessionalDataPage({
  params,
  searchParams,
}: Props) {
  const { locale } =
    await params;

  const query =
    await searchParams;

  const isFr =
    locale === "fr";

  const currentUser =
    await getCurrentUser();

  if (!currentUser) {
    return (
      <main className="fixed inset-0 overflow-y-auto bg-[#181914] px-4 py-8 text-white">
        <div className="mx-auto max-w-[960px]">
          <Link
            href={`/${locale}`}
            className="text-[13px] text-white/50"
          >
            ← Indie Map
          </Link>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-[#23241D] p-7">
            <h1 className="font-serif text-[34px] text-[#F3EBD8]">
              {isFr
                ? "Espace pro"
                : "Professional space"}
            </h1>

            <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-white/55">
              {isFr
                ? "Connectez-vous à votre compte Indie Map pour accéder aux données de votre lieu."
                : "Sign in to your Indie Map account to access your place data."}
            </p>

            <Link
              href={`/${locale}?panel=personalSpace`}
              className="mt-6 inline-flex rounded-full bg-[#F47A3A] px-5 py-3 text-[13px] font-semibold text-white"
            >
              {isFr
                ? "Se connecter"
                : "Sign in"}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const range =
    normalizeProfessionalAnalyticsRange(
      query.range,
    );

  const data =
    await getProfessionalPlaceAnalyticsForUser(
      {
        userId:
          currentUser.id,

        requestedPlaceId:
          query.placeId,

        range,
      },
    );

  if (!data) {
    return (
      <main className="fixed inset-0 overflow-y-auto bg-[#181914] px-4 py-8 text-white">
        <div className="mx-auto max-w-[960px]">
          <Link
            href={`/${locale}`}
            className="text-[13px] text-white/50"
          >
            ← Indie Map
          </Link>

          <p className="mt-8 text-white/65">
            {isFr
              ? "Ce lieu n’est pas accessible depuis votre compte."
              : "This place is not available from your account."}
          </p>
        </div>
      </main>
    );
  }

  if (
    !data.selected ||
    !data.stats
  ) {
    return (
      <main className="fixed inset-0 overflow-y-auto bg-[#181914] px-4 py-8 text-white">
        <div className="mx-auto max-w-[960px]">
          <Link
            href={`/${locale}`}
            className="text-[13px] text-white/50"
          >
            ← Indie Map
          </Link>

          <div className="mt-8 rounded-[28px] border border-white/10 bg-[#23241D] p-7">
            <h1 className="font-serif text-[34px] text-[#F3EBD8]">
              {isFr
                ? "Espace pro"
                : "Professional space"}
            </h1>

            <p className="mt-3 text-[14px] text-white/55">
              {isFr
                ? "Aucun lieu professionnel actif n’est associé à votre compte."
                : "No active professional place is linked to your account."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const {
    selected,
    stats,
  } = data;

  const summary =
    stats.summary;

  const sourceLabels =
    isFr
      ? SOURCE_LABELS_FR
      : SOURCE_LABELS_EN;

  const groupedSources =
    new Map<
      string,
      number
    >();

  for (const source of stats.sources) {
    const label =
      sourceLabels[
        source.source
      ] ||
      sourceLabels.other;

    groupedSources.set(
      label,
      (groupedSources.get(
        label,
      ) ?? 0) +
        source.views,
    );
  }

  const sourceSegments =
    Array.from(
      groupedSources.entries(),
    )
      .sort(
        (a, b) =>
          b[1] - a[1],
      )
      .map(
        ([label, value], index) => ({
          label,
          value,
          color:
            SOURCE_COLORS[
              index %
                SOURCE_COLORS.length
            ],
        }),
      );

  const interestRows = [
    {
      label: isFr
        ? "Favoris ajoutés"
        : "Saved",
      value:
        summary.saves,
      color:
        COLORS.oliveLight,
    },
    {
      label: isFr
        ? "Ajouts à une liste"
        : "Added to lists",
      value:
        summary.lists,
      color:
        COLORS.sand,
    },
    {
      label: isFr
        ? "Partages initiés"
        : "Shares started",
      value:
        summary.shares,
      color:
        COLORS.orangeSoft,
    },
  ];

  const establishmentRows = [
    {
      label: isFr
        ? "Site internet"
        : "Website",
      value:
        summary.websites,
      color:
        COLORS.orange,
    },
    {
      label: isFr
        ? "Itinéraire"
        : "Directions",
      value:
        summary.itineraries,
      color:
        COLORS.mustard,
    },
    {
      label: isFr
        ? "Téléphone"
        : "Phone",
      value:
        summary.phones,
      color:
        COLORS.sage,
    },
    {
      label: isFr
        ? "Adresse copiée"
        : "Address copied",
      value:
        summary.copiedAddresses,
      color:
        COLORS.sageLight,
    },
  ];

  const weekdayLabels =
    isFr
      ? WEEKDAYS_FR
      : WEEKDAYS_EN;

  const weekdayMap =
    new Map(
      stats.weekdays.map(
        (row) => [
          row.weekday,
          row,
        ],
      ),
    );

  const weekdayRows =
    Array.from(
      { length: 7 },
      (_, index) => {
        const weekday =
          index + 1;

        const existing =
          weekdayMap.get(
            weekday,
          );

        return {
          label:
            weekdayLabels[
              weekday
            ],

          views:
            existing?.views ??
            0,

          actions:
            existing?.strongIntents ??
            0,
        };
      },
    );

  const hourBuckets = [
    {
      label: "00–05",
      from: 0,
      to: 5,
    },
    {
      label: "06–09",
      from: 6,
      to: 9,
    },
    {
      label: "10–12",
      from: 10,
      to: 12,
    },
    {
      label: "13–16",
      from: 13,
      to: 16,
    },
    {
      label: "17–20",
      from: 17,
      to: 20,
    },
    {
      label: "21–23",
      from: 21,
      to: 23,
    },
  ];

  const hourRows =
    hourBuckets.map(
      (bucket) => {
        const matching =
          stats.hours.filter(
            (row) =>
              row.hour >=
                bucket.from &&
              row.hour <=
                bucket.to,
          );

        return {
          label:
            bucket.label,

          views:
            matching.reduce(
              (sum, row) =>
                sum +
                row.views,
              0,
            ),

          actions:
            matching.reduce(
              (sum, row) =>
                sum +
                row.strongIntents,
              0,
            ),
        };
      },
    );

  const nonRepeatVisitors =
    Math.max(
      0,
      summary.uniqueVisitors -
        summary.repeatVisitors,
    );

  const audienceSegments =
    range !== "all"
      ? [
          {
            label: isFr
              ? "Nouveaux"
              : "New",
            value:
              summary.newVisitors ??
              0,
            color:
              COLORS.orange,
          },
          {
            label: isFr
              ? "De retour"
              : "Returning",
            value:
              summary.returningVisitors ??
              0,
            color:
              COLORS.oliveLight,
          },
        ]
      : [
          {
            label: isFr
              ? "Une seule consultation"
              : "One view",
            value:
              nonRepeatVisitors,
            color:
              COLORS.orangeSoft,
          },
          {
            label: isFr
              ? "Plusieurs consultations"
              : "Repeat visitors",
            value:
              summary.repeatVisitors,
            color:
              COLORS.oliveLight,
          },
        ];

  const actionVisitorRate =
    percent(
      summary.strongIntentViewers,
      summary.uniqueVisitors,
    );

  const homeCityRows =
    stats.audience.homeCities.rows.map(
      (row) => ({
        label: row.label,
        value:
          row.visitors,
      }),
    );

  const ageLabels =
    isFr
      ? AGE_LABELS_FR
      : AGE_LABELS_EN;

  const ageRows =
    stats.audience.ageRanges.rows.map(
      (row) => ({
        label:
          ageLabels[
            row.label
          ] ||
          row.label,

        value:
          row.visitors,
      }),
    );

  const consultationCityRows =
    stats.audience.consultationCities.rows.map(
      (row) => ({
        label: [
          row.city,
          row.country,
        ]
          .filter(Boolean)
          .join(" · "),

        value:
          row.visitors,
      }),
    );

  function hrefFor(
    next: {
      placeId?: string;
      range?: string;
    },
  ) {
    const params =
      new URLSearchParams();

    params.set(
      "placeId",
      next.placeId ??
        selected.placeId,
    );

    params.set(
      "range",
      next.range ??
        range,
    );

    return `/${locale}/espace-pro/donnees?${params.toString()}`;
  }

  return (
    <main className="fixed inset-0 touch-pan-y overflow-y-auto overscroll-y-contain bg-[#181914] text-white [-webkit-overflow-scrolling:touch]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-[180px] -top-[220px] h-[520px] w-[520px] rounded-full bg-[#8D854D]/[0.08] blur-[90px]" />
        <div className="absolute -right-[180px] top-[180px] h-[480px] w-[480px] rounded-full bg-[#F47A3A]/[0.055] blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-[1120px] px-4 pb-16 pt-5 sm:px-6 sm:pt-7">
        <div className="flex items-center justify-between">
          <Link
            href={`/${locale}`}
            className="text-[12px] font-medium text-white/42 transition hover:text-white/75"
          >
            ← Indie Map
          </Link>

          <div className="rounded-full border border-[#8D854D]/40 bg-[#8D854D]/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#C9C08A]">
            {isFr
              ? "Espace pro"
              : "Professional"}
          </div>
        </div>

        <header className="mt-7 overflow-hidden rounded-[30px] border border-white/[0.08] bg-[#22231C] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.22)] sm:p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#A99E63]">
            {isFr
              ? "Données de votre lieu"
              : "Your place data"}
          </p>

          <h1 className="mt-3 font-serif text-[36px] font-semibold leading-none tracking-[-0.025em] text-[#F3EBD8] sm:text-[48px]">
            {selected.name}
          </h1>

          <p className="mt-3 text-[13px] text-white/45">
            {[
              selected.category,
              selected.city,
              selected.country,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {data.places.length >
          1 ? (
            <div className="mt-6 flex flex-wrap gap-2">
              {data.places.map(
                (place) => (
                  <Link
                    key={
                      place.placeId
                    }
                    href={hrefFor({
                      placeId:
                        place.placeId,
                    })}
                    className={
                      place.placeId ===
                      selected.placeId
                        ? "rounded-full bg-[#F3EBD8] px-4 py-2 text-[11px] font-semibold text-[#1D1E18]"
                        : "rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/50"
                    }
                  >
                    {place.name}
                  </Link>
                ),
              )}
            </div>
          ) : null}

          <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.07] pt-5">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  key: "7d",
                  fr: "7 jours",
                  en: "7 days",
                },
                {
                  key: "30d",
                  fr: "30 jours",
                  en: "30 days",
                },
                {
                  key: "all",
                  fr: "Depuis le début",
                  en: "All time",
                },
              ].map((item) => (
                <Link
                  key={item.key}
                  href={hrefFor({
                    range:
                      item.key,
                  })}
                  className={
                    range ===
                    item.key
                      ? "rounded-full bg-[#F47A3A] px-4 py-2 text-[11px] font-semibold text-white shadow-[0_7px_22px_rgba(244,122,58,0.20)]"
                      : "rounded-full border border-white/[0.09] bg-white/[0.04] px-4 py-2 text-[11px] font-semibold text-white/50"
                  }
                >
                  {isFr
                    ? item.fr
                    : item.en}
                </Link>
              ))}
            </div>

            <p className="text-[10px] text-white/28">
              {selected.timeZone}
            </p>
          </div>
        </header>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            label={
              isFr
                ? "Vues de fiche"
                : "Place views"
            }
            value={numberLabel(
              summary.views,
              locale,
            )}
            detail={
              isFr
                ? "Nombre total d’ouvertures de votre fiche."
                : "Total place page views."
            }
            color={
              COLORS.orange
            }
          />

          <KpiCard
            label={
              isFr
                ? "Visiteurs uniques"
                : "Unique visitors"
            }
            value={numberLabel(
              summary.uniqueVisitors,
              locale,
            )}
            detail={
              isFr
                ? "Personnes distinctes ayant consulté votre lieu."
                : "Distinct people who viewed your place."
            }
            color={
              COLORS.cream
            }
          />

          <KpiCard
            label={
              isFr
                ? "Actions vers votre établissement"
                : "Actions toward your business"
            }
            value={numberLabel(
              summary.strongIntents,
              locale,
            )}
            detail={
              isFr
                ? `${summary.strongIntentViewers} visiteur(s) · site, itinéraire, téléphone ou adresse.`
                : `${summary.strongIntentViewers} visitor(s) · website, directions, phone or address.`
            }
            color={
              COLORS.sage
            }
          />

          <KpiCard
            label={
              isFr
                ? "Visites déclarées"
                : "Declared visits"
            }
            value={numberLabel(
              summary.visitDeclarations,
              locale,
            )}
            detail={
              isFr
                ? "Visites explicitement déclarées dans Indie Map."
                : "Visits explicitly declared in Indie Map."
            }
            color={
              COLORS.clay
            }
          />
        </div>

        <div className="mt-5 space-y-5">
          <Section
            title={
              isFr
                ? "Votre visibilité"
                : "Your visibility"
            }
            subtitle={
              isFr
                ? "Évolution des vues de votre fiche et du nombre de visiteurs distincts."
                : "How your place views and unique visitors evolve."
            }
          >
            <VisibilityChart
              rows={
                stats.daily
              }
              isFr={isFr}
            />
          </Section>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section
              title={
                isFr
                  ? "Comment on vous découvre"
                  : "How people discover you"
              }
              subtitle={
                isFr
                  ? "Origine des ouvertures de votre fiche dans Indie Map."
                  : "Where your place views come from inside Indie Map."
              }
            >
              <DonutChart
                segments={
                  sourceSegments
                }
                centerValue={numberLabel(
                  summary.views,
                  locale,
                )}
                centerLabel={
                  isFr
                    ? "vues"
                    : "views"
                }
                locale={locale}
              />
            </Section>

            <Section
              title={
                isFr
                  ? "Nouveaux et habitués"
                  : "New and returning"
              }
              subtitle={
                range !== "all"
                  ? isFr
                    ? "Personnes qui découvrent votre fiche et personnes qui l’avaient déjà consultée."
                    : "People discovering your place and people who had already viewed it."
                  : isFr
                    ? "Part des visiteurs qui reviennent consulter votre fiche."
                    : "Share of visitors who return to your place."
              }
            >
              <DonutChart
                segments={
                  audienceSegments
                }
                centerValue={numberLabel(
                  summary.uniqueVisitors,
                  locale,
                )}
                centerLabel={
                  isFr
                    ? "visiteurs"
                    : "visitors"
                }
                locale={locale}
              />
            </Section>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Section
              title={
                isFr
                  ? "Intérêt"
                  : "Interest"
              }
              subtitle={
                isFr
                  ? "Les utilisateurs souhaitent garder, organiser ou partager votre lieu."
                  : "Users want to save, organize or share your place."
              }
            >
              <HorizontalBars
                rows={
                  interestRows
                }
                locale={locale}
              />

              <div className="mt-6 rounded-2xl border border-[#B5AA6A]/20 bg-[#B5AA6A]/[0.07] px-4 py-3">
                <div className="text-[22px] font-semibold text-[#C9C08A]">
                  {numberLabel(
                    summary.interestVisitors,
                    locale,
                  )}
                </div>

                <p className="mt-1 text-[10px] leading-relaxed text-white/38">
                  {isFr
                    ? "visiteur(s) distinct(s) ont enregistré, ajouté à une liste ou partagé votre lieu."
                    : "distinct visitor(s) saved, listed or shared your place."}
                </p>
              </div>
            </Section>

            <Section
              title={
                isFr
                  ? "Actions vers votre établissement"
                  : "Actions toward your business"
              }
              subtitle={
                isFr
                  ? "Des actions concrètes pouvant précéder une visite : site internet, itinéraire, appel ou copie de l’adresse."
                  : "Concrete actions that may precede a visit: website, directions, phone or copied address."
              }
            >
              <HorizontalBars
                rows={
                  establishmentRows
                }
                locale={locale}
              />

              <div className="mt-6 rounded-2xl border border-[#8FA77B]/20 bg-[#8FA77B]/[0.07] px-4 py-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-[22px] font-semibold text-[#AFC39D]">
                    {numberLabel(
                      summary.strongIntentViewers,
                      locale,
                    )}
                  </span>

                  <span className="text-[11px] text-white/35">
                    {actionVisitorRate} %
                  </span>
                </div>

                <p className="mt-1 text-[10px] leading-relaxed text-white/38">
                  {isFr
                    ? "visiteur(s) distinct(s) ont réalisé au moins une de ces actions. Cela indique un intérêt concret, sans prouver une visite ou un achat."
                    : "distinct visitor(s) performed at least one of these actions. This shows concrete interest but does not prove a visit or purchase."}
                </p>
              </div>
            </Section>
          </div>

          <Section
            title={
              isFr
                ? "Parcours d’intérêt"
                : "Interest journey"
            }
            subtitle={
              isFr
                ? "Nombre de visiteurs distincts qui avancent dans leur relation avec votre lieu."
                : "Distinct visitors moving through different levels of engagement with your place."
            }
          >
            <Journey
              uniqueVisitors={
                summary.uniqueVisitors
              }
              interestVisitors={
                summary.interestVisitors
              }
              actionVisitors={
                summary.strongIntentViewers
              }
              visitVisitors={
                summary.visitViewers
              }
              locale={locale}
              isFr={isFr}
            />
          </Section>

          <Section
            title={
              isFr
                ? "Qui s’intéresse à votre lieu"
                : "Who is interested in your place"
            }
            subtitle={
              isFr
                ? "Données agrégées uniquement. Les répartitions détaillées apparaissent lorsqu’un échantillon minimum protège suffisamment la confidentialité."
                : "Aggregated data only. Detailed breakdowns appear once the minimum sample protects privacy."
            }
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <PrivacyDistribution
                title={
                  isFr
                    ? "Ville de résidence"
                    : "Home city"
                }
                explanation={
                  isFr
                    ? "Ville renseignée volontairement dans le profil Indie Map."
                    : "City voluntarily provided in the Indie Map profile."
                }
                unavailableText={
                  isFr
                    ? "Pas encore assez de données de résidence"
                    : "Not enough home-city data yet"
                }
                available={
                  stats.audience.homeCities.available
                }
                sampleSize={
                  stats.audience.homeCities.sampleSize
                }
                minimum={
                  stats.audience.privacyMinimum
                }
                rows={
                  homeCityRows
                }
                locale={locale}
              />

              <PrivacyDistribution
                title={
                  isFr
                    ? "Ville de consultation"
                    : "Viewing city"
                }
                explanation={
                  isFr
                    ? "Ville estimée à partir de la session Indie Map associée à la consultation."
                    : "City estimated from the Indie Map session associated with the view."
                }
                unavailableText={
                  isFr
                    ? "Pas encore assez de consultations géolocalisées"
                    : "Not enough geolocated views yet"
                }
                available={
                  stats.audience.consultationCities.available
                }
                sampleSize={
                  stats.audience.consultationCities.sampleSize
                }
                minimum={
                  stats.audience.privacyMinimum
                }
                rows={
                  consultationCityRows
                }
                locale={locale}
              />

              <PrivacyDistribution
                title={
                  isFr
                    ? "Tranches d’âge"
                    : "Age ranges"
                }
                explanation={
                  isFr
                    ? "Uniquement parmi les visiteurs ayant choisi de renseigner leur tranche d’âge."
                    : "Only among visitors who chose to provide an age range."
                }
                unavailableText={
                  isFr
                    ? "Pas encore assez de données d’âge"
                    : "Not enough age data yet"
                }
                available={
                  stats.audience.ageRanges.available
                }
                sampleSize={
                  stats.audience.ageRanges.sampleSize
                }
                minimum={
                  stats.audience.privacyMinimum
                }
                rows={
                  ageRows
                }
                locale={locale}
              />
            </div>
          </Section>

          <Section
            title={
              isFr
                ? "Quand votre lieu intéresse le plus"
                : "When interest is strongest"
            }
            subtitle={
              isFr
                ? "Les moments où les utilisateurs consultent votre fiche ou effectuent une action vers votre établissement."
                : "When users view your place or take an action toward your business."
            }
          >
            <div className="grid gap-8 lg:grid-cols-2">
              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">
                  {isFr
                    ? "Jours de la semaine"
                    : "Days of the week"}
                </div>

                <ColumnChart
                  rows={
                    weekdayRows
                  }
                  isFr={isFr}
                />
              </div>

              <div>
                <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.15em] text-white/35">
                  {isFr
                    ? "Moments de la journée"
                    : "Time of day"}
                </div>

                <ColumnChart
                  rows={
                    hourRows
                  }
                  isFr={isFr}
                />
              </div>
            </div>
          </Section>

          <section className="rounded-[24px] border border-[#8D854D]/20 bg-[#8D854D]/[0.07] px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#8D854D]" />

              <p className="text-[11px] leading-relaxed text-white/38">
                {isFr
                  ? "Toutes les statistiques de cet espace sont agrégées et les données de test ou internes sont exclues. Les actions vers votre établissement indiquent un intérêt concret mais ne constituent pas une preuve de visite ou d’achat. Une visite affichée comme telle correspond uniquement à une visite déclarée par l’utilisateur dans Indie Map."
                  : "All statistics in this space are aggregated and test or internal data is excluded. Actions toward your business show concrete interest but do not prove a visit or purchase. A visit displayed here only means a visit explicitly declared by the user in Indie Map."}
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
