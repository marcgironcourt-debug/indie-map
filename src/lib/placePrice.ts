export type PlacePriceRange = {
  min: number;
  max: number;
  currency: string;
  basis: "per_person";
};

export function formatPlacePriceRange(
  range: PlacePriceRange | null | undefined,
  locale: string,
) {
  if (!range) return null;

  const min = Number(range.min);
  const max = Number(range.max);
  const currency = String(range.currency || "").trim().toUpperCase();

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min < 0 ||
    max < min ||
    !/^[A-Z]{3}$/.test(currency)
  ) {
    return null;
  }

  try {
    const localeCode = locale === "en" ? "en-US" : "fr-FR";

    const numberFormatter = new Intl.NumberFormat(localeCode, {
      maximumFractionDigits: 0,
    });

    const currencyFormatter = new Intl.NumberFormat(localeCode, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });

    const parts = currencyFormatter.formatToParts(1);
    const currencyPart =
      parts.find((part) => part.type === "currency")?.value ?? currency;

    const currencyIndex = parts.findIndex(
      (part) => part.type === "currency",
    );
    const integerIndex = parts.findIndex(
      (part) => part.type === "integer",
    );

    const values =
      min === max
        ? numberFormatter.format(min)
        : `${numberFormatter.format(min)}–${numberFormatter.format(max)}`;

    const price =
      currencyIndex >= 0 &&
      integerIndex >= 0 &&
      currencyIndex < integerIndex
        ? `${currencyPart}${values}`
        : `${values} ${currencyPart}`;

    return `${price} ${locale === "en" ? "/ person" : "/ personne"}`;
  } catch {
    return `${min}–${max} ${currency} ${
      locale === "en" ? "/ person" : "/ personne"
    }`;
  }
}
