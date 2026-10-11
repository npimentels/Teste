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
| Interagir / pegar objeto / sentar / embarcar | `E` |
| Levantar (quando sentado) | `E` ou `Espaço` |
| Máquina de bebidas: escolher · confirmar · sair | `A`/`D` (ou `W`/`S`, setas, `1`–`6`) · `E` · `Q` |
| Soltar objeto | `G` |
| Arremessar objeto carregado | Clique esquerdo |
| Pausar e liberar o mouse | `Esc` |
| Capturar o mouse | Clique na tela |

O jogo pausa sozinho quando a janela perde o foco ou a aba fica oculta; ao voltar, clique em **Retomar**.

## Novidades da v0.4 — Fase 3: horizonte, Ala Horizonte, hotel e vida ambiental

**O mundo não é infinito**: o mapa explorável continua limitado. O que foi construído é uma **ilusão visual de
continuidade** em camadas:

- **Camada próxima (explorável)**: o complexo original + a nova **Ala Horizonte**, uma ilha ao sul da esplanada,
  ligada por uma passarela.
- **Camada intermediária (≈ 0,4–1,2 km, não acessível)**: cinco distritos sobre plataformas no mar.
  - Os distritos: *Cidade das Águas*, *Distrito Sul*, *Distrito Oeste*, *Jardins do Norte* e *Ilha das Estufas*.
  - Torres de cinco tipos (vidro afunilado com anéis-jardim, terraços-jardim empilhados, lâminas arredondadas,
    agulhas e cúpulas), com altura, largura, rotação e material variados.
  - Passarelas suspensas curvas com jardineiras, lagos, gramados e copas de árvores.
  - Monotrilhos com trens circulando e barcos navegando entre os distritos.
- **Camada distante (≈ 1,6–3,4 km)**: um anel de silhuetas de torres instanciadas que se dissolvem na névoa
  atmosférica, com intervalos de mar aberto.
- **Céu**: bancos de nuvens cúmulos com volume (geometria com topo iluminado, base azulada e brilho de borda),
  sobre o céu procedural existente.
- **Continuidade**: o viaduto da Linha 2 segue depois do Parque Flutuante rumo à Cidade das Águas e some na
  distância. Ele é marcado como extensão "em obras": o trem continua indo só até o Parque.
- **Água**: o oceano foi ampliado e a névoa redistribuída. A borda do mar desaparece na névoa, então não há
  borda visível.

**Ala Horizonte (explorável)**

- **Passarela** com arcos iluminados, bancos, jardineiras e pilares até o mar. Termina num portal com o nome da ala.
- **Salão Maré (salão de descanso)**:
  - Zonas distintas:
    - lounge de sofás em meia-lua;
    - lago interno com fonte e ilhas plantadas;
    - poltronas-ovo junto à janela panorâmica, com luneta;
    - **aquário-coluna de 5 m**, marco visual do salão, rodeado de sofás curvos;
    - **parede-recife de 24 m** com sofás de observação;
    - aquário de nicho com banco;
    - canto de leitura;
    - o **Recanto dos Cavalos-Marinhos**, escondido atrás de jardineiras.
  - Claraboias com trepadeiras, pendentes em gota, luz indireta ciano e quadros digitais gerados.
  - Telhado-jardim sobre o bloco dos toaletes.
- **Toaletes do Salão (banheiro spa)**, feito pela 1ª imagem de referência:
  - Paredes cobalto brilhantes, três espelhos ovais com aro cromado e pendentes em gota.
  - Cubas de vidro largas sobre bancada de acrílico iluminada em ciano, toalhas em prateleiras de acrílico e base
    em pílula verde-limão.
  - Nicho em pílula com frascos de vidro iluminados, janela redonda grande e anel de claraboia.
  - Três cabines com portas de vidro jateado, ganchos, secadores, papel-toalha, lixeiras, ventilação e sinalização.
