import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import globals from "globals";

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // Ignore patterns
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/_generated/**",
      "**/coverage/**",
      "**/.convex/**",
      "**/build/**",
      "**/.next/**",
      "**/out/**",
      "**/*.min.js",
      "**/*.bundle.js",
      "**/.cache/**",
      "**/.parcel-cache/**",
      "**/test-output.txt",
      "scripts/**/*", // Exclude scripts from linting
      "examples/**/*", // Exclude examples from linting
      "Examples and Proofs/**/*", // Exclude example integrations
      "packages/**/*", // Exclude all packages (wizard has its own linting)
      "*.txt", // Exclude text files
      "cortex-sdk-python/**/*", // Exclude Python SDK entirely
      "cortex-test/**/*", // Exclude cortex-test directory
      "**/htmlcov/**/*", // Exclude Python code coverage reports
      "**/.venv/**/*", // Exclude Python virtual environments
      "**/venv/**/*", // Exclude Python virtual environments
      "dev-docs/**/*", // Exclude dev documentation
      "Documentation/**/*", // Exclude documentation
      "Internal Docs/**/*", // Exclude internal docs
    ],
  },

  // Base JavaScript configuration
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // TypeScript configuration (pragmatic rules focusing on actual bugs)
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Critical bug prevention
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unnecessary-condition": "warn",

      // Type safety (but not overly strict)
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",

      // Code quality
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],

      // Best practices
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],

      // Allow common patterns
      "no-underscore-dangle": "off", // Convex uses _id, _score, etc.
      "id-length": "off", // Allow short names in callbacks
      "no-await-in-loop": "off", // Common in Convex
      "@typescript-eslint/typedef": "off", // Don't require explicit types everywhere
      "@typescript-eslint/strict-boolean-expressions": "off", // Allow truthy/falsy checks
      "@typescript-eslint/no-non-null-assertion": "off", // Allow ! when we know it's safe
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-magic-numbers": "off",
      "@typescript-eslint/no-restricted-imports": "off", // Allow relative imports
      "no-plusplus": "off", // Allow ++ for counters
      "no-continue": "off", // Allow continue in loops
      "no-inline-comments": "off", // Allow inline comments
      "require-unicode-regexp": "off", // Don't require u flag
      "no-promise-executor-return": "off", // Allow Promise patterns
      "max-lines-per-function": "off",
      "max-statements": "off",
      "max-depth": "off",
      "max-nested-callbacks": "off",
      "max-lines": "off",
      complexity: "off",
      "func-names": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/explicit-member-accessibility": "off",
      "@typescript-eslint/prefer-nullish-coalescing": "off",
      "@typescript-eslint/restrict-template-expressions": "off",
      "@typescript-eslint/restrict-plus-operands": "off",
      "@typescript-eslint/require-await": "off",
      "require-atomic-updates": "off",
    },
  },

  // Test files (even more relaxed)
  {
    files: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-floating-promises": "warn",
    },
  },

  // Convex backend (relaxed for Convex framework's dynamic types)
  {
    files: ["convex-dev/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: "./tsconfig.json",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
    },
  },

  // Config files
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs", "*.config.cjs"],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
    },
  },
];
