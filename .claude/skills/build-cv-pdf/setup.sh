#!/usr/bin/env bash
# Rebuild the local PDF-rendering toolchain in .pdfbuild/ (gitignored, so it
# does not survive a fresh container). Idempotent: skips any piece already
# present. Requires network access to registry.npmjs.org and
# storage.googleapis.com. Re-run any time the PDF build fails with a missing
# chrome / puppeteer-core / tailwind.min.css.
set -euo pipefail

CHROME_VERSION=131.0.6778.204
TAILWIND_VERSION=2.2.19

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
PB="$REPO/.pdfbuild"

mkdir -p "$PB"

# 1. Render + screenshot scripts (committed source of truth lives in the skill dir)
cp "$SKILL_DIR/render.js" "$SKILL_DIR/shot.js" "$SKILL_DIR/george-render.js" "$SKILL_DIR/pdf2png.js" "$PB/"

# 2. puppeteer-core (drives headless Chrome)
if [ ! -d "$PB/node_modules/puppeteer-core" ]; then
  echo "Installing puppeteer-core@21.11.0 ..."
  ( cd "$PB" && npm install --no-save --no-audit --no-fund puppeteer-core@21.11.0 )
fi

# 3. Tailwind v2 CSS — the HTML references unpkg, which is blocked, so vendor
#    the same version via the npm registry instead.
if [ ! -f "$PB/tailwind.min.css" ]; then
  echo "Vendoring tailwindcss@$TAILWIND_VERSION ..."
  ( cd "$PB" \
      && npm pack "tailwindcss@$TAILWIND_VERSION" >/dev/null \
      && tar xzf "tailwindcss-$TAILWIND_VERSION.tgz" \
      && cp package/dist/tailwind.min.css tailwind.min.css )
fi

# 4. chrome-headless-shell (the print engine). Direct download from the
#    Chrome for Testing bucket — matches the dir layout render.js expects.
if [ ! -x "$PB/chrome-headless-shell-linux64/chrome-headless-shell" ]; then
  echo "Downloading chrome-headless-shell $CHROME_VERSION ..."
  URL="https://storage.googleapis.com/chrome-for-testing-public/${CHROME_VERSION}/linux64/chrome-headless-shell-linux64.zip"
  ( cd "$PB" \
      && curl -fsSL -o chs.zip "$URL" \
      && unzip -oq chs.zip \
      && rm -f chs.zip )
  # Fallback if the bucket is unreachable: npx @puppeteer/browsers install \
  #   chrome-headless-shell@$CHROME_VERSION --path "$PB/.cache"
  # then point CHROME in render.js at the installed binary.
fi

echo "Toolchain ready in $PB"
"$PB/chrome-headless-shell-linux64/chrome-headless-shell" --version || true
