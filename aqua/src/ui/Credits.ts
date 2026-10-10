import { aeroButton, el, setScreenVisible, type UiSounds } from './dom';

export class Credits {
  readonly root: HTMLDivElement;

  constructor(parent: HTMLElement, onBack: () => void, sounds: UiSounds) {
    this.root = el('div', { className: 'screen credits-screen', attrs: { role: 'dialog', 'aria-label': 'Créditos' } }, [
      el('div', { className: 'panel glass' }, [
        el('h2', { text: 'Créditos' }),
        el('div', {
          className: 'credits-body',
          html: `
            <p><strong>AQUA: Dream of Tomorrow</strong> — um sonho tecnológico otimista inspirado na estética Frutiger Aero (2004–2012).</p>
            <h3>Tecnologia</h3>
            <ul>
              <li>Three.js — renderização 3D (licença MIT)</li>
              <li>Vite — ferramenta de build (licença MIT)</li>
              <li>TypeScript — linguagem (licença Apache 2.0)</li>
            </ul>
            <h3>Arte e som</h3>
            <ul>
              <li>Arquitetura, vegetação, peixes, água, céu e texturas: gerados proceduralmente pelo código do projeto.</li>
              <li>Música ambiente, sons de água, pássaros e efeitos: sintetizados em tempo real com a Web Audio API — nenhuma gravação ou trilha comercial.</li>
              <li>Tipografia: fontes do sistema (Segoe UI / Helvetica / Arial).</li>
            </ul>
            <p class="muted">Nenhum asset externo de terceiros é utilizado nesta versão.</p>`,
        }),
        el('nav', { className: 'menu-buttons' }, [aeroButton('Voltar', onBack, sounds, 'primary')]),
      ]),
    ]);
    this.root.hidden = true;
    parent.appendChild(this.root);
  }

  show(): void {
    setScreenVisible(this.root, true);
  }

  hide(): void {
    setScreenVisible(this.root, false);
  }
}