- **Hotel AQUA**:
  - **Recepção**: balcão curvo, painel luminoso, terminal de check-in, campainha, lobby com sofá e poltronas,
    duas colunas-aquário, diretório e relógio.
  - **Acesso aos quartos**: átrio de pé-direito duplo com escada iluminada e **elevador panorâmico de vidro** de
    três paradas (térreo, 1º andar, cobertura).
  - **Corredor**: numeração e placas por quarto, arandelas, faixas de luz-guia, quadros, dois aquários embutidos
    e banco junto a um deles.
  - **Suíte 101 · Lagoa** (ciano):
    - cama com cabeceira acolchoada voltada para a janela panorâmica, criados-mudos com abajures;
    - armário, espelho oval, poltrona, escrivaninha com cadeira, cortinas, tapete e planta.
  - **Suíte 102 · Coral** (verde-limão):
    - cama redonda com cabeceira curva e **aquário-cabeceira**;
    - sofá junto à janela, penteadeira com espelho oval, estante com livros e cluster de luminárias-bolha.
  - **Suítes 103 e 104**: ocupadas, com placa "não perturbe" e porta trancada (com aviso). Não prometem um
    interior que não existe.
  - **Cobertura (Mirante do Hotel)**: espreguiçadeiras sob pérgola, bancos, palmeiras, duas lunetas e placa.
- **Jardins da ilha**:
  - **Jardim das Águas** (canal com jatos, ilhas e ponte), com o **pavilhão com luneta** a oeste.
  - **Praça da fonte** com bancos ao redor.
  - **Mirante Sul**, na ponta da ilha.

**Novas interações (todas funcionais)**

| Elemento | Ação |
| --- | --- |
| Camas | **Sentar na cama** e **Deitar**. Deitado, a câmera fica no travesseiro olhando para a janela, com olhar limitado para não atravessar colchão nem cabeceira. **E/Espaço** levanta exatamente onde você estava. Espreguiçadeiras da cobertura usam o mesmo sistema |
| Sofás, poltronas, bancos, pufes | Sentar e levantar. São dezenas de assentos novos na ala, mais bancos nos Jardins Hidráulicos, todos no mesmo sistema compartilhado |
| Luminárias | Interruptores e os próprios abajures ligam e desligam grupos de luz com transição suave: lounge, janela, lobby, átrio, corredor, quartos e abajures |
| Portas | Portas dos quartos abrem e fecham, nunca se fecham sobre o jogador e destrancam após o check-in. Portas das cabines idem. Portas automáticas de vidro na ala |
| Cortinas | Abrir e fechar as cortinas das suítes |
| Elevador | Chamar em qualquer andar; **Subir/Descer** no painel interno. A cabine leva o jogador, as portas de pavimento só abrem com a cabine presente e o movimento fica travado durante a viagem |
| Recepção | Check-in no terminal (libera as suítes 101/102) e campainha |
| Aquários | **Observar** abre uma ficha curta sobre as espécies, reais ou fictícias. Peixes nadam sem atravessar o vidro, algas balançam, bolhas sobem |
| Lunetas (4) | Zoom (≈ 14°) e nome do ponto da cidade sob a mira, como "Torre Lume — Distrito Sul · 0,6 km" |
| Banheiro spa | Torneiras com água e som; sabonete, que faz espuma na cuba e é enxaguada pela torneira; secadores, com luz e fluxo de ar; papel-toalha, com a folha saindo; descarga; portas das cabines; espelho e frascos para examinar |
| Painéis, revistas, estantes, armários, guias | Examinar, com ficha no HUD |

**Pontos de interesse opcionais**:

- Recanto dos Cavalos-Marinhos.
- Mirante do Hotel (pelo elevador).
- Pavilhão-luneta do Jardim das Águas.
- Mirante Sul.
- Telhado-jardim dos toaletes, visto do salão.

## Novidades da v0.3 — Fase 2: Aqua Metro, Mercado e ambientes interativos

