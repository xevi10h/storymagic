#!/bin/sh
# «Así llega a casa» clips: Seedance 2.5, silent (sound effects come from ElevenLabs, sfx/). About $4.5 of the Higgsfield API balance.
A="The hands pull the strip of packing tape off the cardboard box in one go and lift the flap. Hand-held phone filmed from above, slight sway, real motion."
B="The hands lift the book out of the tissue paper and tilt it toward the camera; the cover stays exactly as it is. Hand-held phone from above, slight sway."
C="One hand turns a page of the open book; the small child's hand pats the page excitedly. The pages stay blurred, no readable text. Hand-held phone from above, slight sway."
R=../../../../scripts/social/animate-scene.mjs
SCENE_STYLE=photo MODEL=seedance25 node $R clips/seedance25-a.mp4 "$A" people/start-a.jpg > .a.log 2>&1 &
SCENE_STYLE=photo MODEL=seedance25 node $R clips/seedance25-b.mp4 "$B" people/start-b.jpg > .b.log 2>&1 &
SCENE_STYLE=photo MODEL=seedance25 node $R clips/seedance25-c.mp4 "$C" people/start-c.jpg > .c.log 2>&1 &
wait
tail -n1 .a.log .b.log .c.log
