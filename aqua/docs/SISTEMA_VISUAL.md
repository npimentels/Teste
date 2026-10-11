# AQUA — Sistema visual

Referência única para construir novas áreas sem perder a identidade. O código correspondente fica em
`src/world/Palette.ts`, `Materials.ts`, `ArchKit.ts`, `Furniture.ts` e `core/AssetManager.ts`.

## 1. Paleta (`Palette.ts → PALETTE`)

| Papel | Cor | Uso |
| --- | --- | --- |
| Porcelana / pérola | `#F5FBFF` / `#E6EFF4` | Cascas, tetos, grandes pisos |
| Azul-cobalto | `#1747B5` (profundo `#0D2F86`) | **Cor-âncora**: rodapés, molduras, faixas de coluna, mobiliário, sinalização |
| Azul oceânico | `#087DAE` | Incrustações de piso, piscinas, texto secundário |
| Ciano | `#28C5DF` / brilho `#5FE8F5` | Somente o que brilha ou é translúcido: luz, acrílico, água |
| Verde-limão | `#9BE22D` | Destaque pontual (no máximo um por linha de visão) |
| Verde folha | `#64C98B` | Vegetação e superfícies vegetais |
| Bordo (maple) | `#E7C99A` | Contraponto quente, com parcimônia |

**Proporção por vista** ≈ 55% brancos · 25% azuis · 12% verdes · 8% cromo/vidro/luz.

**Regras de contraste**
1. Branco nunca encosta em branco sem separador (frisos cromados, faixa cobalto ou sombra).
2. Cobalto fica baixo (0–1,2 m) e nas molduras; não vai para o teto.
3. Ciano é reservado a luz, acrílico e água.
4. Cores saturadas são sempre brilhantes (clearcoat); superfícies foscas são neutras.

## 2. Materiais (`Materials.ts`)

`cobaltCeramic`, `cobaltDeep`, `cobaltMosaic`, `cyanAcrylic`, `limeGlossy`, `terrazzo`, `wetStone`,
`brushedMetal`, `fabricCobalt/Cyan/Lime`, `maple`, `frostedGlass`, `glossBlack`, `flutedWall`, `rug`, além dos
anteriores (`whiteCeramic`, `glass`, `chrome`, `poolTileAt(nível, força, chave, 'cyan'|'cobalt')`…).
Materiais com `userData.worldUV = true` recebem UV em coordenadas de mundo (o tamanho do ladrilho não muda com a peça).
Para receber um reflexo local (probe), **clone** o material da zona, como o Átrio faz com o terrazzo.

## 3. Componentes arquitetônicos (`ArchKit.ts`)

| Função | O que constrói |
| --- | --- |
| `organicColumn` | Coluna torneada: base alargada, fuste com êntase, faixa cobalto com aros cromados, capitel-lótus |
| `portal` | Batentes cobalto arredondados, verga com placa integrada e aleta de acrílico ciano (com colisão) |
| `wainscot` | Rodapé alto em mosaico cobalto com friso cromado |
| `lightCove` | Sanca branca que esconde uma fita emissiva (luz indireta na parede) |
| `crescentRibs` | Nervuras em crescente sob o teto (profundas na parede, finas no óculo) |
| `floorInlay` | Anéis incrustados no piso |
| `treeColumn` | Coluna-árvore branca que se abre em copa sob a cobertura (estações) |
| `straightStair` | Escada reta com degraus, rampa de colisão e guarda-corpos de vidro |
| `slopedBalustrade` | Guarda-corpo inclinado com colisão por segmentos |

Todas aceitam parâmetros (alturas, raios, quantidade) para evitar repetição evidente.

## 4. Mobiliário e objetos (`Furniture.ts`)

`crescentSofa`, `glassTable`, `eggChair`, `rug`, `planterBowl`, `bubbleLamp`, `recycleBins`, `waterDispenser`,
`receptionDesk`, `infoTotem` (com mapa do complexo e "você está aqui"), `lilyPads`, `teardropLamp` (luminária-gota
suspensa), `bench` (banco reto que devolve os pontos de assento para o sistema `Seats`).
Assentos: qualquer móvel registra pontos com `ctx.addSeat({x, y, z, yaw, parent?})`; não existe código por banco.
Todos têm colisão coerente (encostos e mesas não são "escaláveis"), são fundidos por material e reutilizam geometria.

### Kits da Fase 3

