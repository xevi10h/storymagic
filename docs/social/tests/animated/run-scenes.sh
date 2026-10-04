#!/usr/bin/env bash
# Test: animate two real book scenes with MiniMax H3 image-to-video (Higgsfield API), same call shape as
# docs/ads/creatives/story/leo-i2v.sh.
set -uo pipefail; cd "$(dirname "$0")"
AUTH="Authorization: Key $(cat ~/.config/higgsfield/credentials)"
up(){ U=$(curl -s -X POST https://api.higgsfield.ai/files/generate-upload-url -H "$AUTH" -H "Content-Type: application/json" -d '{"content_type":"image/jpeg"}'); curl -s -o /dev/null -X PUT "$(echo "$U"|python3 -c 'import json,sys;print(json.load(sys.stdin)["upload_url"])')" -H "Content-Type: image/jpeg" -H "x-amz-tagging: retention=temporary" --upload-file "$1"; echo "$U"|python3 -c 'import json,sys;print(json.load(sys.stdin)["public_url"])'; }
run(){ # name image prompt
  url=$(up "$2")
  body=$(python3 -c "import json,sys;print(json.dumps({'prompt':sys.argv[1],'image_url':sys.argv[2],'duration':5,'aspect_ratio':'9:16'}))" "$3" "$url")
  resp=$(curl -s -X POST https://api.higgsfield.ai/minimax/h3/image-to-video -H "$AUTH" -H "Content-Type: application/json" -d "$body")
  id=$(echo "$resp" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d.get("request_id") or "")' 2>/dev/null)
  if [ -z "$id" ]; then echo "$1 SUBMIT FAILED: $(echo "$resp" | head -c 300)"; return; fi
  echo "$1 submitted $id"
  for i in $(seq 1 60); do
    s=$(curl -s "https://api.higgsfield.ai/requests/$id/status" -H "$AUTH" | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["status"],(d.get("video") or {}).get("url",""))' 2>/dev/null)
    case "$s" in completed*|failed*|nsfw*|canceled*) break;; esac; sleep 10
  done
  echo "$1 ${s%% *}"; [[ "$s" == completed* ]] && curl -s -o "$1.mp4" "${s#* }"
}
STYLE="Preserve the exact hand-painted watercolour storybook style, the paper texture and the girl's face and clothes. Gentle, calm motion for a bedtime story. Very slow push-in, one continuous shot, no cuts, no new characters or objects, no text."
run aitana10 aitana10.jpg "Living watercolour illustration. The sea rolls with soft waves and foam, the sail flutters in the breeze, the silver dolphin bobs in the water and tilts its head happily, the girl leans on the rail, her braids sway, she blinks and smiles at the dolphin. $STYLE" &
run noa20 noa20.jpg "Living watercolour illustration. The little squirrel holds out the golden flower key and it glows and sparkles softly, the squirrels' tails twitch, the girl with curly red hair blinks, smiles wider and gently opens her hands, fireflies drift in the forest light. $STYLE" &
wait
