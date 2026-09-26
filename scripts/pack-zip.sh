#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 scripts/make-samples.py
python3 scripts/embed-samples.py

PACK_SINGLE=1 npm run build

VERSION="$(node -p "require('./package.json').version")"
FILE="wrxtoolbox${VERSION}"

STAGE="$(mktemp -d)"
mkdir -p "$STAGE/$FILE"
cp dist/index.html "$STAGE/$FILE/${FILE}.html"
cat > "$STAGE/$FILE/README.txt" <<EOF
WRX Tool Box! v${VERSION}
========================================

This folder needs no install. No Node, no npm, no internet.

1. Double-click ${FILE}.html
2. It opens in your default browser
3. Use the Log review or Wheel / tire tabs
4. Load Accessport CSV files, or click "Load sample logs"
5. Optionally pick a car preset (market / year / trim)
6. Click "Start review" — each CSV opens in its own tab when you load more than one

Your logs stay in the browser. Nothing is uploaded.

Works on Windows, macOS, and Linux. If the page is blank, try Chrome,
Edge, or Firefox. Keep this HTML as one file; leave the .html extension.

These sample logs are fictional. They are not from a real car.

Not affiliated with Subaru of America, Subaru Corporation, or COBB Tuning.
Subaru, WRX, Accessport, and COBB are trademarks of their respective owners.
This software is independent and unofficial. Licensed under the MIT License.
EOF

mkdir -p release Input
cp dist/index.html "$ROOT/release/${FILE}.html"
cp dist/index.html "$ROOT/Input/${FILE}.html"
cp "$STAGE/$FILE/README.txt" "$ROOT/release/README.txt"
cp "$STAGE/$FILE/README.txt" "$ROOT/Input/README.txt"
rm -f "$ROOT/release/WRX-Tune-Check.html" "$ROOT/release/WRX-Tune-Check.zip" \
  "$ROOT/Input/WRX-Tune-Check.html"
find "$ROOT/release" "$ROOT/Input" -maxdepth 1 -type f \
  \( -name 'wrxtoolbox*.html' -o -name 'wrxtoolbox*.zip' \) \
  ! -name "${FILE}.html" ! -name "${FILE}.zip" -delete

ZIP="$ROOT/release/${FILE}.zip"
rm -f "$ZIP"
(
  cd "$STAGE"
  zip -r "$ZIP" "$FILE"
)
rm -rf "$STAGE"

echo "Built $ZIP"
ls -lh "$ZIP" "$ROOT/release/${FILE}.html"
