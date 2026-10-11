# Cantinho

Um apê isométrico em pixel art para decorar, construir e viver — primo do
**Habbo Hotel** na mecânica (mobis, empilhamento, inventário, guarda-roupa,
comestíveis, balões de fala) e do **Witchbrook** no clima (luz dourada, toque
bruxinho).

Escala do Habbo: tiles de **64 × 32 px** e avatar de ~72 px, em **8 direções**.
Sem dependências e sem etapa de build: HTML + JavaScript puro.

## Como jogar

O navegador bloqueia módulos JavaScript abertos direto do disco (`file://`),
então rode um servidor local dentro desta pasta:

```bash
cd cantinho
python3 -m http.server 8000      # ou: npx http-server -p 8000
```

Abra `http://localhost:8000`.

Para gerar uma **versão em arquivo único** (abre com duplo clique):

```bash
node tools/build.mjs             # gera dist/cantinho.html
```

### Controles

| Ação | Como |
|------|------|
| Andar | clique no chão, ou WASD / setas (8 direções) |
| Sentar / deitar | clique num sofá, cadeira, cama, espreguiçadeira, banheira… |
| Usar mobi | duplo clique (luz, porta, TV, chuveiro, cortina…) |
| Comer / beber | duplo clique no bolo, pizza, café… ou "Pegar" na geladeira |
| Nadar | ande para dentro da piscina |
| Catálogo · Inventário | botões ou teclas `C` · `I` |
| Girar · mover · guardar | `R` · `M` · `Delete` |
| Conversar | `Enter` — `o/` acena, `:dançar`, `:sentar`, `:levantar` |
| Câmera | arraste o quarto; roda do mouse ou `+`/`-` para zoom |

## O que existe

- **Avatar estilo Habbo** com 8 direções, andar, sentar, deitar, acenar,
  dançar, nadar, segurar e comer/beber itens.
- **Guarda-roupa** igual ao do Habbo: menino/menina, 12 tons de pele,
  11 cabelos, 8 chapéus, 9 blusas, 5 calças/saias, 5 sapatos, 6 acessórios,
  paleta de cores, preview girável e 6 looks salvos em "Meu Guarda-Roupa".
- **mais de 120 mobílias** em 12 categorias: sala, quarto, cozinha, banheiro, jardim
  (com piscina modular), comidas, plantas, decoração, mágico, parede,
  construção (portas, divisórias, pisos) e pets.
- **Comestíveis animados**: o bolo perde fatia por fatia, a pizza pedaço por
  pedaço; geladeira, máquina de café, bule, jarra, pipoqueira e carrinho de
  sorvete servem itens na mão. O avatar dá goles e mordidas com migalhas.
- **Inventário** de mobis e de pets; comprar no catálogo manda para o
  inventário ou já posiciona no quarto.
- **Planta editável**: formatos (retângulo, L, recuo, T), 4 tamanhos até
  20 × 16 e edição piso a piso; as paredes se ajustam sozinhas.
- **Pets 3D** (cachorro e gato) que passeiam, seguem você, comem, dormem e
  pedem carinho.
- **Dia, entardecer e noite** com luzes dinâmicas, feixes de sol nas janelas e
  um interruptor que apaga todas as luminárias.
- **Salvamento automático** + exportar/importar o quarto como código.

## Estrutura

```
cantinho/
├── index.html · css/style.css
├── src/
│   ├── main.js · game.js       entrada, controle, ações, salvar
│   ├── room.js                 planta, paredes, regras, empilhamento
│   ├── starter.js              apartamento inicial decorado
│   ├── raster.js · sdf.js      motor de pixel art (caixas, revolução, SDF)
│   ├── furni_base.js           paleta e utilitários de arte
│   ├── furni_*.js              catálogo por categoria
│   ├── furniture.js            registro do catálogo
│   ├── avatar.js · pets.js     personagens 3D → pixel art, guarda-roupa
│   ├── entities.js · path.js   movimento, poses, IA, A*
│   ├── renderer.js             cena, profundidade, luz, água
│   ├── ui.js                   catálogo, inventário, guarda-roupa, infostand
│   └── sprites.js · color.js · characters.js · config.js
├── dev/                        folhas de sprites (mobílias, avatar, pets)
├── tools/build.mjs             versão em arquivo único
└── DESIGN.md                   direção de arte e próximos passos
```

## Criando uma mobília nova

Uma mobi é um objeto num dos arquivos `src/furni_*.js`:

```js
add({
  id: 'banquinho', name: 'Banquinho', cat: 'sala', size: [1, 1], h: 22,
  sit: { z: 16 }, variants: [C.oak, C.walnut],
  draw(r, o) {
    legs(r, 6, 6, 26, 26, 14, C.black, 3);          // 4 pés
    cushion(r, 5, 5, 14, 22, 22, 5, o.color);       // assento fofinho
  },
});
```

Abra `dev/sheet.html?cat=sala&rots&states` (com o servidor rodando) para ver a
peça em todas as rotações e estados. Detalhes em [DESIGN.md](DESIGN.md).
