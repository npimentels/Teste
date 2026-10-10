import { aeroButton, el, setScreenVisible, type UiSounds } from './dom';

export interface PauseActions {
  resume(): void;
  settings(): void;
  quitToMenu(): void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;
  private readonly message: HTMLParagraphElement;

  constructor(parent: HTMLElement, actions: PauseActions, sounds: UiSounds) {
    this.message = el('p', { className: 'pause-message' });
    this.root = el('div', { className: 'screen pause-screen', attrs: { role: 'dialog', 'aria-label': 'Pausa' } }, [
      el('div', { className: 'panel glass small' }, [
        el('h2', { text: 'Pausado' }),
        this.message,
        el('nav', { className: 'menu-buttons' }, [
          aeroButton('Retomar', actions.resume, sounds, 'primary'),
          aeroButton('Configurações', actions.settings, sounds),
          aeroButton('Voltar ao menu inicial', actions.quitToMenu, sounds),
        ]),
        el('p', {
          className: 'menu-controls',
          html: '<kbd>W A S D</kbd> andar · <kbd>Shift</kbd> correr · <kbd>Espaço</kbd> pular<br><kbd>E</kbd> interagir / pegar · <kbd>G</kbd> soltar · <kbd>Clique</kbd> arremessar',
        }),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(message = ''): void {
    this.message.textContent = message;
    this.message.hidden = !message;
    setScreenVisible(this.root, true);
  }

  hide(): void {
    setScreenVisible(this.root, false);
  }
}
