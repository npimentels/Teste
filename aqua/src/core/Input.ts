/**
 * Keyboard + mouse state. Uses KeyboardEvent.code so WASD works on any layout.
 * Mouse deltas only accumulate while the pointer is locked.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouseDX = 0;
  private mouseDY = 0;
  private clicks = 0;
  pointerLocked = false;

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.repeat) return;
    if (GAME_KEYS.has(e.code) && this.pointerLocked) e.preventDefault();
    this.down.add(e.code);
    this.pressed.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.pointerLocked) return;
    // Some browsers emit a spurious huge delta right after locking: clamp it.
    this.mouseDX += Math.max(-250, Math.min(250, e.movementX));
    this.mouseDY += Math.max(-250, Math.min(250, e.movementY));
  };
  private readonly onMouseDown = (e: MouseEvent) => {
    if (this.pointerLocked && e.button === 0) this.clicks++;
  };
  private readonly onBlur = () => this.clear();

  attach(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('blur', this.onBlur);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('blur', this.onBlur);
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  consumeMouse(out: { x: number; y: number }): void {
    out.x = this.mouseDX;
    out.y = this.mouseDY;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  consumeClicks(): number {
    const c = this.clicks;
    this.clicks = 0;
    return c;
  }

  /** Call once per frame after gameplay has read the "pressed" edges. */
  endFrame(): void {
    this.pressed.clear();
  }

  /** Forget everything (focus loss, pause) so no key stays stuck. */
  clear(): void {
    this.down.clear();
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicks = 0;
  }
}

const GAME_KEYS = new Set(['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyE', 'KeyG', 'ShiftLeft', 'ShiftRight']);
