#!/bin/sh
# «¿Lo reconoces?» morph: Seedance 2.5 first frame = the phone photo, last frame = page 29 of book 31ada3cf. Silent, about $1.5.
P="One continuous shot, no cuts. The boy holds still and smiles at the camera while the photograph slowly turns into a hand-painted watercolour storybook illustration of himself: first the plain bedroom dissolves into the painted bedroom with the starry curtain and the planet poster, then his clothes become watercolour, last his face. Same pose and framing the whole time. End exactly on the final illustration. No text."
SCENE_STYLE=none MODEL=seedance25 DURATION=5 node ../../../../scripts/social/animate-scene.mjs clips/seedance25-morph.mp4 "$P" people/start-a.jpg "pdf:31ada3cf-f98d-40f3-b978-d5f84ee99ef1:29:0.5"
