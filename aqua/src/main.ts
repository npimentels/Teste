import './styles/main.css';
import { Game } from './core/Game';

const app = document.getElementById('app') as HTMLDivElement;
const loading = document.getElementById('loading') as HTMLDivElement;
const bar = document.getElementById('loading-bar') as HTMLDivElement;
const label = document.getElementById('loading-label') as HTMLParagraphElement;

function fail(message: string): void {
  loading.classList.add('error');
  label.textContent = message;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

async function boot(): Promise<void> {
  if (!webglAvailable()) {
    fail('Seu navegador não oferece WebGL 2. Atualize o navegador ou ative a aceleração de hardware para explorar AQUA.');
    return;
  }
  const game = new Game(app);
  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { aqua: unknown }).aqua = game.debugApi();
  }
  await game.init((fraction, text) => {
    bar.style.width = `${Math.round(fraction * 100)}%`;
    label.textContent = text;
  });
  loading.classList.add('done');
  window.setTimeout(() => loading.remove(), 900);
}

boot().catch((err: unknown) => {
  console.error(err);
  fail(`Não foi possível iniciar o jogo: ${err instanceof Error ? err.message : String(err)}`);
});
