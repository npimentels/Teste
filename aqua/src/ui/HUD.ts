import { el } from './dom';

/**
 * Minimal in-game overlay: crosshair, contextual action prompt, carried-object info,
 * zone titles, gentle tutorial hints and the pointer-capture message.
 */
export class HUD {
  readonly root: HTMLDivElement;
  private readonly crosshair: HTMLDivElement;
  private readonly prompt: HTMLDivElement;
  private readonly carry: HTMLDivElement;
  private readonly zoneTitle: HTMLDivElement;
  private readonly hint: HTMLDivElement;
  private readonly capture: HTMLDivElement;
  private readonly toast: HTMLDivElement;
  private promptText = '';
  private zoneTimer = 0;
  private toastTimer = 0;
  private hintQueue: string[] = [];
  private hintTimer = 0;

  constructor(parent: HTMLElement) {
    this.crosshair = el('div', { className: 'crosshair', attrs: { 'aria-hidden': 'true' } });
    this.prompt = el('div', { className: 'hud-prompt', attrs: { role: 'status', 'aria-live': 'polite' } });
    this.carry = el('div', { className: 'hud-carry' });
    this.zoneTitle = el('div', { className: 'zone-title' });
    this.hint = el('div', { className: 'hud-hint' });
    this.toast = el('div', { className: 'hud-toast' });
    this.capture = el('div', { className: 'capture-msg' }, [el('div', { className: 'glass pill', text: 'Clique na tela para capturar o mouse e continuar' })]);
    this.capture.hidden = true;
    this.root = el('div', { className: 'hud' }, [this.crosshair, this.prompt, this.carry, this.zoneTitle, this.hint, this.toast, this.capture]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  setVisible(v: boolean): void {
    this.root.hidden = !v;
  }

  setPrompt(text: string | null): void {
    const t = text ?? '';
    if (t === this.promptText) return;
    this.promptText = t;
    if (t) this.prompt.innerHTML = `<kbd>E</kbd><span>${escapeHtml(t)}</span>`;
    this.prompt.classList.toggle('visible', !!t);
    this.crosshair.classList.toggle('active', !!t);
  }

  setCarrying(label: string | null): void {
    if (label) this.carry.innerHTML = `<span>Carregando ${escapeHtml(label)}</span><kbd>G</kbd> soltar · <kbd>Clique</kbd> arremessar`;
    this.carry.classList.toggle('visible', !!label);
  }

  showZone(title: string, subtitle: string): void {
    this.zoneTitle.innerHTML = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p>`;
    this.zoneTitle.classList.add('visible');
    this.zoneTimer = 4.5;
  }

  showToast(text: string, seconds = 2.5): void {
    this.toast.textContent = text;
    this.toast.classList.add('visible');
    this.toastTimer = seconds;
  }

  queueHints(hints: string[]): void {
    this.hintQueue = [...hints];
    this.hintTimer = 0;
  }

  clearHints(): void {
    this.hintQueue = [];
    this.hint.classList.remove('visible');
  }

  setCaptureMessage(visible: boolean): void {
    this.capture.hidden = !visible;
  }

  update(dt: number): void {
    if (this.zoneTimer > 0) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) this.zoneTitle.classList.remove('visible');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.classList.remove('visible');
    }
    this.hintTimer -= dt;
    if (this.hintTimer <= 0) {
      const next = this.hintQueue.shift();
      if (next) {
        this.hint.innerHTML = next;
        this.hint.classList.add('visible');
        this.hintTimer = 6;
      } else {
        this.hint.classList.remove('visible');
        this.hintTimer = 1e9;
      }
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
