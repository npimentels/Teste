import { Game } from './game.js';

const game = new Game(document.getElementById('view'));
game.start();
window.cantinho = game; // útil para depurar no console
