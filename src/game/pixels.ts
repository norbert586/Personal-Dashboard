/**
 * One texel, one pixel (docs/DESIGN.md). The town renders at low resolution and the browser scales
 * the canvas up by a whole number of device pixels, so pixel art stays crisp and nothing shimmers.
 */

/** Screen pixels per tile at the default camera: with a 30° orthographic view, one texel lands on one pixel. */
export const PXU = 45.25;

export interface PixelScale {
  /** Device pixels per low-res pixel: always a whole number. */
  device: number;
  /** CSS pixels per low-res pixel (device / devicePixelRatio). */
  css: number;
  /** The low-res framebuffer the scene renders into. */
  width: number;
  height: number;
}

/**
 * Pick the scale for a viewport. By default the low-res view is about a third of the window wide
 * (300 to 560 pixels), like the feel test; `zoom` overrides it with a chosen whole-pixel step.
 */
export function pixelScale(cssWidth: number, cssHeight: number, dpr: number, zoom = 0): PixelScale {
  const target = Math.max(300, Math.min(560, cssWidth * 0.34));
  const device = zoom || Math.max(1, Math.round((cssWidth * dpr) / target));
  const css = device / dpr;
  return { device, css, width: Math.ceil(cssWidth / css), height: Math.ceil(cssHeight / css) };
}

/** One zoom step in or out (dir = +1 or -1), kept between 1 and about 7 CSS pixels per texel. */
export function zoomStep(current: number, dir: number, dpr: number): number {
  return Math.max(1, Math.min(Math.round(7 * dpr), current + dir));
}
