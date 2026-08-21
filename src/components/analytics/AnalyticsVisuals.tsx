type ChartPoint = {
  label: string;
  value: number;
};

type DonutSegment = {
  label: string;
  value: number;
};

type BarRow = {
  label: string;
  value: number;
  hint?: string;
};

const PALETTE = [
  "#2563EB",
  "#EF4444",
  "#16A34A",
  "#FACC15",
  "#9333EA",
  "#F97316",
  "#06B6D4",
  "#EC4899",
];

function compactNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    notation:
      Math.abs(value) >= 1000
        ? "compact"
        : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function AnalyticsLineChart({
  title,
  subtitle,
  points,
  colorIndex = 0,
  eventLabel = "Événement",
}: {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  colorIndex?: number;
  eventLabel?: string;
}) {
  const chartColor =
    PALETTE[
      Math.abs(colorIndex) %
        PALETTE.length
    ];
  const width = 720;
  const height = 240;
  const left = 18;
  const right = 18;
  const top = 22;
  const bottom = 42;

  const innerWidth =
    width - left - right;

  const innerHeight =
    height - top - bottom;

  const maxValue = Math.max(
    1,
    ...points.map((point) => point.value),
  );

  const coordinates =
    points.map((point, index) => {
      const x =
        points.length <= 1
          ? left
          : left +
            (
              index /
              (points.length - 1)
            ) *
              innerWidth;

      const y =
        top +
        innerHeight -
        (
          point.value /
          maxValue
        ) *
          innerHeight;

      return {
        ...point,
        x,
        y,
      };
    });

  const path =
    coordinates.length > 0
      ? coordinates
          .map(
            (point, index) =>
              `${index === 0 ? "M" : "L"} ${point.x.toFixed(
                2,
              )} ${point.y.toFixed(2)}`,
          )
          .join(" ")
      : "";

  const labelStep =
    points.length > 12
      ? Math.ceil(points.length / 6)
      : 1;

  const total =
    points.reduce(
      (sum, point) =>
        sum + point.value,
      0,
    );

  return (
    <div className="rounded-[26px] border border-black/10 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">
            {title}
          </div>

          {subtitle ? (
            <div className="mt-1 text-xs text-black/40">
              {subtitle}
            </div>
          ) : null}
        </div>

        <div className="text-right">
          <div className="text-3xl font-semibold tracking-tight">
            {compactNumber(total)}
          </div>

          <div className="text-[10px] uppercase tracking-[0.12em] text-black/30">
            total
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-[220px] w-full"
          role="img"
          aria-label={title}
        >
          {[0, 0.25, 0.5, 0.75, 1].map(
            (ratio) => {
              const y =
                top +
                innerHeight -
                ratio * innerHeight;

              return (
                <line
                  key={ratio}
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke="rgba(0,0,0,0.07)"
                  strokeWidth="1"
                />
              );
            },
          )}

          {path ? (
            <path
              d={path}
              fill="none"
              stroke={chartColor}
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {coordinates.map(
            (point, index) => {
              const showMarker =
                point.value > 0;

              const tooltipWidth = 154;
              const tooltipHeight = 72;

              const tooltipX =
                Math.max(
                  4,
                  Math.min(
                    width -
                      tooltipWidth -
                      4,
                    point.x -
                      tooltipWidth / 2,
                  ),
                );

              const tooltipY =
                point.y > 100
                  ? point.y - 88
                  : point.y + 18;

              return (
                <g
                  key={`${point.label}-${index}`}
                >
                  {showMarker ? (
                    <g className="group">
                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="13"
                        fill="transparent"
                        className="cursor-pointer"
                      />

                      <circle
                        cx={point.x}
                        cy={point.y}
                        r="5.5"
                        fill={chartColor}
                        stroke="white"
                        strokeWidth="2.5"
                        className="pointer-events-none"
                      />

                      <g className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                        <rect
                          x={tooltipX}
                          y={tooltipY}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx="12"
                          fill="#171717"
                        />

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 21}
                          fontSize="13"
                          fontWeight="600"
                          fill="white"
                        >
                          {point.label}
                        </text>

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 40}
                          fontSize="12"
                          fill="rgba(255,255,255,0.72)"
                        >
                          {`${point.value} ${
                            point.value > 1
                              ? "événements"
                              : "événement"
                          }`}
                        </text>

                        <text
                          x={tooltipX + 12}
                          y={tooltipY + 58}
                          fontSize="11"
                          fontWeight="600"
                          fill={chartColor}
                        >
                          {eventLabel}
                        </text>
                      </g>
                    </g>
                  ) : null}

                  {index % labelStep === 0 ||
                  index ===
                    coordinates.length - 1 ? (
                    <text
                      x={point.x}
                      y={height - 13}
                      textAnchor="middle"
                      fontSize="18"
                      fill="rgba(0,0,0,0.38)"
                    >
                      {point.label}
                    </text>
                  ) : null}
                </g>
              );
            },
          )}
        </svg>
      </div>
    </div>
  );
}