- **Aqua Metro — Linha 2 (funcional, ida e volta)**: estação **AQUA Central** na borda leste do platô (entradas pela
  esplanada ao sul e por uma passarela sobre o canal a oeste) e terminal **Parque Flutuante**, uma ilha-jardim a
  ~380 m, ligadas por viaduto sobre o mar.
  - Estação: cobertura branca com claraboias redondas e trepadeiras, colunas-árvore, paredes de vidro, faixa
    cobalto com luzes sobre a plataforma, piso com ondas, piso tátil, portas de plataforma de vidro (com a cruz
    verde-limão da referência), canal interno com ilhas plantadas, vitórias-régias e barquinhos, assentos-ovo,
    bancos, mezanino com escada e lounge, placas suspensas bilíngues, painéis de partidas, relógio e mapa da rede.
  - Trem de 3 carros com interior (bancos, barras, luzes, telas "Próxima estação"), portas que abrem do lado da
    plataforma, faróis e cabines arredondadas.
  - Ciclo de serviço com máquina de estados (`TrainService`): embarque com contagem no painel → aviso e sinal
    sonoro → fechamento das portas (trem e plataforma sincronizados) → partida, aceleração, frenagem e parada
    exata → abertura → embarque. O trem **nunca anda com portas abertas** e **nunca fecha sobre o jogador**: se ele
    estiver no vão, as portas seguram (até 2 vezes) e depois o jogo o conduz suavemente para dentro do trem.
  - **E — Entrar no trem / Sair do trem** em cada porta (apenas com o trem parado e portas abertas). Dentro do
    trem dá para andar e **sentar**; o jogador é levado junto durante a viagem, inclusive sentado.
  - Som: ruído de rolamento e motor de tração que acompanham a velocidade, portas, sinal de três notas e anúncios
    curtos em português (síntese de voz do navegador, volume baixo, sem repetição; se o navegador não tiver voz,
    toca só o sinal).
  - Sinalização honesta: só existem **duas estações**; o mapa e os painéis marcam "Cidade das Águas" e as outras
    paradas como **em breve / extensão planejada**. A "Cidade das Águas" no horizonte é cenário.
- **Mercado Aqua** (gramado sudeste, entrada pela esplanada do Átrio): fachada de vidro com letreiro e marquise,
  portas automáticas, corredor central de geladeiras de vidro sobre bases cobalto com tampo verde-limão, teto com
  "nuvens" cobalto e luzes embutidas, vasos de vidro suspensos com trepadeiras, janela em arco ao fundo, piso azul
  refletivo com ondas, gôndolas e prateleiras de parede com etiquetas de preço, ilhas de hortifruti, caixa com tela,
  cestas e pufes junto à janela. Produtos são embalagens fictícias variadas (garrafas, garrafões, latas, caixinhas,
  potes, caixas de cereal, copos de iogurte, frutas) com rótulos de marcas inventadas — milhares de itens em poucos
  draw calls (instancing).
  - Interações: abrir/fechar cada geladeira (fecha sozinha depois de alguns segundos), **examinar produtos** (ficha no
    HUD), examinar prateleiras e frutas, passar no caixa, carregar cestas. Sem sistema de dinheiro: tudo é cortesia.
- **Sistema único de sentar/levantar** (`Seats.ts`): "E — Sentar" em bancos, sofá e poltronas do Átrio, bancos da
  Galeria, espreguiçadeiras e pavilhão do Terraço, assentos da estação, do parque, do trem e pufes do mercado. A
  câmera vai suavemente até o assento, o olhar fica limitado a um arco confortável e, ao levantar, o jogador volta
  exatamente para onde estava.
- **Máquinas de bebidas anos 2000** (estação, parque e porta do mercado): menu no LCD da máquina e no HUD, teclado
  que acende, motor da espiral, a bebida anda, cai, a portinhola balança, som de entrega e conclusão. A bebida fica
  na bandeja — "E — Retirar" — e pode ser carregada, solta e arremessada.
