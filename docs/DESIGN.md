# Design: Ratiu Twp

A rust-belt Michigan small town in 16-bit pixel art, built in 3D and seen through an isometric camera
you can turn. Think SimCity 2000 that you can walk into, with Main Street lit up at night.

Values live in code: materials and colour ramps, building definitions and camera constants are in
the game source (today `prototype/`, after the port `src/game/`). This doc explains intent; don't
copy values here.

## Principles

1. **One texel, one pixel.** The scene renders at low resolution with nearest-neighbour textures and
   is scaled up by whole device pixels. At the default camera, one texture pixel lands on one screen
   pixel, so the 3D town reads as hand-pixelled. No smoothing, no fractional zoom, no mipmaps.
2. **Pixel textures, simple shapes.** Buildings are boxes, gables, cylinders and cones (PS1-era
   geometry) wearing 16-bit textures painted by code: brick with mortar, lap siding, shingle
   courses, corrugated tin, lit and unlit windows. Trees are faceted low-poly blobs.
3. **Hue-shifted materials.** Every material is a short colour ramp with cool shadows and warm
   highlights. Seasons swap ramps (fall leaves, bare winter trees, snow).
4. **Real light.** The sun's position comes from the real date and time in Macomb County. Shadows
   are hard-edged. At night, windows, neon and lamps take over through emissive textures, halos and
   pools of light on the ground.
5. **Michigan, not generic.** Brick Main Street with awnings, a Coney diner, a strip mall, a tool and
   die shop, a grain elevator by the tracks, ranch houses with attached garages, a water tower, power
   lines, and an airfield with one north-south runway like Romeo State's 18/36. Streets follow the
   real section-road grid (mile roads, M-53, the Van Dyke corridor, the Macomb Orchard Trail and
   subdivision ponds), compressed. See the spec's map section.
6. **Every building means something.** Projects and feeds live in buildings, and what the town shows
   always agrees with the data. People, cars, smoke and the train are there for life.
7. **No 586.** The name is Ratiu Twp. The GitHub username inside repository links is the only
   exception (ADR-012).

## Camera and scale

- Orthographic, 30° down, at 45° by default. It rotates freely around you (Q/E or drag) and zooms in
  whole steps. It follows you with a little look-ahead and is snapped to whole pixels while panning,
  so walls don't shimmer.
- When something stands between you and the camera, you show as a maize silhouette.
- One tile is about 6 m. People are about 12 px tall at default zoom (small, realistic
  proportions). One storey is about 20 px.
- Distances are compressed: one real square mile is a section of about 32 by 32 tiles, so the
  buildings stay life-size while the trip between mile roads takes seconds. Sections stream in
  around you, and fog softens the far edge.
- Heights are written in the 2D art's pixels and converted, so the same numbers describe the 2D and
  3D versions.

## Light, time and weather

- Day: a hemisphere light carries the sky colour and the sun carries the shadows. A low sun is
  boosted a little so November shadows still read.
- Night: the emissive layer (lit windows, neon signs, lamps, runway lights) fades in as the sun goes
  down. Halos are screen-space points nudged toward the camera so nearby walls don't clip them.
- The bike has a headlight. Cars have headlights and tail lights.
- Fog only touches the far edges of the world.
- Weather comes from the forecast: overcast dims the sun and adds cloud, rain and snow fall, and
  snow covers the ground.

## Interface

- Old PC game: bevelled navy panels, maize accent, ink-coloured text. One dark look for the game.
- Type: Jersey 10 for display (names, titles), Pixelify Sans for the interface.
- On screen: a name badge, camera and bike controls, a compass, a door prompt that names its key,
  and a hint bar. Windows open in the centre on desktop and as a bottom sheet on phones.
- Plain words, sentence case. Buttons say what happens. Status is always a word as well as a colour.

## Sound

Chiptune music on by default once you press a key or click, since browsers need that first gesture.
Tracks change with the place and time of day. Mute and volume sit in the controls.

## Accessibility

- The town is the fun layer. Every piece of content also exists as HTML: project pages, the Today
  panel and DOS mode.
- The town works by keyboard alone, with visible focus, and prompts name the key to press.
- Reduced motion: ambient traffic and animation pause, and nothing flashes.
- Colour is never the only signal.
