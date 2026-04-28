import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Node.js CommonJS pipeline scripts — linted separately
    "scripts/**",
    "ecosystem.config.js",
    // Design-handoff reference mockups (parallel session vendor drop).
    // JSX files that rely on globals (Icon, Badge, Sparkline, React) —
    // not production code. Excluding avoids 54 spurious react/jsx-no-undef.
    ".planning/**",
    // TypeDoc-generated API docs (minified bundle, not source).
    // Shipped by `npm run docs:api`; regenerated from src/. Linting a
    // minified main.js yields bogus no-this-alias errors (3:2273, 3:2290).
    "docs/api/**",
  ]),
  // React Compiler rules downgraded to warnings: they flag optimization
  // opportunities (memoization skipped, setState-in-effect, impure render),
  // not runtime bugs. Tracked as tech debt — see /tmp/tech-debt-react-compiler.md.
  // react-hooks/rules-of-hooks stays an error — that IS a runtime bug.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/static-components": "warn",
      // Honor the "_foo" convention for intentionally-unused identifiers.
      // Standard TS community pattern — unused function args, unused
      // destructured vars, and caught-error bindings are all fine when
      // the name starts with "_". Without this override, test stubs
      // `(_token: string) => ...` and `catch (_err) {}` silently
      // accumulate warnings (~50 instances across the repo).
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
]);

export default eslintConfig;
