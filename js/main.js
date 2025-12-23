import { CANVAS_W, CANVAS_H, Game } from './game.js';

const canvas = document.getElementById('game');
const btnRestart = document.getElementById('btnRestart');

let game = null;
let clickResolver = null;

function getCenteredXY(evt) {
  const rect = canvas.getBoundingClientRect();
  const sx = (evt.clientX - rect.left);
  const sy = (evt.clientY - rect.top);
  // Convert to world coords: x centered, y up
  const x = sx - canvas.width/2;
  const y = (canvas.height/2) - sy;
  return {x,y};
}

canvas.addEventListener('click', (evt) => {
  if (!game || game.state.busy) return;
  if (game.state.turn !== 'player') return;
  const pos = getCenteredXY(evt);
  if (clickResolver) {
    const r = clickResolver; clickResolver = null;
    r(pos);
  }
});

btnRestart.addEventListener('click', async ()=>{
  btnRestart.classList.add('hidden');
  await start();
});

async function start() {
  game = new Game(canvas);
  await game.init();
  loop();
}

async function loop() {
  while (!game.state.game_over && game.state.player_hp>0 && game.state.dealer_hp>0) {
    if (game.state.busy) {
      await new Promise(res => setTimeout(res, 50));
      continue;
    }
    if (game.state.turn === 'player') {
      // prepare click promise
      const clickPromise = new Promise(res => clickResolver = res);
      await game.player_turn(clickPromise);
    } else {
      await game.dealer_turn();
    }
  }
  await game.showBanner();
  btnRestart.classList.remove('hidden');
}

start();
