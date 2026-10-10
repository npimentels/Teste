import { aeroButton, el, setScreenVisible, type UiSounds } from './dom';

export interface MainMenuActions {
  start(): void;
  settings(): void;
  credits(): void;
}

export class MainMenu {
  readonly root: HTMLDivElement;
  private readonly startButton: HTMLButtonElement;

  constructor(parent: HTMLElement, actions: MainMenuActions, sounds: UiSounds) {
    this.startButton = aeroButton('Iniciar exploração', actions.start, sounds, 'primary');
    const bubbles = el('div', { className: 'menu-bubbles', attrs: { 'aria-hidden': 'true' } });
    for (let i = 0; i < 14; i++) {
      const b = el('span', { className: 'bubble' });
      b.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      b.style.setProperty('--s', `${Math.round(12 + Math.random() * 46)}px`);
      b.style.setProperty('--d', `${(9 + Math.random() * 12).toFixed(1)}s`);
      b.style.setProperty('--delay', `${(-Math.random() * 20).toFixed(1)}s`);
      bubbles.append(b);
    }
    this.root = el('div', { className: 'screen main-menu', attrs: { role: 'dialog', 'aria-label': 'Menu inicial' } }, [
      bubbles,
      el('div', { className: 'menu-panel glass' }, [
        el('div', { className: 'title-block' }, [
          el('h1', { className: 'game-title' }, [el('span', { className: 'title-aqua', text: 'AQUA' })]),
          el('p', { className: 'game-subtitle', text: 'Dream of Tomorrow' }),
        ]),
        el('p', { className: 'tagline', text: 'Um complexo futurista, silencioso e luminoso espera por você. Explore, observe e brinque com a água.' }),
        el('nav', { className: 'menu-buttons' }, [
          this.startButton,
          aeroButton('Configurações', actions.settings, sounds),
          aeroButton('Créditos', actions.credits, sounds),
        ]),
        el('p', {
          className: 'menu-controls',
          html: '<kbd>W A S D</kbd> andar · <kbd>Mouse</kbd> olhar · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular · <kbd>E</kbd> interagir · <kbd>G</kbd> soltar · <kbd>Esc</kbd> pausa',
        }),
      ]),
      el('p', { className: 'version', text: 'v0.2 · identidade visual' }),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(): void {
    setScreenVisible(this.root, true);
    this.startButton.focus({ preventScroll: true });
  }

  hide(): void {
    setScreenVisible(this.root, false);
  }
}
