#!/usr/bin/env bash
# Test: scene-to-scene transitions with MiniMax H3 start/end frame (Higgsfield API), as in leo-i2v.sh.
set -uo pipefail; cd "$(dirname "$0")"
AUTH="Authorization: Key $(cat ~/.config/higgsfield/credentials)"
up(){ U=$(curl -s -X POST https://api.higgsfield.ai/files/generate-upload-url -H "$AUTH" -H "Content-Type: application/json" -d '{"content_type":"image/jpeg"}'); curl -s -o /dev/null -X PUT "$(echo "$U"|python3 -c 'import json,sys;print(json.load(sys.stdin)["upload_url"])')" -H "Content-Type: image/jpeg" -H "x-amz-tagging: retention=temporary" --upload-file "$1"; echo "$U"|python3 -c 'import json,sys;print(json.load(sys.stdin)["public_url"])'; }
run(){ # name start end prompt
  a=$(up "$2"); b=$(up "$3")
  body=$(python3 -c "import json,sys;print(json.dumps({'prompt':sys.argv[1],'image_url':sys.argv[2],'end_image_url':sys.argv[3],'duration':5,'aspect_ratio':'9:16'}))" "$4" "$a" "$b")
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
STYLE="Keep the exact hand-painted watercolour storybook style and the same girl (face, hair, clothes) the whole time. One smooth continuous magical transition, no cuts, no text. End exactly on the final illustration."
run t-noa noa6.jpg noa10.jpg "Magical storybook transition. The little girl with curly red hair, crouching on the village street, stands up and steps forward as ivy, moss and ferns grow over the walls and pavement; the street melts into an enchanted forest, the light turns green and golden, fireflies appear, an owl lands on a branch and a mossy chest rises from the roots in front of her. $STYLE" &
run t-aitana aitana6.jpg aitana10.jpg "Magical storybook transition. In her bedroom at night the girl with two braids kneels by her bed; sea foam and turquoise waves pour in through the window and wash over the room, the bed and walls dissolve into the wooden deck, ropes and sail of a pirate ship at sea in daylight; she leans over the rail and a silver dolphin leaps from the waves. $STYLE" &
wait
