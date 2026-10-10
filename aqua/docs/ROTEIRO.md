# AQUA — Roteiro de expansão

## Concluído
- **v0.1** — Protótipo jogável: Átrio Azul, Jardins Hidráulicos, Galeria Aquática, Terraço do Horizonte.
- **v0.2** — Identidade visual definitiva aplicada ao Átrio Azul (ver `SISTEMA_VISUAL.md`).

## Próxima etapa: Mercado Aqua (planejado, ainda não construído)

**Terreno reservado** (`LAYOUT.planned.market` em `src/world/WorldLayout.ts`): gramado sudeste, entre a Galeria e a
borda sul do platô — x 19…46, z 11,5…26 (≈ 27 × 14,5 m). Entrada principal voltada para a esplanada sul do Átrio
(saída "Esplanada"), sem bloquear a vista da parede de vidro do Átrio (que olha para oeste).
Ao construir, remover/realocar o que hoje ocupa o terreno: as esculturas de esferas em (24, 20) e (26,4; 21,5) e as
palmeiras do anel externo do Átrio que caírem dentro do retângulo (`Surroundings.ts`).

**Programa**
- Casca: tambor alongado com cantos arredondados, fachada de vidro curva voltada para a esplanada, marquise cobalto
  com letreiro "Mercado Aqua" (padrão de sinalização), sanca de luz interna.
- Piso: terrazzo com faixas de circulação em mosaico cobalto (piso refletivo com probe local, como no Átrio).
- Prateleiras curvas: novo componente `curvedShelf` (arcos de 3 níveis em cerâmica branca com testeira cobalto).
- Garrafas coloridas: `InstancedMesh` único (≈ 600 instâncias, 4 formatos via lathe, cores por instância) —
  1 draw call.
- Refrigeradores de vidro: módulo `glassFridge` com portas de vidro, iluminação interna emissiva (fria) e
  prateleiras; grupo de luz próprio.
- Balcão de caixa arredondado (reutilizar `receptionDesk`), placas luminosas de seção (Água, Frutas, Bem-estar),
  plantas em `planterBowl`, `waterDispenser`, `recycleBins`.
- Interações (modelo atual de `Interactable`): painel de luzes da loja; refrigerador que acende ao abrir;
  garrafas carregáveis selecionadas (reaproveitando `ObjectPhysics` com raio pequeno).
- Áudio: leito "loja" (zumbido leve de refrigeração + música ambiente mais presente).
- Novo `ZoneId` `'market'`, título/subtítulo em `ZONE_INFO`, perfil de iluminação `hall`.

**Critérios de aceite**: acessível a pé pela esplanada, colisões em prateleiras e balcões, ≤ 60 draw calls a mais
no perfil Alto, garrafas e prateleiras sem repetição evidente (variação de cor/formato), regressão de percurso
(`aqua.simulate`) verde.

## Depois
1. **Aqua Metro** — estação com plataforma, sinalização azul, painéis informativos e trem estilizado parado (animação depois).
2. **Casa do Amanhã** — sala (sofá orgânico azul, mesa de vidro, TV anos 2000, plantas suspensas, luz indireta,
   janelas panorâmicas); depois cozinha e banheiro.
3. **Jardins e Galeria** — passarelas, novos aquários, pontes e interações com água; aplicar o sistema visual v0.2.