- **Banheiro da estação** (sob o mezanino): paredes cobalto brilhantes com rodapé de mosaico, espelhos em forma de
  pílula, bancada de acrílico ciano iluminada com cubas de vidro, torneiras cromadas, saboneteiras, secador de mãos,
  lixeiras, nicho com frascos, janela-escotilha de vidro jateado, luminárias-gota, três cabines com portas de vidro
  jateado e vasos suspensos, porta automática. Interações: torneiras (água corrente + som, desligam sozinhas),
  sabonete, secador, portas das cabines (não fecham sobre o jogador) e descarga.
  - Espelhos: reflexo em tempo real (`Reflector`) **somente** com o jogador dentro do banheiro e qualidade Alta; ele
    renderiza só a zona da estação. Fora disso, um metal polido com reflexo do ambiente.
- **Desempenho**: estação+trem+parque e mercado ficam em grupos próprios e são ignorados quando a câmera está
  dentro do Átrio fechado (de onde não são visíveis); a transmissão física do vidro do Átrio só é ativada perto dele
  (ela obriga o three.js a renderizar a cena opaca duas vezes sempre que está no enquadramento, mesmo a 400 m).

### Fidelidade às imagens de referência

As quatro referências (banheiro, corredor de mercado, visão geral da estação, plataforma com trem) foram seguidas
em **elementos, formas, paleta e materiais**: cobalto/branco/ciano/verde-limão, cromo e vidro, colunas-árvore,
claraboias com trepadeiras, faixa cobalto do teto, portas de plataforma com a cruz verde, placas azuis bilíngues,
espelhos-pílula, cubas de vidro, bases cobalto com tampo limão, "nuvens" cobalto, janela em arco. Por ser geometria
procedural em tempo real (sem modelos, texturas fotográficas nem iluminação global), o resultado **não é idêntico
pixel a pixel** às imagens: superfícies são mais simples, a iluminação é direta + ambiente, e não há o acabamento
de uma renderização offline.

## Novidades da v0.2 — identidade visual

- **Sistema visual documentado** em [`docs/SISTEMA_VISUAL.md`](docs/SISTEMA_VISUAL.md): paleta com regras de contraste, materiais, componentes arquitetônicos, mobiliário, sinalização, iluminação por ambiente e orçamento de desempenho.
- **Átrio Azul reformado**: piso de terrazzo com incrustações e halo de mosaico, pedra molhada ao redor da piscina, paredes caneladas com rodapé de mosaico cobalto e sanca de luz, colunas-lótus com faixa cobalto, portais cobalto com sinalização integrada, nervuras orgânicas no teto, piscina em mosaico cobalto com vitórias-régias, pedestal da fonte torneado, lounge com sofá curvo, poltronas-ovo, mesa de vidro e tapete, balcão de recepção com monitor, totens com mapa do complexo, bebedouro, lixeiras de reciclagem, luminárias-bolha, novas plantas (bananeira ornamental, espada-de-são-jorge, trepadeiras pendentes) e variação de cor entre plantas.
- **Água**: o espelho d'água do Átrio reflete o próprio salão (reflexo local "assado" no carregamento, com correção de paralaxe), bordas com menisco e espuma, ondulações contínuas onde os jatos caem (somem quando a fonte desliga).
- **Iluminação por ambiente**: luz de céu, reflexo ambiente, sol e exposição mudam suavemente entre salões, aquário, jardins e terraço.
- **Interface** na nova linguagem (cobalto, ciano, toque limão) e placas no novo padrão.

## O que existe no mundo

O complexo ocupa um platô de aproximadamente 100 × 115 m sobre o mar, com todos os ambientes ligados por caminhos que se percorrem a pé (sem teletransporte).

