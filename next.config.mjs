import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  devIndicators: false,
  typedRoutes: false,
  typescript: { ignoreBuildErrors: false }
};

export default withNextIntl(nextConfig);
