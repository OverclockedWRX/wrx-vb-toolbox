# Agent notes — VB WRX Accessport log review

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

Version in the footer comes from [`lib/version.ts`](lib/version.ts); keep it in sync with [`package.json`](package.json).