| Zona | Conteúdo | Interações |
| --- | --- | --- |
| **Átrio Azul** (início) | Salão circular branco com óculo de vidro para o céu, piscina rasa com fonte (jato central + 8 arcos), esfera de vidro flutuante, colunas com luzes de destaque, canteiros tropicais, parede-cortina de vidro, bancos | Painel **Fonte do Átrio** (liga/desliga jatos, arcos, respingos e som); painel **Luzes do Átrio** (luzes pontuais, faixas emissivas, cones de luz, cáusticas); 3 esferas carregáveis |
| **Jardins Hidráulicos** (norte) | Canal de 50 m com duas pontes, reservatório elevado com comporta, tubulação de vidro com fluxo visível, duas piscinas quadradas com esculturas e jatos, piscina redonda com fonte de dois níveis, pérgula de arcos, postes, palmeiras, samambaias, flores e grama | Válvula da **Comporta do Canal** (a comporta sobe, uma cortina de água cai no canal, a correnteza aparece, o nível do canal sobe e o do reservatório desce — objetos flutuantes são levados pela corrente); painel **Fontes do Jardim** (3 fontes, bicas e o fluxo dentro da tubulação); 3 esferas |
| **Galeria Aquática** (leste) | Corredor envidraçado entre dois tanques com peixes, algas, corais, rochas, bolhas e feixes de luz; salão redondo com aquário-coluna do piso ao teto e janela panorâmica; saída para a esplanada | Painel **Luzes da Galeria** (luzes turquesa, cáusticas no piso, iluminação dentro dos tanques); painel **Cortina de Bolhas** |
| **Aqua Metro — AQUA Central** (leste) | Estação com plataforma, portas de plataforma, canal interno com ponte, mezanino com escada, banheiro, máquinas de bebidas, painéis de partidas, relógio, mapa da rede | Embarcar/desembarcar, sentar, máquinas de bebidas, banheiro completo (torneiras, sabonete, secador, cabines, descarga) |
| **Parque Flutuante** (ilha, via metrô) | Terminal com cobertura e óculo, lago com ilhas plantadas, palmeiras, bancos e mirante para o complexo | Embarcar de volta, sentar, máquina de bebidas |
| **Ala Horizonte** (ilha ao sul, pela passarela) | Salão Maré, toaletes spa, Hotel AQUA (lobby, átrio, elevador, corredor, suítes 101/102, cobertura), Jardim das Águas, praça da fonte, Mirante Sul | Sentar/deitar, luminárias, portas, cortinas, elevador, check-in, aquários, lunetas, banheiro completo |
| **Mercado Aqua** (sudeste) | Mercado com geladeiras de vidro, gôndolas, hortifruti, caixa, lounge na janela em arco | Geladeiras, examinar produtos, caixa, cestas carregáveis, pufes, máquina de bebidas na entrada |
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
    AquaMetro.ts           estações, viaduto, ilha, sincronização trem/portas/painéis/sons/passageiro
    MetroTrain.ts          trem (casca, interior, portas, colisores que se movem com ele)
    MetroSignage.ts        placas, painel de partidas, relógio, mapa da rede, texturas de piso
    Restroom.ts            banheiro da estação e suas interações
    Market.ts, Products.ts Mercado Aqua; embalagens fictícias instanciadas com atlas de rótulos
    AlaHorizonte.ts        ilha, passarela, jardins, mirantes; interiores com exibição por distância
    Lounge.ts, Hotel.ts    Salão Maré e Hotel AQUA (casca externa + interiores)
    SpaRestroom.ts         toaletes do salão (referência 1)
    Horizon.ts             distritos, anel distante, nuvens cúmulos, viaduto, monotrilhos, barcos, marcos
    Interiors.ts           mobiliário de interiores (camas, poltronas, sofás, armários, quadros…)
    Lamps.ts               luminárias + grupos de luz comutáveis (emissivos + "poças" de luz, sem luzes dinâmicas)
    Aquarium.ts            aquários reutilizáveis (caixa/cilindro) com vida animada só de perto
    BathroomKit.ts         peças de banheiro interativas e parede de espelhos
    Doors.ts               portas de abrir/correr, cortinas, "examinar"
    ArchKit.ts, Furniture.ts, Palette.ts  componentes do sistema visual (colunas, escadas, bancos…)
  systems/
    Interactables.ts       contrato `Interactable`, painel de controle com tela viva, `UseSpot` genérico
    Seats.ts               sistema único de sentar/levantar (assentos fixos ou em objetos móveis)
    TrainService.ts        máquina de estados do serviço do metrô (lógica pura, testada)
    VendingMachine.ts      máquina de bebidas (interação modal em 8 etapas)
    Elevator.ts            elevador com colisores que se movem, portas de pavimento e transporte do jogador
    Telescope.ts           luneta (zoom + nomes dos marcos)
    ObjectPhysics.ts       esferas carregáveis: gravidade, quique, flutuação, correnteza, empurrões
    AudioManager.ts        áudio procedural (Web Audio API), espacial, por categorias
    PerformanceManager.ts  medição de FPS, sobreposição de estatísticas, perfis gráficos
  ui/                      menu inicial, HUD, pausa, configurações, créditos (DOM + CSS)
  styles/main.css          interface Frutiger Aero (painéis translúcidos, botões glossy)
