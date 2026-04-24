#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# guard-no-bypass.sh — CI guard against P0 hazard regressions
#
# Fails the build if any of the following anti-patterns appears
# in the codebase. These have all been the source of past P0
# incidents; this script is the permanent vaccine.
#
# Anti-patterns checked:
#   1. `TESTING_BYPASS = true` — original Hazard D
#   2. `DEV MODE` payment shortcut in activate-subscription
#
# Usage: bun run guard   (or invoked from CI before tests)
# ═══════════════════════════════════════════════════════════════

set -e

EXIT=0

scan() {
  local pattern="$1"
  local label="$2"
  # Search src/ and supabase/functions/ only — exclude this guard script,
  # docs (which legitimately discuss the patterns), and node_modules.
  local hits
  hits=$(grep -REn --include='*.ts' --include='*.tsx' \
    --exclude-dir=node_modules \
    "$pattern" src supabase/functions 2>/dev/null \
    | grep -v 'guard-no-bypass' || true)

  if [ -n "$hits" ]; then
    echo "❌ FORBIDDEN PATTERN FOUND: $label"
    echo "   Pattern: $pattern"
    echo "$hits" | sed 's/^/   /'
    echo ""
    EXIT=1
  fi
}

scan 'TESTING_BYPASS[[:space:]]*=[[:space:]]*true' \
  "TESTING_BYPASS = true (use ENFORCE_PRO env var instead — see CLAUDE.md Hazard D)"

scan 'DEV[[:space:]]*MODE.*activate' \
  "DEV MODE payment shortcut (no longer permitted — Razorpay verification is mandatory)"

if [ $EXIT -eq 0 ]; then
  echo "✅ guard-no-bypass: no forbidden patterns found"
fi

exit $EXIT
