#!/bin/bash
# One-command resume after topping up BFL credits at dashboard.bfl.ai.
#
# Runs the full pending queue:
#   1. Generate the missing path-art images (resumable, skips existing)
#   2. Rebuild the art manifest from disk
#   3. Re-run the creation-flow e2e suite (needs `npm run dev` running on :3013)
#
# Usage:  bash scripts/resume-after-topup.sh
set -e
cd "$(dirname "$0")/.."

echo "▶ 1/3 Generating missing path art (~270 imgs ≈ \$27 at ~\$0.10/img)…"
node scripts/generate-path-art.mjs || {
  echo "✗ Generation stopped (likely credits). Manifest still rebuilt below."
}

echo "▶ 2/3 Rebuilding art manifest from disk…"
node scripts/generate-path-art.mjs --manifest-only

echo "▶ 3/3 e2e suite (requires dev server on :3013)…"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3013/es | grep -q 200; then
  npx playwright test e2e/all-trees.spec.ts e2e/qa-walkthrough.spec.ts --workers=1 --reporter=line
else
  echo "⚠ Dev server not running — start it (npm run dev) and re-run step 3 manually."
fi

echo
echo "Done. Coverage:"
for d in public/images/path/*/; do
  echo "  $(basename "$d"): $(ls "$d" | wc -l | tr -d ' ')/39"
done