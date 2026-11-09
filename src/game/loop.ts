/**
 * Input and the frame loop, shared by everything in the town. Keys are tracked by `code`, so WASD
 * works on any keyboard layout; they're forgotten when the window loses focus so you never keep
 * walking after an alt-tab.
 */

export const keys = new Set<string>();

/** Keys the page must not scroll or click with while the town has them. */
const CAPTURED = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export type KeyHandler = (event: KeyboardEvent) => boolean | void;
const handlers: KeyHandler[] = [];

/** Handlers run in order on a fresh key press; one that returns true stops the rest. */
export function onKey(handler: KeyHandler): void {
  handlers.push(handler);
}

export function listen(): void {
  addEventListener('keydown', (event) => {
    const target = event.target;
    // Buttons and links keep Enter and Space for themselves.
    if (
      target instanceof Element &&
      target.closest('button, a, input, select, textarea') &&
      (event.key === 'Enter' || event.key === ' ')
    )
      return;
    if (CAPTURED.has(event.code)) event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    for (const handler of handlers) if (handler(event) === true) break;
  });
  addEventListener('keyup', (event) => keys.delete(event.code));
  addEventListener('blur', () => keys.clear());
}

/**
 * Run `step` every animation frame with the seconds since the last one (capped, so a stalled tab
 * doesn't teleport anyone), and skip work while the tab is hidden.
 */
export function startLoop(step: (dt: number, now: number) => void): void {
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!document.hidden) step(dt, now / 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
