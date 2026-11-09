#!/usr/bin/env bash
# Assemble the throwaway prototypes (ADR-013) into single HTML files in prototype/dist/.
#   2d/  the isometric pixel town (v3): boot screen, pause menu, building windows, DOS mode.
#   3d/  the 3D feel test: the same town in three.js. It reuses the 2D data, texture painters,
#        layout and simulation; its 3D builders replace the 2D ones by name (later function
#        declarations win in one classic script).
# Open the results in a browser. The 3D one loads three.js r149 from cdn.jsdelivr.net.
# The parts are written for the claude.ai artifact host, which adds the document skeleton;
# the wrapper below does the same for local viewing.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p dist
head='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>'
shared="2d/p3a-data.js 2d/p3b-palette.js 2d/p4a-raster.js 2d/p4b-tools.js 2d/p4c-town.js 2d/p4d-heroes.js 2d/p4e-layout.js"
{ echo "$head"; cat 2d/p1-style.html 2d/p2-markup.html $shared 2d/p5a-core.js 2d/p5b-actors.js 2d/p5c-sky.js 2d/p6-ui.js 2d/p7-windows.js 2d/p8-start.js; echo '</body></html>'; } > dist/town-2d.html
{ echo "$head"; cat 3d/p3d-0-head.html $shared 2d/p5b-actors.js 3d/p3d-1-atlas.js 3d/p3d-2-build.js 3d/p3d-2b-build.js 3d/p3d-3-scene.js 3d/p3d-4-bodies.js 3d/p3d-5-player.js 3d/p3d-7-path.js 3d/p3d-6-loop.js; echo '</body></html>'; } > dist/ratiu-twp-3d.html
echo "Wrote prototype/dist/town-2d.html and prototype/dist/ratiu-twp-3d.html"
