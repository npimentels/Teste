# Nox City

Um mundo 3D cyberpunk explorável no navegador, inspirado em uma noite chuvosa de neon:
rio com reflexos, pontes iluminadas, trânsito, pedestres e prédios que dá para visitar.

Roda em celular e PC, sem instalação: é só abrir `index.html` num servidor estático.

```bash
cd nox-city
python3 -m http.server 8080
# abra http://localhost:8080
```

## Jogar no celular (link público)

O repositório é público, então dá para publicar de graça pelo GitHub Pages:

1. No GitHub, abra **Settings → Pages**.
2. Em *Build and deployment*, escolha **Deploy from a branch**, a branch `ccr-4e05726e-rd4hig` e a pasta **/ (root)**. Salve.
3. Em 1–2 minutos o jogo fica em **https://npimentels.github.io/Teste/nox-city/**.
4. No celular, abra o link e use **Adicionar à tela de início** (Safari: botão Compartilhar; Chrome: menu ⋮). Ele abre em tela cheia, como um app.

## Controles

| PC | Celular | Ação |
|----|---------|------|
| WASD / setas | joystick (metade esquerda da tela) | andar |
| Mouse (clique para capturar) | arrastar na metade direita | olhar |
| Shift (ou R para alternar) | botão Correr | correr |
| Espaço | botão Pular | pular |
| E | botão de ação (aparece perto de algo) | sentar, comprar, elevador, binóculo, conversar |
| M | ícone de mapa | mapa + viagem rápida |
| V | botão 1ª/3ª | alternar câmera |
| F | ícone de câmera | modo foto |

## O que tem na cidade

- **Terraço Kagemori** (início): beirada para sentar, sofá velho, rádio lo-fi, binóculo, máquina de bebidas, placa neon RONIN.
- **Ponte Neon**: letreiro 夜の街は、眠らない rolando, cabos rosa, elevador para o **Mirante** a 48 m.
- **Hyperion Tower**: lobby de mármore com holograma e parede de LED; elevador até o **Sky Lounge** a 226 m (bar, piano, sofás, deck externo com binóculos e um carro voador estacionado).
- **Club VOLTAGE**: pista de LED que pulsa com a música, lasers, DJ, bar e camarotes. A trilha é gerada ao vivo.
- **Neomart 24**: konbini com prateleiras, geladeiras, balcão quente, caixa eletrônico e atendente androide.
- **Tsuki Ramen** e carrinho de yakitori no calçadão, **Praça Sakura** com cerejeiras que brilham e food truck.
- Trânsito com semáforos sincronizados e travessia diagonal estilo Shibuya, táxis, viaturas, carros voadores, barcos-táxi no rio, pedestres com guarda-chuvas de neon.

## Tecnologia

Three.js r147 (CDN), tudo procedural: geometria, texturas em canvas, shaders (fachadas, chão molhado com reflexo planar,
água, holograma) e áudio (Web Audio). Qualidade gráfica ajustável e resolução dinâmica para manter a fluidez no celular.
