/**
 * The old-PC shell (SPEC: Menus): a short DOS boot, the sound-card setup screen (which doubles as
 * the first gesture sound needs), the title screen, the pause menu on Esc, and the Today panel on
 * T; the town holds still behind both. Reduced motion skips the boot. Plain DOM, no three.js.
 */

export type ShellState = 'boot-dos' | 'boot-setup' | 'boot-title' | 'play' | 'paused';

const BOOT_LINES = [
  'Starting DOS...',
  '',
  'C:\\>CD GAMES\\RATIU',
  'C:\\GAMES\\RATIU>RATIU.EXE',
  '',
  'Loading RATIU TWP',
  'Checking runway lights... ok',
  'Counting corn rows... ok',
  'Fueling the 172... ok',
];

const $ = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`The town page is missing ${selector}`);
  return el;
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Shell {
  state: ShellState = 'boot-dos';
  /** The player's choice at setup: sound on (the Sound Blaster) or off. */
  sound = true;
  /** Called when play starts or resumes, so the town can take the keys. */
  onPlay: () => void = () => {};
  /** Called as the Today panel opens, so the town can put the latest cards in it. */
  onToday: () => void = () => {};
  private readonly dos = $<HTMLElement>('#boot-dos');
  private readonly dosText = $<HTMLElement>('#boot-text');
  private readonly setup = $<HTMLElement>('#boot-setup');
  private readonly title = $<HTMLElement>('#boot-title');
  private readonly skip = $<HTMLButtonElement>('#btn-skip');
  private readonly pause = $<HTMLDialogElement>('#pause');
  private readonly today = $<HTMLDialogElement>('#today');
  private readonly items: HTMLButtonElement[];

  constructor() {
    this.items = [...this.pause.querySelectorAll<HTMLButtonElement>('.menu-item')];
    for (const b of this.setup.querySelectorAll<HTMLButtonElement>('[data-sound]'))
      b.addEventListener('click', () => {
        this.choose(b.dataset.sound === 'on');
        this.confirm();
      });
    $('#btn-start').addEventListener('click', () => this.play());
    this.skip.addEventListener('click', () => this.play());
    $('#btn-menu').addEventListener('click', () => this.openPause());
    for (const b of this.items)
      b.addEventListener('click', () =>
        b.dataset.pane === 'resume' ? this.pause.close() : this.show(b.dataset.pane ?? ''),
      );
    // Closing either one resumes play, unless the other has just opened over it.
    this.pause.addEventListener('close', () => {
      if (this.state === 'paused' && !this.today.open) this.play();
    });
    this.today.addEventListener('close', () => {
      if (this.state === 'paused' && !this.pause.open) this.play();
    });
    for (const b of document.querySelectorAll<HTMLElement>('[data-open-today]'))
      b.addEventListener('click', () => {
        this.pause.close();
        this.state = 'play';
        this.openToday();
      });
  }

  get playing(): boolean {
    return this.state === 'play';
  }

  private set(state: ShellState): void {
    this.state = state;
    document.documentElement.dataset.shell =
      state === 'play' ? 'play' : state === 'paused' ? 'paused' : 'boot';
  }

  /** Run the intro, or go straight to the town with reduced motion. */
  async boot(still: boolean): Promise<void> {
    if (still) return this.play();
    this.set('boot-dos');
    this.skip.hidden = false;
    this.dos.hidden = false;
    this.dosText.textContent = '';
    for (const line of BOOT_LINES) {
      for (const ch of line) {
        if (this.state !== 'boot-dos') return;
        this.dosText.textContent += ch;
        await wait(16);
      }
      this.dosText.textContent += '\n';
    }
    await wait(250);
    if (this.state === 'boot-dos') this.showSetup();
  }

  private showSetup(): void {
    this.dos.hidden = true;
    this.setup.hidden = false;
    this.set('boot-setup');
    this.choose(this.sound);
  }

  private choose(on: boolean): void {
    this.sound = on;
    for (const b of this.setup.querySelectorAll<HTMLButtonElement>('[data-sound]')) {
      const picked = (b.dataset.sound === 'on') === on;
      b.setAttribute('aria-selected', String(picked));
      if (picked) b.focus();
    }
  }

  private confirm(): void {
    this.setup.hidden = true;
    this.title.hidden = false;
    this.set('boot-title');
    $<HTMLButtonElement>('#btn-start').focus();
  }

  play(): void {
    this.dos.hidden = this.setup.hidden = this.title.hidden = this.skip.hidden = true;
    this.set('play');
    this.onPlay();
  }

  openPause(pane = 'map'): void {
    if (this.state !== 'play') return;
    this.set('paused');
    this.show(pane);
    this.pause.showModal();
    this.items.find((b) => b.dataset.pane === pane)?.focus();
  }

  /** Today, over the town: the same cards as the Today page. */
  openToday(): void {
    if (this.state !== 'play' || this.today.open) return;
    this.set('paused');
    this.onToday();
    this.today.showModal();
  }

  private show(name: string): void {
    for (const b of this.items) b.setAttribute('aria-current', String(b.dataset.pane === name));
    for (const p of this.pause.querySelectorAll<HTMLElement>('[data-pane-body]'))
      p.hidden = p.dataset.paneBody !== name;
  }

  /** Keys for the shell; returns true when the shell used the key. */
  key(e: KeyboardEvent): boolean {
    if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return this.state !== 'play';
    switch (this.state) {
      case 'boot-dos':
        e.preventDefault();
        this.showSetup();
        return true;
      case 'boot-title':
        e.preventDefault();
        this.play();
        return true;
      case 'boot-setup':
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          this.choose(!this.sound);
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.confirm();
        }
        return true;
      case 'paused': {
        // T closes Today again. Up and down move through the menu; the dialog handles Esc.
        if (e.code === 'KeyT' && this.today.open) {
          this.today.close();
          return true;
        }
        const i = this.items.indexOf(document.activeElement as HTMLButtonElement);
        if (i >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
          e.preventDefault();
          const next =
            this.items[
              (i + (e.key === 'ArrowDown' ? 1 : this.items.length - 1)) % this.items.length
            ];
          next?.focus();
        }
        return true;
      }
      default:
        if (e.key === 'Escape' || e.code === 'KeyP') {
          e.preventDefault();
          this.openPause();
          return true;
        }
        if (e.code === 'KeyT') {
          e.preventDefault();
          this.openToday();
          return true;
        }
        return false;
    }
  }
}
