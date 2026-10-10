#!/usr/bin/env bash
# Atalho para macOS (clique duplo) e Linux: instala na primeira vez e abre o jogo.
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js nao foi encontrado. Instale a versao LTS em https://nodejs.org e tente de novo."
  read -r -p "Pressione Enter para fechar..." _
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Primeira vez: instalando as dependencias, aguarde..."
  npm install || { read -r -p "Erro na instalacao. Pressione Enter para fechar..." _; exit 1; }
fi
echo
echo "  AQUA: Dream of Tomorrow"
echo "  O jogo vai abrir no navegador. Se nao abrir: http://localhost:5173"
echo "  Para SAIR: feche esta janela (ou Ctrl+C)."
echo
npm run jogar
