# Cantinho

Um quartinho isométrico em pixel art para decorar, construir e viver — primo do
**Habbo Hotel** na mecânica (mobis, empilhamento, balões de fala, infostand) e
do **Witchbrook** na estética (paleta quente, luz dourada, toque bruxinho).

Sem dependências e sem etapa de build: é HTML + JavaScript puro.

## Como jogar

O navegador bloqueia módulos JavaScript abertos direto do disco (`file://`),
então rode um servidor local qualquer dentro desta pasta:

```bash
cd cantinho
python3 -m http.server 8000      # ou: npx http-server -p 8000
```

Abra `http://localhost:8000`.

Para gerar uma **versão em arquivo único** (abre com duplo clique, sem
servidor):

```bash
node tools/build.mjs             # gera dist/cantinho.html
```

### Controles

| Ação | Como |
|------|------|
| Andar | clique no chão, ou WASD / setas |
| Sentar / deitar | clique num sofá, poltrona, cadeira ou cama |
| Usar mobi (luz, porta, TV, lareira…) | duplo clique (ou duplo toque) |
| Abrir o catálogo | botão **Catálogo** ou tecla `C` |
| Girar mobi | `R` ou botão direito durante o posicionamento |
| Mover / guardar mobi selecionada | `M` / `Delete` |
| Conversar | `Enter` — `o/` acena, `:dançar`, `:sentar`, `:levantar` |
| Câmera | arraste o quarto; roda do mouse ou `+`/`-` para zoom |

Chame um pet pelo nome no chat e ele vem até você.

## O que já existe

- **Quarto isométrico** 2:1 com piso e paredes trocáveis (5 pisos × 5 papéis
  de parede, várias cores) e 4 tamanhos de quarto.
- **45 mobílias** em 8 categorias (Sala, Quarto, Cozinha, Plantas, Mágico,
  Parede, Construção, Pets), cada uma com várias cores e **4 rotações**.
- **Mobis com estado**: portas que abrem e fecham (fechada bloqueia a
  passagem), luminárias, TV animada, lareira, caldeirão borbulhante,
  guarda-roupa, baú, geladeira, cortinas…
- **Empilhamento** estilo Habbo: mesas, criados e balcões aceitam objetos em cima.
- **Mobis de parede**: janela (o céu muda com a hora), quadros, pôster, relógio
  com a hora real, prateleira de poções, arandela, varal de luzinhas.
- **Avatar** customizável (pele, 4 cabelos, cores, chapéu de bruxa, gorro,
  flor) que anda, senta, deita, acena e dança.
- **Pets com vida**: cachorros e gatos que passeiam, seguem você, comem no
  pote, dormem na caminha e pedem carinho.
- **Dia, entardecer e noite** (automático pelo relógio ou manual), com luzes
  dinâmicas e feixes de sol entrando pela janela.
- **Salvamento automático** no navegador + exportar/importar o quarto como código.

## Estrutura

```
cantinho/
├── index.html
├── css/style.css          interface (painéis de pergaminho)
├── src/
│   ├── main.js            ponto de entrada
│   ├── game.js            controlador: entrada, ações, salvar
│   ├── room.js            grade, regras de posicionamento e empilhamento
│   ├── furniture.js       catálogo de mobílias (a arte de cada peça)
│   ├── raster.js          rasterizador isométrico de sprites
│   ├── sprites.js         cache de sprites e miniaturas
│   ├── characters.js      avatar, pets e ícones (mapas de pixel)
│   ├── entities.js        movimento, poses e IA dos pets
│   ├── path.js            A* com 8 direções
│   ├── renderer.js        cena, profundidade, luz e sombras
│   ├── ui.js              catálogo, visual, ajustes, infostand, balões
│   ├── color.js           sombreamento com variação de matiz
│   └── config.js          constantes do mundo
├── dev/sheet.html         folha com todos os sprites (para desenhar/revisar)
├── tools/build.mjs        gera a versão em arquivo único
└── DESIGN.md              direção de arte e próximos passos
```

## Criando uma mobília nova

Toda a arte é gerada por código a partir de primitivas 3D, então uma mobi
nova é só um objeto em `src/furniture.js`:

```js
add({
  id: 'banquinho', name: 'Banquinho', cat: 'sala', size: [1, 1], h: 14,
  sit: { z: 10 }, variants: ['#b0744a', '#d94f4f'],
  draw(r, o) {
    legs(r, 3, 3, 13, 13, 8, C.woodD);        // 4 pés
    r.box(2, 2, 8, 12, 12, 3, o.color);       // assento: x, y, z, larg, prof, alt
  },
});
```

Abra `dev/sheet.html` (com o servidor rodando) para ver a peça em todas as
rotações e estados. Detalhes das primitivas e regras de arte estão em
[DESIGN.md](DESIGN.md).
