# 03 — Licenses and SBOM

Status: first-party inventory from `package.json`  
Do not treat this file as a generated CycloneDX/SPDX SBOM.

## First-party

The application source in this repository is proprietary to the selling entity once IP assignment is complete. It is not published under an open-source license.

## Direct runtime dependencies

From `package.json` `dependencies`:

| Package | Declared version |
| --- | --- |
| drizzle-orm | 0.45.2 |
| next | 16.2.12 |
| react | 19.2.8 |
| react-dom | 19.2.8 |

## Direct development dependencies

From `package.json` `devDependencies` (not shipped as application runtime, still relevant to build/reproducibility):

`@cloudflare/vite-plugin`, `@tailwindcss/postcss`, `@types/node`, `@types/react`, `@types/react-dom`, `@vitejs/plugin-react`, `@vitejs/plugin-rsc`, `eslint`, `eslint-config-next`, `drizzle-kit`, `miniflare`, `react-server-dom-webpack`, `tailwindcss`, `typescript`, `vinext`, `vite`, `wrangler`.

Overrides: `postcss` 8.5.23, `sharp` 0.35.3.

## Private SBOM step (do not commit secrets)

In the private packet, generate and retain:

```bash
npm ls --all --omit=dev
npm audit --omit=dev
```

A development-only `brace-expansion` advisory has historically been recorded in the release checklist and must not be silently represented as resolved.

## Copyleft review

Confirm no GPL/AGPL runtime dependency entered through transitive packages before an LOI. Record the date and operator in the private packet.
