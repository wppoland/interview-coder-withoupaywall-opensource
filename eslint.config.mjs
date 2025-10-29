import js from "@eslint/js";
import globals from "globals";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tseslintParser from "@typescript-eslint/parser";
import json from "@eslint/json";
import css from "@eslint/css";

export default [
  js.configs.recommended,

  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslintParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslintPlugin,
    },
    rules: {
      ...tseslintPlugin.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["warn", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_" 
      }],
      "@typescript-eslint/no-var-requires": "off",
    },
  },

  {
    files: ["**/*.json"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.jsonc"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    files: ["**/*.json5"],
    plugins: { json },
    rules: { ...json.configs.recommended.rules },
  },
  {
    ignores: [
      "**/*.md",
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/*.test.js",
      "**/*.spec.ts",
      "**/*.spec.tsx",
      "**/node_modules/**",
      "**/dist/**",
      "**/dist-electron/**",
      "**/build/**",
    ],
  },
  {
    files: ["**/*.css"],
    plugins: { css },
    rules: { ...css.configs.recommended.rules },
  },
];