tests/                     testes Vitest: colisão, movimentação, serviço do trem, assentos
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

Carga medida na v0.4 com `aqua.measure()` (um quadro completo, somando sombras, transmissão e espelho):

| Ponto de vista | Alto: draw calls / triângulos | Econômico: draw calls / triângulos |
| --- | --- | --- |
| Início (Átrio) | 622 / 2,08 M | 315 / 0,85 M |
| Jardins Hidráulicos | 286 / 1,44 M | 221 / 0,84 M |
| Terraço (olhando o horizonte) | 207 / 1,35 M | 142 / 0,77 M |
| Plataforma AQUA Central | 284 / 1,41 M | 219 / 0,84 M |
| Parque Flutuante (olhando o complexo) | 872 / 2,10 M | 731 / 1,45 M |
| Mercado Aqua | 572 / 2,27 M | 499 / 1,63 M |
| Passarela da Ala Horizonte | 468 / 1,54 M | 395 / 0,89 M |
| Salão Maré (lounge) | 432 / 1,59 M | 359 / 0,94 M |
| Salão Maré (aquários) | 680 / 2,08 M | 603 / 1,44 M |
| Toaletes spa (espelho em tempo real no Alto) | 1253 / 3,29 M | 907 / 2,25 M |
| Lobby do Hotel AQUA | 358 / 1,46 M | 285 / 0,82 M |
| Suíte 101 | 298 / 1,41 M | 225 / 0,77 M |
| Cobertura do hotel | 258 / 1,34 M | 185 / 0,71 M |
| Mirante Sul | 160 / 1,14 M | 87 / 0,51 M |

Otimizações da Fase 3:

- O horizonte inteiro (cinco distritos, anel distante, nuvens, viaduto) custa cerca de 30 draw calls. Ele não
  projeta sombras, cada distrito é um lote separado (o recorte por enquadramento funciona) e o anel distante é
  instanciado.
- Os interiores do salão e do hotel só são desenhados num raio de 55–62 m.
- A vida dos aquários (peixes, algas, bolhas, superfície) só existe e só é animada de perto.
- Peças pequenas e animadas das zonas grandes (portas, placas, máquinas) somem além de 45–90 m; o trem, além de
  ~400 m. A arquitetura agrupada nunca some.
- A transmissão física do vidro do Átrio só fica ativa perto dele, porque ela renderiza a cena opaca duas vezes.
- Espelhos em tempo real: um por cômodo, só com o jogador dentro e na qualidade Alta, e renderizando apenas a
  própria zona.
- Luminárias sem luzes dinâmicas: um material emissivo por grupo comutável, mais "poças" de luz.

