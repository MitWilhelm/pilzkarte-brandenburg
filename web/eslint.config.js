// Lint-Regeln für web/: strenge TypeScript-Regeln, dazu Verbote aus CLAUDE.md (Regel 4, 6, 12).
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "node_modules/", "build.mjs", "eslint.config.js"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: {
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-nested-ternary": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Regel 12: kein innerHTML, textContent oder DOM-Knoten nutzen." },
      ],
    },
  },
  {
    // node:test wartet selbst auf die Promises von test(); ein await davor wäre nur Rauschen.
    files: ["test/**/*.ts"],
    rules: { "@typescript-eslint/no-floating-promises": "off" },
  },
);
