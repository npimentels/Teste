// Catálogo de mobílias: junta as categorias e expõe o registro.
import { defs } from './furni_base.js';
import { sala } from './furni_sala.js';
import { quarto } from './furni_quarto.js';
import { cozinha } from './furni_cozinha.js';
import { banheiro } from './furni_banheiro.js';
import { jardim } from './furni_jardim.js';
import { comidas } from './furni_comidas.js';
import { decor } from './furni_decor.js';
import { parede, skyColor } from './furni_parede.js';
import { construcao } from './furni_construcao.js';

void [sala, quarto, cozinha, banheiro, jardim, comidas, decor, parede, construcao];

export { skyColor };

export const FURNI = Object.fromEntries(defs.map((d) => [d.id, d]));

export const CATEGORIES = [
  { id: 'sala', name: 'Sala' },
  { id: 'quarto', name: 'Quarto' },
  { id: 'cozinha', name: 'Cozinha' },
  { id: 'banheiro', name: 'Banheiro' },
  { id: 'jardim', name: 'Jardim' },
  { id: 'comidas', name: 'Comidas' },
  { id: 'plantas', name: 'Plantas' },
  { id: 'decoracao', name: 'Decoração' },
  { id: 'magico', name: 'Mágico' },
  { id: 'parede', name: 'Parede' },
  { id: 'construcao', name: 'Construção' },
  { id: 'pets', name: 'Pets' },
];

export const isWalkable = (def, state) =>
  typeof def.walk === 'function' ? def.walk(state) : !!def.walk;