export function AnalyticsDonut({
  title,
  subtitle,
  segments,
}: {
  title: string;
  subtitle?: string;
  segments: DonutSegment[];
}) {
  const clean =
    segments.filter(
      (segment) =>
        Number.isFinite(segment.value) &&
        segment.value > 0,
    );

  const total =
    clean.reduce(
      (sum, segment) =>
        sum + segment.value,
      0,
    );

  let cursor = 0;

  const gradient =
    total > 0
      ? clean
          .map((segment, index) => {
            const start =
              (cursor / total) * 100;

            cursor += segment.value;

            const end =
              (cursor / total) * 100;

            return `${PALETTE[index % PALETTE.length]} ${start}% ${end}%`;
          })
          .join(", ")
      : "#e8e3da 0% 100%";

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">
          {title}
        </div>

        {subtitle ? (
          <div className="mt-1 text-xs text-black/40">
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className="grid items-center gap-6 sm:grid-cols-[180px_1fr]">
        <div className="relative mx-auto h-[170px] w-[170px]">
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                `conic-gradient(${gradient})`,
            }}
          />

          <div className="absolute inset-[31px] flex flex-col items-center justify-center rounded-full bg-white">
            <div className="text-3xl font-semibold tracking-tight">
              {compactNumber(total)}
            </div>

            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-black/35">
              total
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          {clean.length === 0 ? (
            <div className="text-sm text-black/40">
              Aucune donnée.
            </div>
          ) : (
            clean.map(
              (segment, index) => {
                const pct =
                  total > 0
                    ? Math.round(
                        (
                          segment.value /
                          total
                        ) *
                          100,
                      )
                    : 0;

                return (
                  <div
                    key={`${segment.label}-${index}`}
                    className="grid grid-cols-[12px_1fr_auto] items-center gap-3 rounded-xl bg-[#faf7f0] px-3 py-2"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background:
                          PALETTE[
                            index %
                              PALETTE.length
                          ],
                      }}
                    />

                    <div className="truncate text-sm font-medium">
                      {segment.label}
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-semibold">
                        {compactNumber(
                          segment.value,
                        )}
                      </div>

                      <div className="text-[10px] text-black/35">
                        {pct} %
                      </div>
                    </div>
                  </div>
                );
              },
            )
          )}
        </div>
      </div>
    </div>
  );
}

export function AnalyticsBars({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle?: string;
  rows: BarRow[];
}) {
  const maxValue =
    Math.max(
      1,
      ...rows.map(
        (row) => row.value,
      ),
    );

  return (
    <div>
      <div className="mb-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-black/35">
          {title}
        </div>

        {subtitle ? (
          <div className="mt-1 text-xs text-black/40">
            {subtitle}
          </div>
        ) : null}
      </div>

      <div className="grid gap-3">
        {rows.length === 0 ? (
          <div className="text-sm text-black/40">
            Aucune donnée.
          </div>
        ) : (
          rows.map((row, index) => {
            const width =
              Math.max(
                3,
                Math.round(
                  (
                    row.value /
                    maxValue
                  ) *
                    100,
                ),
              );

            return (
              <div
                key={`${row.label}-${index}`}
              >
                <div className="mb-1.5 flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {row.label}
                    </div>

                    {row.hint ? (
                      <div className="truncate text-[11px] text-black/35">
                        {row.hint}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-sm font-semibold">
                    {compactNumber(
                      row.value,
                    )}
                  </div>
                </div>

                <div className="h-2.5 overflow-hidden rounded-full bg-black/7">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${width}%`,
                      background:
                        PALETTE[
                          index %
                            PALETTE.length
                        ],
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
