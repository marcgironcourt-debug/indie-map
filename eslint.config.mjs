import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  {
    files: ["src/components/GlobeMap.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/unsupported-syntax": "off",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  // Les scripts de prospection et les prototypes ne sont pas livrés avec
  // l'application ; ils manipulent volontairement des réponses externes
  // non typées. Le code de production conserve la règle stricte.
  {
    files: ["scripts/**/*", "src/lib/ai/officialSiteVerifier.prototype.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Cheerio et pdfjs exposent ici des nœuds non typés. Ces frontières restent
  // isolées dans le vérificateur, sans assouplir les autres modules de l'app.
  {
    files: ["src/lib/ai/officialSiteVerifier.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "tmp/**",
    "node_modules/**",
    "public/downloads/**",
  ]),
]);

export default eslintConfig;
