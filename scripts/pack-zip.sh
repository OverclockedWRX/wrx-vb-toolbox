#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 scripts/make-samples.py
python3 scripts/embed-samples.py

PACK_SINGLE=1 npm run build

STAGE="$(mktemp -d)"
NAME="WRX-Tune-Check"
mkdir -p "$STAGE/$NAME"
cp dist/index.html "$STAGE/$NAME/WRX-Tune-Check.html"
VERSION="$(node -p "require('./package.json').version")"
cat > "$STAGE/$NAME/README.txt" <<EOF
WRX Tool Box! v${VERSION}
========================================

This folder needs no install. No Node, no npm, no internet.

1. Double-click WRX-Tune-Check.html
2. It opens in your default browser
3. Load your Accessport CSV files, or click "Load sample logs"
4. Optionally pick a car preset (market / year / trim) for road-load power
5. Click "Start review" — each CSV opens in its own tab when you load more than one

Your logs stay in the browser. Nothing is uploaded.

Works on Windows, macOS, and Linux. If the page is blank, try Chrome,
Edge, or Firefox. Keep this HTML as one file; leave the .html extension.

These sample logs are fictional. They are not from a real car.

Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.
Subaru, WRX, Accessport, and COBB are trademarks of their respective owners.
This software is independent and unofficial. Licensed under the MIT License.
EOF

mkdir -p release
ZIP="$ROOT/release/WRX-Tune-Check.zip"
rm -f "$ZIP"
(
  cd "$STAGE"
  zip -r "$ZIP" "$NAME"
)
rm -rf "$STAGE"

echo "Built $ZIP"
ls -lh "$ZIP" "$ROOT/dist/index.html"
