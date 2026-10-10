# AQUA: Dream of Tomorrow

Jogo 3D de exploração em primeira pessoa para navegador, inspirado na estética **Frutiger Aero** (2004–2012): arquitetura branca e curva, vidro, cromados, água turquesa, vegetação tropical e céu luminoso. Não há combate, cronômetro nem missões: você explora, observa e brinca com a água.

Feito com **Three.js**, **Vite** e **TypeScript**. Toda a arte (arquitetura, plantas, peixes, céu, texturas) e todo o som (música, água, pássaros, efeitos) são **gerados por código** — o projeto não depende de nenhum arquivo externo de modelo, imagem ou áudio.

---

## Requisitos

- Node.js 20 ou superior (desenvolvido e testado com Node 22.22 / npm 10.9)
- Navegador de desktop com **WebGL 2** (Chrome, Edge, Firefox ou Safari recentes), mouse e teclado

## Jeito mais fácil: clique duplo

Com o Node.js instalado, abra a pasta `aqua` e dê **dois cliques** em:

- **Windows:** `Jogar AQUA.bat`
- **macOS:** `jogar-aqua.command` (na primeira vez: botão direito → Abrir, por causa da proteção do Gatekeeper)

Na primeira execução o atalho instala as dependências; depois disso ele só liga o servidor e abre o jogo no navegador. **Para sair**, feche a aba do navegador e a janela do terminal que o atalho abriu.

## Instalação e execução

```bash
cd aqua
npm install          # instala three, vite, typescript e vitest
npm run dev          # servidor de desenvolvimento em http://localhost:5173
```

Build de produção:

```bash
npm run build        # verificação de tipos (tsc) + build otimizado em dist/
npm run preview      # serve o build em http://localhost:4173
```

Testes automatizados (colisão e controlador do jogador):

```bash
npm test
```

> O arquivo `.npmrc` define `legacy-peer-deps=true` porque o npm 10.9 falha ao resolver as dependências opcionais do Vitest 4 ("Cannot read properties of null (reading 'edgesOut')"). Não afeta o jogo.

## Controles

| Ação | Tecla |
| --- | --- |
| Andar | `W` `A` `S` `D` (ou setas) |
| Olhar | Mouse |
| Correr | `Shift` (segurando junto com `W`) |
| Pular | `Espaço` |
| Interagir / pegar objeto | `E` |
| Soltar objeto | `G` |
| Arremessar objeto carregado | Clique esquerdo |
| Pausar e liberar o mouse | `Esc` |
| Capturar o mouse | Clique na tela |

O jogo pausa sozinho quando a janela perde o foco ou a aba fica oculta; ao voltar, clique em **Retomar**.

## Novidades da v0.2 — identidade visual

- **Sistema visual documentado** em [`docs/SISTEMA_VISUAL.md`](docs/SISTEMA_VISUAL.md): paleta com regras de contraste, materiais, componentes arquitetônicos, mobiliário, sinalização, iluminação por ambiente e orçamento de desempenho.
- **Átrio Azul reformado**: piso de terrazzo com incrustações e halo de mosaico, pedra molhada ao redor da piscina, paredes caneladas com rodapé de mosaico cobalto e sanca de luz, colunas-lótus com faixa cobalto, portais cobalto com sinalização integrada, nervuras orgânicas no teto, piscina em mosaico cobalto com vitórias-régias, pedestal da fonte torneado, lounge com sofá curvo, poltronas-ovo, mesa de vidro e tapete, balcão de recepção com monitor, totens com mapa do complexo, bebedouro, lixeiras de reciclagem, luminárias-bolha, novas plantas (bananeira ornamental, espada-de-são-jorge, trepadeiras pendentes) e variação de cor entre plantas.
- **Água**: o espelho d'água do Átrio reflete o próprio salão (reflexo local "assado" no carregamento, com correção de paralaxe), bordas com menisco e espuma, ondulações contínuas onde os jatos caem (somem quando a fonte desliga).
- **Iluminação por ambiente**: luz de céu, reflexo ambiente, sol e exposição mudam suavemente entre salões, aquário, jardins e terraço.
- **Interface** na nova linguagem (cobalto, ciano, toque limão) e placas no novo padrão.
- Próxima área planejada: **Mercado Aqua** — ver [`docs/ROTEIRO.md`](docs/ROTEIRO.md).

