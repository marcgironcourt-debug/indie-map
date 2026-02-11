import {getRequestConfig} from "next-intl/server";
import {locales, defaultLocale} from "../i18n";

export default getRequestConfig(async ({locale}) => {
  const candidate = locale ?? defaultLocale;
  const finalLocale = (locales as readonly string[]).includes(candidate)
    ? candidate
    : defaultLocale;

  const messages = (await import(`../messages/${finalLocale}.json`)).default;

  return {
    locale: finalLocale,
    messages
  };
});
