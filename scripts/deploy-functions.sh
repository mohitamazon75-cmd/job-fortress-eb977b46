#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Job Fortress — Deploy All Edge Functions
# Usage: bash scripts/deploy-functions.sh
# Requires: SUPABASE_PROJECT_REF env var set
# ═══════════════════════════════════════════════════════════════

set -e

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$PROJECT_REF" ]; then
  echo "❌  SUPABASE_PROJECT_REF not set."
  echo "    Run: export SUPABASE_PROJECT_REF=your-project-ref"
  exit 1
fi

echo "🚀  Deploying all edge functions to project: $PROJECT_REF"
echo ""

supabase functions deploy --project-ref "$PROJECT_REF"

echo ""
echo "✅  All functions deployed."
echo "    Verify with: supabase functions list --project-ref $PROJECT_REF"
