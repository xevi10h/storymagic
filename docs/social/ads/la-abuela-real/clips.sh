#!/bin/sh
# «La abuela» least-AI clips: Seedance 2.5 with the grandmother saying each line in Spanish (the voice is then replaced by
# ElevenLabs with scripts/social/dub-clip.mjs). sh clips.sh from this folder, about $5 of the Higgsfield API balance.
V="Spoken in natural Castilian Spanish from Spain by an ordinary grandmother of seventy-five, soft and unhurried, not acted, not an announcer. No music."
A="The grandmother taps the book cover and says warmly to the boy: \"Ábrelo. La primera página la he escrito yo.\" The boy looks at the cover. $V Hand-held phone sway."
B="The grandmother reads aloud slowly from the book, her voice catching a little: \"Para Martín, que cuenta estrellas antes de dormir...\" The boy listens, leaning on her shoulder. $V Hand-held phone sway."
C="The boy hugs his grandmother; she laughs, pats his back and says: \"¡Ay, mi niño!\" $V Hand-held phone sway."
R=../../../../scripts/social/animate-scene.mjs
SCENE_STYLE=photo MODEL=seedance25 AUDIO=on node $R clips/seedance25-a.mp4 "$A" people/start-a.jpg > .a.log 2>&1 &
SCENE_STYLE=photo MODEL=seedance25 AUDIO=on node $R clips/seedance25-b.mp4 "$B" people/start-b.jpg > .b.log 2>&1 &
SCENE_STYLE=photo MODEL=seedance25 AUDIO=on node $R clips/seedance25-c.mp4 "$C" people/start-c.jpg > .c.log 2>&1 &
wait
tail -n1 .a.log .b.log .c.log
