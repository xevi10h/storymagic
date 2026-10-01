#!/usr/bin/env bash
# One-off deploy runbook for creation flow v2 (see docs/stack.md). Run steps in order:
#   bash scripts/deploy-creation-flow-v2.sh 1   # showcase bucket + publish marketing images
#   bash scripts/deploy-creation-flow-v2.sh 2   # push main + deploy to Vercel prod
#   (smoke test https://meapica.shop/es/create and the landing images)
#   bash scripts/deploy-creation-flow-v2.sh 3   # make illustrations private + backfill paths
# Migrations 140000-140200 are already applied (2026-09-28).
set -euo pipefail
cd "$(dirname "$0")/.."

REF=rmxjtugoyfaxxkiiayss
PAT=$(grep '^SUPABASE_PAT=' .env.local | cut -d= -f2-)

apply() { # $1 = migration file, $2 = version, $3 = name
  local sql
  sql="begin;
$(cat "$1")
insert into supabase_migrations.schema_migrations (version, name) values ('$2','$3') on conflict do nothing;
commit;"
  jq -n --arg q "$sql" '{query:$q}' | curl -sf -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" -d @- && echo "applied $2 $3"
}

case "${1:-}" in
  1)
    apply supabase/migrations/20260927140300_showcase_bucket.sql 20260927140300 showcase_bucket
    npx tsx --tsconfig tsconfig.json scripts/publish-showcase.mts --dry-run
    read -r -p "Dry run OK? Publish for real [y/N] " ok
    [ "$ok" = "y" ] && npx tsx --tsconfig tsconfig.json scripts/publish-showcase.mts
    ;;
  2)
    git push origin main
    vercel --prod
    ;;
  3)
    apply supabase/migrations/20260927140400_private_illustrations.sql 20260927140400 private_illustrations
    apply supabase/migrations/20260927140500_illustration_paths_backfill.sql 20260927140500 illustration_paths_backfill
    echo "Rollback if images break: update storage.buckets set public=true where id='illustrations';"
    ;;
  *) echo "usage: $0 1|2|3"; exit 1 ;;
esac