## O que existe no mundo

O complexo ocupa um platô de aproximadamente 100 × 115 m sobre o mar, com todos os ambientes ligados por caminhos que se percorrem a pé (sem teletransporte).

| Zona | Conteúdo | Interações |
| --- | --- | --- |
| **Átrio Azul** (início) | Salão circular branco com óculo de vidro para o céu, piscina rasa com fonte (jato central + 8 arcos), esfera de vidro flutuante, colunas com luzes de destaque, canteiros tropicais, parede-cortina de vidro, bancos | Painel **Fonte do Átrio** (liga/desliga jatos, arcos, respingos e som); painel **Luzes do Átrio** (luzes pontuais, faixas emissivas, cones de luz, cáusticas); 3 esferas carregáveis |
| **Jardins Hidráulicos** (norte) | Canal de 50 m com duas pontes, reservatório elevado com comporta, tubulação de vidro com fluxo visível, duas piscinas quadradas com esculturas e jatos, piscina redonda com fonte de dois níveis, pérgula de arcos, postes, palmeiras, samambaias, flores e grama | Válvula da **Comporta do Canal** (a comporta sobe, uma cortina de água cai no canal, a correnteza aparece, o nível do canal sobe e o do reservatório desce — objetos flutuantes são levados pela corrente); painel **Fontes do Jardim** (3 fontes, bicas e o fluxo dentro da tubulação); 3 esferas |
| **Galeria Aquática** (leste) | Corredor envidraçado entre dois tanques com peixes, algas, corais, rochas, bolhas e feixes de luz; salão redondo com aquário-coluna do piso ao teto e janela panorâmica; saída para a esplanada | Painel **Luzes da Galeria** (luzes turquesa, cáusticas no piso, iluminação dentro dos tanques); painel **Cortina de Bolhas** |
| **Terraço do Horizonte** (destino) | Deck elevado (4 m) acessado por duas rampas, piscina infinita cuja borda transborda para o horizonte, cascata na fachada, espreguiçadeiras, guarda-sóis, pavilhão de vidro, binóculo e vista para ilhas com torres e turbinas eólicas | Painel **Luzes da Piscina**; 2 boias carregáveis que flutuam |

Também é possível **entrar a pé nas piscinas rasas e no canal** (o jogador anda mais devagar, com respingos, ondulações e som de água). Não há natação nem mergulho nesta versão.

## Arquitetura do código

```
src/
  main.ts                  inicialização, tela de carregamento, verificação de WebGL 2
  core/
    Game.ts                laço principal, máquina de estados (carregando → menu ⇄ jogando ⇄ pausa),
                           pointer lock, foco da janela, ligação entre configurações, UI e sistemas
    World.ts               cena, construção das zonas com progresso, atualização e descarte
    AssetManager.ts        texturas procedurais (canvas) com cache e descarte
    Config.ts              preferências do jogador + persistência em localStorage
    Input.ts               teclado/mouse (KeyboardEvent.code, deltas só com o mouse capturado)
    math.ts, types.ts      utilitários, perfis de qualidade
  physics/
    Collision.ts           mundo de colisão: caixas orientadas, cilindros e rampas; grade espacial;
                           resolução de cilindro (jogador), esferas (objetos) e raycast analítico
    Terrain.ts             chão do platô, bacias rebaixadas e borda do penhasco
  player/
    PlayerController.ts    controlador em 1ª pessoa (corpo cilíndrico tipo cápsula, gravidade,
                           degraus, rampas, pulo, vadeio, suavização de câmera, passos)
    InteractionSystem.ts   raio a partir do centro da tela, oclusão por paredes, HUD, E/G/clique
  environment/
    WaterSystem.ts         superfícies de água (shader próprio), ondulações locais, consultas de nível
    Sky.ts                 céu procedural (gradiente, sol, nuvens fbm) e mapa de ambiente
    LightingSystem.ts      sol com sombra que acompanha o jogador, luz de céu, grupos de luz comutáveis
    ParticleSystem.ts      jatos de fonte e bolhas na GPU, fluxos de água (tubos/cortinas), respingos
    Vegetation.ts          palmeiras, samambaias, costelas-de-adão, arbustos, grama e flores instanciados
    AquaticLife.ts         peixes, algas, corais e rochas procedurais; cardumes animados
    ShaderPatches.ts       vento, nado, cáusticas e absorção subaquática injetados nos materiais
  world/
    WorldLayout.ts         coordenadas do mapa, detecção de zona, superfície dos passos
    Builders.ts            helpers de arquitetura (paredes curvas, anéis, guarda-corpos, tubos…)
                           e o agrupador estático que funde malhas por material
    Materials.ts           biblioteca de materiais (cerâmica, vidro, cromo, azulejo, gramado…)
    Atrium.ts, HydraulicGardens.ts, AquariumGallery.ts, HorizonTerrace.ts, Surroundings.ts
  systems/
    Interactables.ts       contrato `Interactable` + painel de controle com tela digital viva
    ObjectPhysics.ts       esferas carregáveis: gravidade, quique, flutuação, correnteza, empurrões
    AudioManager.ts        áudio procedural (Web Audio API), espacial, por categorias
    PerformanceManager.ts  medição de FPS, sobreposição de estatísticas, perfis gráficos
  ui/                      menu inicial, HUD, pausa, configurações, créditos (DOM + CSS)
  styles/main.css          interface Frutiger Aero (painéis translúcidos, botões glossy)
tests/                     testes Vitest de colisão e movimentação
```

