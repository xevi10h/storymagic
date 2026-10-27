#!/bin/sh
# «¡Soy yo!» least-AI pilot clips: the same three start frames through two models, so the pair differs in one variable.
#   sh clips.sh   (from this folder; about $7 from the Higgsfield API balance)
V="Spoken in natural Castilian Spanish from Spain (Madrid accent), a real seven-year-old's voice, quiet and a bit hesitant, not acted, not an announcer. No music."
A="The boy keeps looking at the book cover, leans closer, then says softly, almost to himself: \"Papá... ¡ese soy yo!\" $V Tiny natural movements, hand-held phone sway."
B="The boy taps the page twice and says, excited and fast: \"¡Y aquí también!\" The father laughs quietly. $V Hand-held phone sway."
C="The father keeps looking down at his son with a small tired smile, breathes in, swallows. Nobody speaks. Quiet room sound only. Hand-held phone drifts slightly."
R=../../../../scripts/social/animate-scene.mjs
for M in seedance25 kling3; do
  SCENE_STYLE=photo MODEL=$M AUDIO=on node $R clips/$M-a.mp4 "$A" people/start-a.jpg &
  SCENE_STYLE=photo MODEL=$M AUDIO=on node $R clips/$M-b.mp4 "$B" people/start-b.jpg &
  SCENE_STYLE=photo MODEL=$M AUDIO=on DURATION=6 node $R clips/$M-c.mp4 "$C" people/start-c.jpg &
done
wait
