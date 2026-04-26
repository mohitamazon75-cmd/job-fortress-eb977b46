#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# guard-god-files.sh — Freeze ceiling for the 4 grandfathered
# god-files documented in CLAUDE.md §1 Hazard F.
#
# These files are explicitly NOT to be refactored, but they are
# also not to grow further. Any PR that pushes them beyond the
# accepted ceiling fails CI.
#
# To raise a ceiling: requires explicit operator approval and a
# corresponding update to CLAUDE.md Hazard F.
# ═══════════════════════════════════════════════════════════════

set -e

EXIT=0

# Format: "path:max_lines"
# Ceilings = current line count + small headroom (~5%) for
# trivial doc/comment additions. Any real growth must trip this.
FILES=(
  "supabase/functions/process-scan/index.ts:1340"
  "src/lib/scan-engine.ts:950"
  "src/components/SideHustleGenerator.tsx:945"
  "src/components/VerdictReveal.tsx:600"
)

for entry in "${FILES[@]}"; do
  path="${entry%:*}"
  max="${entry##*:}"

  if [ ! -f "$path" ]; then
    echo "⚠️  guard-god-files: missing file $path (skipping)"
    continue
  fi

  actual=$(wc -l < "$path" | tr -d ' ')

  if [ "$actual" -gt "$max" ]; then
    echo "❌ GOD-FILE GREW: $path"
    echo "   Current: $actual lines"
    echo "   Ceiling: $max lines"
    echo "   These files are frozen (CLAUDE.md §1 Hazard F)."
    echo "   Do not grow them. Add new code in a new file."
    echo ""
    EXIT=1
  else
    echo "✅ $path — $actual / $max lines"
  fi
done

exit $EXIT