Os casos mais pesados são o banheiro spa no Alto (a passada extra do espelho) e as vistas longas que enxergam o
complexo inteiro. Lembrete: essas medições vêm de renderização por software. O FPS real precisa ser medido numa
placa de vídeo: ative **Configurações → Mostrar FPS e estatísticas**.

## Limitações conhecidas

- Sem natação/mergulho; piscinas e canal são rasos e servem para caminhar.
- Física simplificada: apenas esferas carregáveis; colisões por caixas, cilindros e rampas (paredes curvas aproximadas por segmentos).
- Reflexos da água: o Átrio usa um reflexo local estático; as outras águas refletem só o céu. Refração é simulada.
- Metrô: uma linha com duas estações; o trem anda em linha reta (sem curvas). Os anúncios usam a voz do sistema
  operacional, que varia entre navegadores. "Cidade das Águas" e as demais paradas do mapa são planejadas.
- Mercado: produtos são decorativos (não dá para pegar cada item); só as cestas e as bebidas das máquinas são
  carregáveis. As portas das geladeiras não têm colisão quando abertas.
- Espelhos: o reflexo em tempo real mostra só a zona onde o espelho está (o resto do mundo é omitido nessa
  passada) e só é calculado com o jogador dentro do cômodo, na qualidade Alta.
- Horizonte: distritos, anel distante e nuvens são cenário; não são navegáveis. As nuvens são geometria opaca
  sombreada (sem volume real nem transparência), e as silhuetas distantes repetem três formas com escala e
  rotação variadas.
- Hotel: as suítes 103 e 104 não têm interior (estão sinalizadas como ocupadas). Não há banheiro dentro das
  suítes; os toaletes ficam no Salão Maré.
- Luminárias: acender/apagar muda as partes emissivas e as "poças" de luz pintadas nas superfícies; não há luz
  dinâmica por luminária, então objetos não ganham sombra própria dessas lâmpadas.
- Deitar: a câmera vai ao travesseiro e o corpo do personagem fica onde estava (não existe um modelo de
  personagem visível).
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
8. Seguir as placas "Aqua Metro" (leste). Esperar o trem na plataforma (painel mostra a contagem), apontar para uma
   porta e usar **E — Entrar no trem**, sentar num banco, viajar até o Parque Flutuante e sair com **E**.
9. No parque: usar a máquina de bebidas (escolher com `A`/`D`, confirmar com `E`), retirar a bebida, sentar no
   mirante; voltar de trem.
10. Na estação: subir a escada ao mezanino; entrar no banheiro e testar torneira, sabonete, secador, cabines e descarga.
11. Ir ao Mercado Aqua (sudeste do Átrio): abrir geladeiras, examinar produtos, passar no caixa, carregar uma cesta.
12. Saindo do Átrio pela Esplanada (sul), atravessar a passarela até a Ala Horizonte. No Salão Maré: sentar diante
    da coluna-aquário, observar a parede-recife, usar a luneta da janela, achar o recanto dos cavalos-marinhos e
    testar os toaletes (torneira, sabonete, secador, papel, cabines, descarga).
13. Pela passarela de vidro ao sul, entrar no Hotel AQUA: fazer check-in no terminal, chamar o elevador, subir ao
    1º andar, abrir a suíte 101, deitar na cama (olhar a janela), acender/apagar abajures, fechar as cortinas;
    visitar a 102; tentar a 103 (ocupada); subir à cobertura e usar as lunetas.
14. Olhar o horizonte de vários pontos (Terraço, plataforma do metrô, Mirante Sul, cobertura): cidade, ilhas,
    nuvens, monotrilhos, barcos.

Para testes automatizados no navegador, abra o jogo com `?debug` na URL: o objeto `window.aqua` expõe `play()`,
`teleport()`, `look()`, `aimAt(x, y, z)`, `probe()`, `simulate()`, `interact()`, `press(tecla)`,
`stepWorld(segundos)`, `train()`, `measure()` e `state()`.
