// ESLint flat config — Next.js + Perfectionist import ordering
//
// Prerequisites:
//   pnpm add -D eslint eslint-config-next eslint-plugin-perfectionist
//
// Customization:
//   - Add project-specific ignores to globalIgnores()
//   - Adjust internalPattern to match your path aliases (default: @/*)

import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import perfectionist from "eslint-plugin-perfectionist";
import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Global ignores — files and directories excluded from linting.
  globalIgnores([
    // Next.js build output
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // TODO: Add project-specific ignores here (e.g., "src/generated/**")
  ]),

  // Import ordering — groups and alphabetical sorting via perfectionist.
  {
    plugins: { perfectionist },
    rules: {
      "perfectionist/sort-imports": [
        "warn",
        {
          type: "alphabetical",
          order: "asc",
          ignoreCase: true,
          internalPattern: ["^@/.+"],
          newlinesBetween: 1,
          groups: [
            "type-import",           // import type { Foo } from "bar"
            "value-builtin",         // import fs from "fs"
            "value-external",        // import React from "react"
            "value-internal",        // import { cn } from "@/lib/utils"
            "type-internal",         // import type { Props } from "@/types"
            ["type-parent", "type-sibling", "type-index"],
            ["value-parent", "value-sibling", "value-index"],
            "ts-equals-import",      // import Foo = require("foo")
            "unknown",
          ],
        },
      ],
      "perfectionist/sort-named-imports": [
        "warn",
        {
          type: "alphabetical",
          order: "asc",
          ignoreCase: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
