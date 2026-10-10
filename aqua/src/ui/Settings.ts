import type { GameSettings, SettingsStore } from '../core/Config';
import { aeroButton, el, setScreenVisible, type UiSounds } from './dom';

type SliderSpec = {
  key: keyof GameSettings;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  /** Map between the stored value and the slider value (e.g. 0–1 ↔ 0–100). */
  toSlider?: (v: number) => number;
  fromSlider?: (v: number) => number;
};

/** Settings panel shared by the main menu and the pause menu. Changes apply immediately. */
export class SettingsPanel {
  readonly root: HTMLDivElement;
  private readonly refreshers: Array<(s: Readonly<GameSettings>) => void> = [];
  private onBack: () => void = () => undefined;

  constructor(parent: HTMLElement, private readonly store: SettingsStore, sounds: UiSounds) {
    const pct = (v: number) => `${Math.round(v)}%`;
    const percentMap = { toSlider: (v: number) => v * 100, fromSlider: (v: number) => v / 100 };
    const sliders: SliderSpec[] = [
      { key: 'sensitivity', label: 'Sensibilidade do mouse', min: 0.2, max: 3, step: 0.05, format: (v) => `${v.toFixed(2)}×` },
      { key: 'fov', label: 'Campo de visão', min: 60, max: 100, step: 1, format: (v) => `${Math.round(v)}°` },
      { key: 'musicVolume', label: 'Volume da música', min: 0, max: 100, step: 1, format: pct, ...percentMap },
      { key: 'ambientVolume', label: 'Volume do ambiente', min: 0, max: 100, step: 1, format: pct, ...percentMap },
      { key: 'sfxVolume', label: 'Volume dos efeitos', min: 0, max: 100, step: 1, format: pct, ...percentMap },
      { key: 'resolutionScale', label: 'Escala de resolução', min: 50, max: 100, step: 5, format: pct, ...percentMap },
      { key: 'headBob', label: 'Balanço da câmera', min: 0, max: 100, step: 5, format: (v) => (v <= 0 ? 'Desligado' : pct(v)), ...percentMap },
    ];

    const rows: HTMLElement[] = [];
    rows.push(this.qualityRow(sounds));
    for (const spec of sliders) rows.push(this.sliderRow(spec));
    rows.push(this.toggleRow('invertY', 'Inverter eixo vertical do mouse', sounds));
    rows.push(this.toggleRow('showFps', 'Mostrar FPS e estatísticas', sounds));

    this.root = el('div', { className: 'screen settings-screen', attrs: { role: 'dialog', 'aria-label': 'Configurações' } }, [
      el('div', { className: 'panel glass wide' }, [
        el('h2', { text: 'Configurações' }),
        el('div', { className: 'settings-grid' }, rows),
        el('p', { className: 'muted small-print', text: 'As preferências são salvas neste navegador. “Balanço da câmera” em 0% remove qualquer movimento de câmera ao andar ou correr.' }),
        el('nav', { className: 'menu-buttons row' }, [
          aeroButton('Restaurar padrões', () => store.reset(), sounds),
          aeroButton('Voltar', () => this.onBack(), sounds, 'primary'),
        ]),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
    store.subscribe((s) => this.refresh(s));
    this.refresh(store.get());
  }

  private sliderRow(spec: SliderSpec): HTMLElement {
    const id = `setting-${spec.key}`;
    const value = el('output', { className: 'setting-value', attrs: { for: id } });
    const input = el('input', {
      attrs: { type: 'range', id, min: String(spec.min), max: String(spec.max), step: String(spec.step) },
    });
    const toSlider = spec.toSlider ?? ((v: number) => v);
    const fromSlider = spec.fromSlider ?? ((v: number) => v);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value.textContent = spec.format(v);
      this.store.set({ [spec.key]: fromSlider(v) } as Partial<GameSettings>);
    });
    this.refreshers.push((s) => {
      const v = toSlider(s[spec.key] as number);
      if (document.activeElement !== input) input.value = String(v);
      value.textContent = spec.format(Number(input.value));
    });
    return el('label', { className: 'setting-row', attrs: { for: id } }, [el('span', { className: 'setting-label', text: spec.label }), input, value]);
  }

  private toggleRow(key: 'invertY' | 'showFps', label: string, sounds: UiSounds): HTMLElement {
    const id = `setting-${key}`;
    const input = el('input', { attrs: { type: 'checkbox', id } });
    input.addEventListener('change', () => {
      sounds.click();
      this.store.set({ [key]: input.checked } as Partial<GameSettings>);
    });
    this.refreshers.push((s) => {
      input.checked = s[key];
    });
    return el('label', { className: 'setting-row toggle', attrs: { for: id } }, [el('span', { className: 'setting-label', text: label }), el('span', { className: 'switch' }, [input, el('span', { className: 'knob' })])]);
  }

  private qualityRow(sounds: UiSounds): HTMLElement {
    const make = (value: 'high' | 'economy', label: string) => {
      const b = el('button', { className: 'seg', text: label, attrs: { type: 'button' } });
      b.addEventListener('click', () => {
        sounds.click();
        this.store.set({ quality: value });
      });
      this.refreshers.push((s) => b.classList.toggle('active', s.quality === value));
      return b;
    };
    return el('div', { className: 'setting-row' }, [
      el('span', { className: 'setting-label', text: 'Qualidade gráfica' }),
      el('div', { className: 'segmented' }, [make('high', 'Alta'), make('economy', 'Econômica')]),
      el('span', { className: 'setting-value muted', text: '' }),
    ]);
  }

  private refresh(s: Readonly<GameSettings>): void {
    for (const r of this.refreshers) r(s);
  }

  show(onBack: () => void): void {
    this.onBack = onBack;
    this.refresh(this.store.get());
    setScreenVisible(this.root, true);
  }

  hide(): void {
    setScreenVisible(this.root, false);
  }
}
