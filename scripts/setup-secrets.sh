#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Job Fortress — Supabase Secrets Setup Script
# Usage:
#   1. Copy supabase/secrets.env.example → .env.secrets
#   2. Fill in all values in .env.secrets
#   3. Run: bash scripts/setup-secrets.sh
# ═══════════════════════════════════════════════════════════════

set -e

if [ ! -f ".env.secrets" ]; then
  echo "❌  .env.secrets not found."
  echo "    Copy supabase/secrets.env.example to .env.secrets and fill in values."
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"
if [ -z "$PROJECT_REF" ]; then
  echo "❌  SUPABASE_PROJECT_REF not set."
  echo "    Run: export SUPABASE_PROJECT_REF=your-project-ref"
  echo "    (Find it in Supabase Dashboard → Settings → General)"
  exit 1
fi

echo "📦  Setting secrets for project: $PROJECT_REF"
echo ""

# Read .env.secrets and set each secret (skip comments and empty lines)
while IFS='=' read -r key value; do
  # Skip comments and empty lines
  [[ "$key" =~ ^#.*$ ]] && continue
  [[ -z "$key" ]] && continue

  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)

  if [ -z "$value" ]; then
    echo "⚠️   Skipping $key (empty value)"
    continue
  fi

  supabase secrets set "$key=$value" --project-ref "$PROJECT_REF" 2>/dev/null && \
    echo "✅  $key" || \
    echo "❌  Failed: $key"
done < .env.secrets

echo ""
echo "✅  Done. Verify with: supabase secrets list --project-ref $PROJECT_REF"
