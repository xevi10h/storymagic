#!/usr/bin/env bash
# Creates the Stripe promotion codes for the creator gifting campaign (docs/outreach/creators-2026-10.md):
# per creator, one single-use code for a free printed book and one 10 % code for their audience.
# Run once, by the owner, from the repo root: bash scripts/social/create-creator-codes.sh
# Writes to the LIVE Meapica account (key read from .env.local, never printed). Running it twice duplicates the coupons.
set -euo pipefail

K=$(grep -E "^STRIPE_SECRET_KEY_LIVE=" .env.local | cut -d= -f2- | tr -d '"')
epoch() { python3 -I -c "import datetime,zoneinfo;print(int(datetime.datetime($1,23,59,tzinfo=zoneinfo.ZoneInfo('Europe/Madrid')).timestamp()))"; }
field() { python3 -I -c "import json,sys;d=json.load(sys.stdin);print(d.get('$1') or d)"; }

GIFT_EXP=$(epoch 2026,12,15) # creators order their book before Christmas
AUD_EXP=$(epoch 2027,1,6)    # audience codes last until Reyes

# Free book: only the book itself (hardcover or softcover products), add-ons stay paid.
GIFT=$(stripe coupons create --api-key "$K" -d name="Creator gifted book" -d percent_off=100 -d duration=once \
  -d "applies_to[products][0]=prod_VLLRbtyV0bCE5p" -d "applies_to[products][1]=prod_VLLRWeyy48IF3s" \
  -d "metadata[campaign]=creators-2026-10" | field id)
AUD=$(stripe coupons create --api-key "$K" -d name="Creator audience 10%" -d percent_off=10 -d duration=once \
  -d "metadata[campaign]=creators-2026-10" | field id)
echo "coupons: gift $GIFT, audience $AUD"

while read -r handle short; do
  # Random suffix: a gift code must not be guessable from the handle.
  sfx=$(python3 -I -c "import secrets;print(''.join(secrets.choice('ABCDEFGHJKMNPQRSTUVWXYZ23456789') for _ in range(4)))")
  g=$(stripe promotion_codes create --api-key "$K" -d "promotion[type]=coupon" -d "promotion[coupon]=$GIFT" \
    -d code="REGALO-$short-$sfx" -d max_redemptions=1 -d expires_at="$GIFT_EXP" \
    -d "metadata[creator]=$handle" -d "metadata[kind]=gift" | field code)
  a=$(stripe promotion_codes create --api-key "$K" -d "promotion[type]=coupon" -d "promotion[coupon]=$AUD" \
    -d code="${short}10" -d expires_at="$AUD_EXP" \
    -d "metadata[creator]=$handle" -d "metadata[kind]=audience" | field code)
  echo "@$handle | free book: $g | audience: $a"
done <<'EOF'
emarmestra EMARMESTRA
familiadebruixetes BRUIXETES
bocinsdemi BOCINS
familiesinquietes INQUIETES
familiacaricu CARICU
onanemdema ONANEM
mama_y_maestra MAMAYMAESTRA
lara_mamaestra LARA
myfamilytime.es FAMILYTIME
maestraprimariaypt MAMIYLIBROS
EOF
