# Cantinho — direção de arte e plano

## A ideia

Um espaço onde tudo pode ser construído e onde existe vida. Do **Habbo Hotel**
vêm as mobis com estado, o empilhamento, o inventário, o guarda-roupa, os
comestíveis, o infostand e os balões de fala. Do **Witchbrook** vêm a luz
dourada, o clima aconchegante e o toque de bruxaria. As referências de
decoração são os quartos de designers da comunidade Habbo: ambientes integrados,
madeira escura, branco, mármore, plantas grandes e muitos objetos pequenos.

## Bíblia de arte

### Grade e projeção

| Item | Valor |
|------|-------|
| Projeção | dimétrica 2:1 (a do Habbo) |
| Tile | losango de **64 × 32 px** |
| Unidade | 1 tile = 32 unidades em X e Y; Z em pixels |
| Fórmula | `sx = x − y` · `sy = (x + y)/2 − z` |
| Parede | 124 px de altura, 8 de espessura |
| Avatar | ~72 px sem chapéu, 8 direções |
| Escala na tela | sempre inteira, pixels nítidos |

### Como a arte é gerada

Tudo é desenhado por código, então cada peça nova sai com a mesma luz, paleta e
acabamento, nas 4 rotações:

| Primitiva | Uso |
|-----------|-----|
| `r.box(...)` | caixas com texturas por face: tampos, gavetas, portas |
| `r.lathe(...)` | sólidos de revolução: vasos, abajures, pés torneados |
| `r.sdf([...])` | formas orgânicas: almofadas, louças, folhagens, o avatar |
| `r.map(...)` · `r.pts(...)` | pixel art à mão e pontos (rostos, fios, luzinhas) |

O rasterizador tem **z-buffer** (peças que se cruzam ficam certas), suporta
**vidro e água translúcidos** e faz um pós-processamento com contorno escuro,
linha de contato entre peças e brilho de aresta.

### Personagens: pré-render 3D → pixel art

O avatar é um boneco 3D articulado (cabeça, tronco, braços e pernas) que é
renderizado para pixel art nas 8 direções do Habbo, com a mesma luz das
mobílias e contorno quase preto. Olhos, cílios, boca e óculos são carimbos de
pixel desenhados à mão sobre o rosto. Cada roupa é uma regra de material sobre
o corpo (manga curta, saia, botas…), então ela já funciona em todas as poses e
direções. Os pets usam o mesmo sistema.

### Luz e cor

- Luz vindo da esquerda: topo claro, face esquerda média, direita escura.
- Variação de matiz: claros puxam para o amarelo, escuros para o azul-violeta.
- Noite e entardecer multiplicam a cena por uma cor ambiente; cada luminária
  soma um halo; as janelas projetam feixes de sol no piso.

### Paleta base

| Papel | Cores |
|-------|-------|
| Madeiras | `#8a5a3c` nogueira · `#c49a6c` carvalho · `#a8734a` teca |
| Neutros | `#f2efe9` branco · `#eceae6` mármore · `#4a4850` grafite |
| Tecidos | `#d8d4cc` `#9fa6b3` `#4f5f7f` `#e8b4b8` `#a3b5a0` `#d9a23b` |
| Metais | `#d9a94a` latão · `#c9d3de` cromo |
| Natureza | `#5d9b4c` folha · `#4fb0d6` água |

## Próximos passos sugeridos

1. **Moedas e catálogo com preços**, ganhas cuidando dos pets e regando plantas.
2. **Mais interações**: plantas que crescem, fogão que cozinha, banho de banheira
   que deixa o avatar cheiroso, vitrola com música de verdade.
3. **Mais roupas e animações** (pular, deitar no chão, carregar caixas).
4. **Vários cômodos** ligados pela porta de entrada; escadas e desníveis.
5. **Multiplayer**: servidor WebSocket com salas, visitas e chat compartilhado.
6. **Som**: trilha lo-fi, passos por tipo de piso, ronronar, água da piscina.