- **Interiores** (`Interiors.ts`):
  - Peças: `tubChair`, `sofa`, `bed`, `roundBed`, `nightstand`, `wardrobe`, `desk`, `bookshelf`, `roundTable`,
    `pouf`, `rugRect`, `tableDecor`.
  - `artPanel` gera "pinturas" Frutiger por semente: céu, colinas, bolhas e água.
  - Tecidos próprios (`fabric('linen' | 'pearl' | 'mist' | 'lagoon' | 'coral')`) com *sheen*, para não parecerem
    plástico.
- **Luminárias** (`Lamps.ts`):
  - Peças: `floorLamp`, `arcLamp`, `wallSconce`, `tableLamp`, `lightLine` (sob bancadas, sofás, degraus,
    corredores), `ringPendant`, `downlight`, além de `teardropLamp`/`bubbleLamp` (`Furniture.ts`).
  - `LampGroup`: um material emissivo por grupo comutável (todas as lâmpadas do grupo viram uma única malha) e
    "poças" de luz aditivas pintadas nas superfícies. Nenhuma luminária cria luz dinâmica.
- **Aquários** (`Aquarium.ts`): caixa ou cilindro, com fundo pintado nas faces encostadas em paredes, gabinete,
  coroa, areia, rochas, corais, algas, peixes, bolhas e superfície cáustica. Peixes menores em aquários pequenos,
  sempre dentro do vidro. A parte viva só existe de perto.
- **Banheiro** (`BathroomKit.ts`): cuba de vidro com torneira, saboneteira, secador, papel-toalha, vaso com
  descarga, fileira de cabines com portas, ventilação e parede de espelhos.
- **Portas e cortinas** (`Doors.ts`): `HingedDoor`, `SlidingDoor`, `Curtains` e `examine`.
- **Iluminação de interiores**: perfil `suite` (salão e hotel), com mais luz de céu e exposição — as referências
  são muito luminosas.

## 5. Sinalização e tipografia

- Placa padrão: pílula cobalto brilhante, texto branco em fonte humanista (Segoe UI / Frutiger / Myriad), bolha
  ciano com a seta, ponto limão à direita (`AssetManager.sign(texto, seta, corDaZona)`).
- Cor da bolha por destino: Jardins `#3FAE66`, Galeria `#28C5DF`, Esplanada `#9BE22D`, Terraço `#087DAE`.
- Nos interiores, a sinalização vai integrada à verga dos portais (`portal(...)`); placas em poste ficam para áreas externas.
- Interface (HUD/menus): teclas e botão principal em cobalto, sublinhado limão no título da zona.
- **Aqua Metro** (`MetroSignage.ts`): painel cobalto arredondado com brilho superior e borda branca, título
  bilíngue (PT grande, EN menor), selo "2 Linha", pictograma (trem, sanitário, saída) e seta. Painéis de partidas
  em azul-escuro com linha destacada em ciano; relógio digital; mapa da rede com estações abertas e "em breve".
- **Mercado Aqua**: placas em pílula branca com borda na cor da seção (cobalto bebidas, limão hortifruti/sucos) e
  emblema de gota; etiquetas de preço em faixa limão.

## 6. Regras de iluminação por ambiente (`Palette.ts → AMBIENCE`)

| Ambiente | Luz de céu | Reflexo ambiente | Sol | Exposição | Observação |
| --- | --- | --- | --- | --- | --- |
| `hall` (salões cobertos) | 0,42 | 0,45 | 3,4 | 0,98 | Contraste para o cobalto e as sombras lerem |
| `aquarium` | 0,30 | 0,35 | 3,0 | 1,08 | Escuro e frio; luz de destaque e cáusticas trabalham |
| `garden` | 0,55 | 0,55 | 3,4 | 0,98 | Claro sem lavar |
| `terrace` | 0,60 | 0,60 | 3,5 | 1,00 | Recompensa visual |
| `open` | 0,58 | 0,55 | 3,4 | 0,98 | Gramados |

A transição entre perfis é suave (o `LightingSystem` interpola). Luzes pontuais ficam sempre na cena com
intensidade animada (sem recompilar shaders); sombras dinâmicas só do sol.

## 7. Orçamento de desempenho por área

- Até ~60 draw calls novos por zona interna (perfil Alto, com sombras).
- Geometria repetida: `InstancedMesh` (vegetação, peixes) ou fusão estática por material (arquitetura, móveis).
- Segmentação proporcional ao tamanho (esferas e anéis já fazem isso no `WorldBuilder`).
- Medir sempre com `?debug` → `aqua.state()` (calls/triangles) ou com "Mostrar FPS" nas Configurações.