Detalhes técnicos relevantes:

- **Delta time** limitado a 50 ms por quadro; movimento do jogador e dos objetos é subdividido em sub-passos para não atravessar paredes finas.
- **Colisões**: o jogador é um cilindro vertical (raio 0,32 m, altura 1,8 m, olhos a 1,68 m) que sobe degraus de até 0,5 m, anda em rampas e é empurrado para fora de paredes; paredes curvas são aproximadas por segmentos.
- **Draw calls**: a arquitetura estática de cada zona é fundida por material (`StaticBatcher`); vegetação, peixes e partículas usam instancing ou buffers únicos animados no shader.
- **Descarte**: `World.dispose()` libera geometrias, materiais, texturas, render targets e o contexto de áudio.

## Configurações

Todas aplicam na hora e ficam salvas no navegador: sensibilidade do mouse, inverter eixo Y, campo de visão, volumes independentes de música / ambiente / efeitos, qualidade gráfica, escala de resolução, intensidade do balanço da câmera (0% desliga) e exibição de FPS.

| Parâmetro | Alta | Econômica |
| --- | --- | --- |
| Sombras do sol | Sim (mapa 2048²) | Não |
| Pixel ratio máximo | 2 | 1 |
| Detalhe da água | 4 camadas de ondulação | 2 camadas |
| Partículas | 100% | 40% |
| Grama e flores | 100% | 35% |
| Oitavas das nuvens | 5 | 3 |
| Esfera do átrio | Transmissão física (refração em tela) | Vidro transparente simples |

## Água: o que é real e o que é simulado

- Superfícies animadas com ondas e ruído de normais em várias escalas, ondulações locais quando o jogador anda na água ou um objeto cai, correnteza no canal.
- **Reflexo**: do céu (cubemap gerado do céu procedural) com termo de Fresnel e brilho especular do sol. Na piscina do Átrio, um **reflexo local** do próprio salão é capturado uma vez no carregamento (cube map com correção de paralaxe por esfera): colunas, paredes e a esfera aparecem refletidas, mas objetos que se movem (jogador, esferas, jatos) não. O piso polido do Átrio usa o mesmo reflexo. Nas demais águas, só o céu.
- **Profundidade / refração**: simuladas por cor (raso → profundo conforme o ângulo), transparência e cáusticas animadas no fundo das piscinas. Não há refração fisicamente correta.
- **Aquários**: a absorção da luz é calculada pela distância que o raio de visão percorre dentro do volume do tanque (caixa ou cilindro), mais escurecimento com a profundidade e cáusticas — uma aproximação, não uma simulação ótica.
- Fontes: partículas balísticas calculadas na GPU, arcos e cortinas como malhas com shader de fluxo que "enchem" e "esvaziam" ao ligar/desligar.

## Áudio

