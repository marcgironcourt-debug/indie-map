import {getRequestConfig} from "next-intl/server";

export default getRequestConfig(async ({locale}) => {
  const messages = (await import(`../messages/${locale ?? "fr"}.json`)).default;
  return {
    locale: locale ?? "fr",
    messages,
  };
});
