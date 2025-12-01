import {getRequestConfig} from "next-intl/server";

export default getRequestConfig(async ({locale}) => {
  const finalLocale = locale ?? "fr";
  const messages = (await import(`../messages/${finalLocale}.json`)).default;

  return {
    locale: finalLocale,
    messages,
  };
});