Sintetizado em tempo real (Web Audio API), iniciado somente após um clique ou tecla:
música ambiente generativa (acordes maj9/add9 com sinos e eco), leito sonoro por zona (salão, brisa e pássaros nos jardins, zumbido subaquático na galeria, mar e vento no terraço), fontes, cascatas, canal e bolhas posicionados em 3D (HRTF, atenuação por distância), passos por tipo de piso (azulejo, grama, metal, água), respingos, cliques e acordes de interface. Os três volumes são independentes; com o volume da música em 0 nenhuma nota é agendada.

## Assets e licenças

| Recurso | Origem | Licença |
| --- | --- | --- |
| three 0.183.2 (inclui `RoundedBoxGeometry` e `BufferGeometryUtils` dos addons) | npm | MIT |
| vite 7.3.6 | npm (dev) | MIT |
| typescript 5.9.3 | npm (dev) | Apache-2.0 |
| vitest 4.1.11 | npm (dev) | MIT |
| Modelos, texturas, céu, peixes, vegetação | Gerados pelo código deste projeto | — |
| Música e efeitos sonoros | Sintetizados pelo código deste projeto | — |
| Fontes | Fontes do sistema (Segoe UI / Helvetica / Arial) | — |

**Substituições procedurais registradas**: o briefing previa modelos externos (GLTF) para vegetação, peixes e mobiliário. Como nenhum asset licenciado estava disponível no ambiente, todos foram substituídos por geometria procedural instanciada (palmeiras com troncos anelados e folíolos, samambaias, costelas-de-adão, arbustos, tufos de grama, flores, cinco espécies de peixe, algas, corais e rochas). Um carregador GLTF ainda não foi integrado; o ponto natural para isso é `AssetManager` + `Vegetation`/`AquaticLife`.

## Desempenho

Medições feitas **apenas** em um contêiner Linux sem GPU, com Chromium headless e renderização por software (SwiftShader). Nesse ambiente o jogo roda a ~1 FPS, o que serve para verificar que tudo funciona, mas **não representa** o desempenho em um PC com placa de vídeo. A meta de ~60 FPS em um PC de referência ainda precisa ser confirmada em hardware real.

Carga medida com `renderer.info` no perfil Alto: no ponto inicial do átrio, cerca de **370 draw calls e 1,06 milhão de triângulos por quadro** (somando a passada de sombras); em pontos mais isolados, como o terraço, cerca de 110 draw calls e 0,35 milhão de triângulos. A cena inteira tem por volta de 600 mil triângulos, e os maiores contribuintes são samambaias, grama e palmeiras. O perfil Econômico desliga as sombras e reduz grama, flores e partículas. Para medir na sua máquina, ative **Configurações → Mostrar FPS e estatísticas**.

## Limitações conhecidas

- Sem natação/mergulho; piscinas e canal são rasos e servem para caminhar.
- Física simplificada: apenas esferas carregáveis; colisões por caixas, cilindros e rampas (paredes curvas aproximadas por segmentos).
- Reflexos da água: o Átrio usa um reflexo local estático; as outras águas refletem só o céu. Refração é simulada.
- Sombras do sol cobrem ~68 × 68 m ao redor do jogador.
- Sem suporte a gamepad nem a dispositivos de toque.
- No Chrome, após sair do mouse capturado com `Esc`, o navegador pode recusar recapturar por cerca de 1 s; o jogo mostra "Clique na tela para capturar o mouse" e basta clicar novamente.
- Desempenho não validado em GPU real (ver acima).

## Validação manual sugerida

1. `npm run dev`, abrir o endereço, aguardar o menu e clicar em **Iniciar exploração**.
2. Andar, correr, pular; tentar atravessar paredes, colunas e guarda-corpos.
3. Usar os dois painéis do átrio; pegar uma esfera (`E`), soltar (`G`) e arremessá-la na piscina (clique).
4. Ir ao norte (Jardins), girar a válvula da comporta e observar canal, nível e correnteza; ligar/desligar as fontes do jardim.
5. Subir uma das rampas até o Terraço e caminhar até a borda da piscina infinita.
6. Voltar ao átrio e seguir para leste até a Galeria; alternar luzes e cortina de bolhas.
7. `Esc` → Configurações: mudar qualidade, FOV, volumes e balanço da câmera; Voltar ao menu inicial e iniciar de novo.

Para testes automatizados no navegador, abra o jogo com `?debug` na URL: o objeto `window.aqua` expõe `play()`, `teleport()`, `look()`, `simulate()`, `interact()` e `state()`.
