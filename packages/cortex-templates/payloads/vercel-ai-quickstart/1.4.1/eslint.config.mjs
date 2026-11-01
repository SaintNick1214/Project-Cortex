import { fixupConfigRules } from "@eslint/compat";
import tsParser from "@typescript-eslint/parser";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  // React's rules still use context methods removed in ESLint 10.
  ...fixupConfigRules(nextVitals.map((config) => {
    if (!config.languageOptions?.parser) return config;
    return {
      ...config,
      // Next's bundled Babel parser has not adopted ESLint 10's scope API.
      languageOptions: { ...config.languageOptions, parser: tsParser },
    };
  })),
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "convex/_generated/**",
    "next-env.d.ts",
  ]),
]);
