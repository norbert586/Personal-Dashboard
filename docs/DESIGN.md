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

## Moving around

- Keys follow the streets. W, A, S and D walk along the grid's axes as they appear in the nearest
  classic isometric view, so one key keeps you on a sidewalk; two keys walk straight up or across
  the screen.
- Click or tap anywhere and you walk an A* path around buildings, with a dotted line and a pulsing
  ring where you'll stop. Long trips break into a run.
- Going in: walk into a door, press F at it, or click the building and you walk to its door. The
  door swings open, you step through as the camera eases in and the view dims, and the building's
  window opens. When it closes you step back out onto the doorstep. There are no rooms yet (ADR-027).
- Overhead fly the real aircraft from the ADS-B feed, where they really are: a low one sweeps
  right under the camera with its shadow racing across the ground, and high jets leave contrails.
  Heights are squeezed to fit the view (ADR-030).

## Light, time and weather

- Day: a hemisphere light carries the sky colour and the sun carries the shadows. A low sun is
  boosted a little so November shadows still read.
- Night: the emissive layer (lit windows, neon signs, lamps, runway lights) fades in as the sun goes
  down. Halos are screen-space points nudged toward the camera so nearby walls don't clip them.
- The bike has a headlight. Cars have headlights and tail lights.
- Fog only touches the far edges of the world.
- Weather comes from the forecast: overcast dims the sun and adds cloud, rain and snow fall, fog
  closes in, and snow covers the ground and the roofs. Clouds are low-poly heaps that drift on the
  real wind and throw shadows on a fair day. Rain and snow fall in front of the camera, a pixel at
  a time.
- Seasons come from the date: blossom in the orchard in spring, fall colour, and bare branches
  and dormant grass in winter. Snow never comes from the date, only from the forecast (ADR-031).

## Delivery mode

The same 16-bit textures and code-painted materials as the town, seen the way a 32-bit console
drew a driving game: low-poly streets at true scale, from behind the car. Values live in
`src/game/delivery/`.

- **Camera:** perspective, behind and above the car, on a spring. It widens a little with speed.
  On foot it follows you the same way.
- **Pixels:** the scene renders at about 360 lines on the screen's short side and is scaled up by
  whole device pixels, like the town. Up close a texel is a clear square; in the distance textures
  average out instead of sparkling. The town's "no mipmaps" rule is for its fixed camera and
  doesn't hold in perspective; this mode must stay easy on the eyes at speed.
- **Detail:** real footprints with windows fitted to each wall, shingled gable and hip roofs,
  flat-roofed shops, sidewalks where the map has them, lane lines that stop at intersections,
  trees in yards and woods. Detail comes from many simple shapes, never from smooth ones.
- **Landmarks:** a landmark is told by its shape before its sign: a steeple and cross, a school's
  long windows, entrance canopy and flag, the hospital's tall wards under a blue band with a
  white H, a showroom of glass with cars lined up outside, a gas station's lit canopy over its
  pumps, a strip mall's row of coloured sign bands. No red cross: that emblem is protected.
- **Signs:** names are painted in the town's 3 by 5 pixel font, white on a panel coloured by the
  kind of place, on the wall and on a roadside sign (tall on a pole for shops and gas, low on
  brick for schools and churches). Letters and panels are lit after dark. The dashboard backs
  every sign with words, so nothing depends on reading small lettering.
- **Traffic control:** signal heads are yellow and hang from a wire between two wooden poles;
  the lit lens is unshaded, so it reads at noon and glows at night. Stop signs are red octagons
  with the word, yield signs red triangles point down, street names white on green blades. All
  are drawn larger than life so they read at this picture's size, and each is told by its shape
  or position as well as its colour (red is always the top lens).
- **The pizzeria:** red and white awning, warm lit windows, the name in lights and a real pool
  of light on the pavement at night. Delivery stalls are painted in maize, the game's accent.
- **People and traffic:** boxy like your car, in ordinary colours (mostly white, black, grey and
  silver cars). People swing their arms and legs; with reduced motion they glide.
- **Sky:** a dome with a dithered gradient for the hour, the real sun where it really is, pixel
  clouds that drift, and stars at night. Fog at the far edge takes the sky's colour.
- **Night:** headlights throw real light, windows glow and the topper sign is lit.
- **The car:** boxy and low-poly. It rolls in corners, dives under braking, squats when it pulls
  away and nudges on each gear shift, so you feel what it's doing.
- **On screen:** speed, gear and revs, the street you're on and its limit, the landmark or
  neighborhood you're in, a small heading-up map with a letter for each landmark
  and the real clock, in the game's bevelled panels. Phones get steering buttons on the left and
  pedals on the right.
- **Reduced motion:** no camera roll or shake.

## Interface

- Old PC game: bevelled navy panels, maize accent, ink-coloured text. One dark look for the game.
- It opens like a mid-90s PC game: a short DOS boot, a sound-card setup screen, then the title.
  Esc opens a pause menu in the same style.
- Type: Jersey 10 for display (names, titles), Pixelify Sans for the interface.
- On screen: a name badge, camera and bike controls, a compass, a door prompt that names its key,
  and a hint bar with a Today line that shows one feed at a time in plain words. Windows open in the centre on desktop and as a bottom sheet on phones.
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
