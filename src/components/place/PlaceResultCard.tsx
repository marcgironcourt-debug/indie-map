"use client";

import Link from "next/link";

import { getCategoryStyle } from "@/lib/categoryStyle";

type Props = {
  name: string;
  panoramaImage?: string;
  categoryKey?: string;
  categoryLabel?: string;
  city?: string;
  miniText?: string;
  buttonLabel: string;
  href?: string;
  onViewDetails?: () => void;
  searchResultId?: string;
  searchResultRank?: number;
};

export default function PlaceResultCard({
  name,
  panoramaImage,
  categoryKey,
  categoryLabel,
  city,
  miniText,
  buttonLabel,
  href,
  onViewDetails,
  searchResultId,
  searchResultRank,
}: Props) {
  const categoryStyle = categoryLabel
    ? getCategoryStyle(categoryKey || categoryLabel, true)
    : "";

  return (
    <div
      data-search-result-id={searchResultId}
      data-search-result-rank={searchResultRank}
      className="overflow-hidden rounded-2xl border border-white/10 bg-white/8"
    >
      <div className="flex w-full gap-3 p-3 text-left">
        <img
          src={panoramaImage || "/explorer-bg.png?v=3"}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover"
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 truncate font-serif text-[17px] leading-tight text-white">
              {name}
            </div>

            {categoryLabel ? (
              <span
                className={
                  "im-chip inline-flex shrink-0 items-center justify-center whitespace-nowrap px-1.5 py-[1px] text-[9px] min-h-[17px] !rounded-2xl font-medium leading-none " +
                  categoryStyle
                }
              >
                {categoryLabel}
              </span>
            ) : null}
          </div>

          {city ? (
            <div className="mt-1.5 text-[13px] font-medium tracking-[0.01em] text-white/80">
              {city}
            </div>
          ) : null}

          {miniText ? (
            <div className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/70">
              {miniText}
            </div>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10">
        {href ? (
          <Link
            href={href}
            prefetch={false}
            className="flex w-full items-center justify-center px-4 py-3 text-center text-[14px] font-semibold text-white/85"
          >
            {buttonLabel}
          </Link>
        ) : (
          <button
            type="button"
            onClick={onViewDetails}
            className="flex w-full items-center justify-center px-4 py-3 text-center text-[14px] font-semibold text-white/85"
          >
            {buttonLabel}
          </button>
        )}
      </div>
    </div>
  );
}
