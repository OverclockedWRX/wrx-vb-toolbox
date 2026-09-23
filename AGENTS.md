# Agent notes — WRX Tool Box!

This is a **Vite + React + TypeScript** app (`wrx-tune-check`), not Next.js.

## Develop

```bash
npm install
npm run dev
```

Open http://127.0.0.1:3847. Entry is [`src/main.tsx`](src/main.tsx); UI lives under [`components/`](components/); domain logic under [`lib/`](lib/).

## Checks and ship

- `npm run check` — sample-grade, car-preset, and VIN scripts
- `npm run lint` / `npm run build` — ESLint and a normal (split-asset) Vite build
- `npm run pack` — regenerates samples, embeds them, builds a **single-file** HTML (`PACK_SINGLE=1`), and writes `release/WRX-Tune-Check.zip`

`npm run pack` needs bash, `python3`, and `zip` (Git Bash or WSL on Windows).

## Offline release

The zip contains one HTML file that runs with no Node, npm, or network. Logs stay in the browser; nothing is uploaded. Fictional sample CSVs are embedded for offline “Load sample logs.”

## Version bumps (required on every change)

Any shipped change must bump the footer version. Update **both**:

1. [`lib/version.ts`](lib/version.ts) (`APP_VERSION`) — what the page footer shows
2. [`package.json`](package.json) (`version`) — keep identical

Current baseline: **0.6.2**. Product name is always **WRX Tool Box!** (`APP_NAME` in [`lib/version.ts`](lib/version.ts)). Use semver patch/minor/major as appropriate (patch for small fixes, minor for features). Also refresh `release/` when packing so the offline HTML matches.
