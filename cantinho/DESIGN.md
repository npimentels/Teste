# Cantinho — direção de arte e plano

## A ideia

Um espaço pequeno onde tudo pode ser construído e onde existe vida. Da
mecânica do **Habbo Hotel** vêm as "mobis" com estado, o empilhamento, o
infostand, o chat em balões e o quarto isométrico flutuando no vazio. Da
estética do **Witchbrook** vêm a paleta quente, a luz dourada de fim de tarde,
o clima aconchegante e um toque de bruxaria (caldeirão, bola de cristal,
poções, chapéu de bruxa).

## Bíblia de arte

### Grade e projeção

| Item | Valor |
|------|-------|
| Projeção | isométrica 2:1 (dimétrica de pixel art) |
| Tile | losango de **32 × 16 px** |
| Unidade | 1 tile = 16 unidades em X e Y; Z em pixels |
| Fórmula | `sx = x − y` · `sy = (x + y)/2 − z` |
| Parede | 76 px de altura, 6 de espessura |
| Escala na tela | sempre inteira (×2, ×3, ×4…), pixels nítidos |

As linhas diagonais seguem sempre o degrau **2 por 1**. Isso é garantido pelo
rasterizador: nenhuma peça é desenhada "à mão livre" na diagonal.

### Luz e sombreamento

- **Luz vindo da esquerda**: topo claro, face esquerda média, face direita
  escura (o mesmo do Habbo).
- **Variação de matiz** (`color.js`): tons claros puxam para o amarelo quente,
  tons escuros para o azul-violeta. As sombras ficam coloridas, nunca acinzentadas.
- **Contorno colorido** (sel-out): a silhueta recebe a própria cor bem escurecida,
  não preto puro.
- **Linha de contato**: onde uma peça passa na frente de outra, o pixel de trás
  escurece, separando almofada de sofá, gaveta de móvel etc.
- **Brilho de aresta**: a quina frontal do topo e a quina vertical ganham 1 px
  mais claro, o que dá o acabamento "plástico" das mobis do Habbo.

### Paleta

Base quente e terrosa, com acentos saturados para o que é mágico ou emite luz.

| Papel | Cores |
|-------|-------|
| Madeiras | `#b0744a` `#7d4c31` `#d39b63` `#8e3f2f` |
| Tecidos | `#4a9a92` `#c96b80` `#d9a23b` `#8f7bc2` `#7fa86b` `#4b6aa3` |
| Neutros | `#f1e4c6` creme · `#f3efe6` branco quente · `#2b2232` tinta |
| Mágico / luz | `#6fe08a` poção · `#b07cf0` cristal · `#ffd35a` chama · `#e8b34b` ouro |
| Ambiente noite | `#3a3f75` (multiplicado sobre a cena) |
| Ambiente entardecer | `#d9a6a0` |

### Personagens

- Avatar: 20 × 34 px, proporção chibi (cabeça grande ≈ 40% da altura).
- Vistas: frente (3/4 direita) e costas; as direções da esquerda são espelhadas.
- Cada letra do mapa é um papel (pele, cabelo, camisa…) recolorido em tempo
  real, então um desenho gera todas as combinações de visual.
- Pets: perfil voltado para a direita (≈ 16–18 px), poses `stand`, `walk`,
  `sit` e `sleep`.

### Como a arte é feita (rasterizador)

Cada mobi é "esculpida" em `furniture.js` com três primitivas:

| Primitiva | Uso |
|-----------|-----|
| `r.box(x, y, z, w, d, h, cor, { tex })` | caixas: tampos, pés, portas, almofadas |
| `r.lathe(cx, cy, z, perfil, cor)` | sólidos de revolução: vasos, abajures, caldeirão |
| `r.map(x, y, z, linhas, paleta)` | pixel art à mão: folhas, chamas, flores |
| `r.pts([[x, y, z, cor], …])` | pontos soltos: fios, varal de luzes |

As texturas (`tex.left`, `tex.right`, `tex.top`, `tex.back`) recebem as
coordenadas da face e devolvem um deslocamento de sombra, uma cor ou
`{ raw }` para pixels que brilham (telas, chamas, céu). A rotação é gratuita:
o mesmo desenho gera as 4 direções, com a luz recalculada.

## Próximos passos sugeridos

1. **Sprites desenhados à mão** para peças-chave (sofá, cama, avatar) usando o
   rasterizador como base: exportar a folha de `dev/sheet.html`, refinar no
   Aseprite e carregar PNGs por cima das peças geradas.
2. **Mais direções do avatar** (8 direções como no Habbo) e animações de
   sentar no chão, carregar objetos e regar plantas.
3. **Inventário e moedas**: mobis guardadas vão para um inventário; o catálogo
   passa a ter preço e moedas vêm de tarefas (alimentar pets, regar plantas).
4. **Mobis interativas de verdade**: plantas que crescem com o tempo, caldeirão
   que produz poções, fogão que cozinha, cama que muda o horário.
5. **Pets mais vivos**: brincar com bolinha, gato que sobe em sofá e cama,
   humor que muda com carinho e comida, filhotes de cores raras.
6. **Mais cômodos**: a porta de entrada leva a um corredor e a outros quartos;
   editor de planta (pisos em L, escadas, desníveis).
7. **Multiplayer** (o grande passo rumo ao Habbo): servidor WebSocket com salas,
   visitas a quartos de amigos e chat compartilhado.
8. **Som**: trilha lo-fi, crepitar da lareira, ronronar, passos por tipo de piso.
