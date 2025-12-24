/* Bootstrapping: preload assets, init game, run loop, and replay dialog */

(async function main() {
  const allAssetPaths = Object.values(ASSETS);
  // Also load fire effects if you have them (assets/Fire12.bmp, assets/Fire42.bmp or Fire1_2.bmp/Fire4_2.bmp)
  // Add both possible names to be safe; loader will skip missing ones only if server returns 404 (throws).
  // Prefer the names used in code: Fire1 2.bmp => "assets/Fire12.bmp" or "assets/Fire1_2.bmp"
  // This example assumes "assets/Fire12.bmp" and "assets/Fire42.bmp" exist; adjust if needed.
  const firePaths = ["assets/Fire12.bmp", "assets/Fire42.bmp", "assets/Fire1_2.bmp", "assets/Fire4_2.bmp"];
  const preloadList = allAssetPaths.concat(firePaths);

  try {
    await BMP.preloadBMPS(preloadList);
  } catch(e) {
    // Ignore any missing fires; required assets must exist though
    console.warn("Some assets failed to preload:", e.message);
  }

  while (true) {
    Game.init_game(false);
    await Game.start_new_round();

    const winner = await Game.run_game();
    console.log((winner === 'player' ? "You" : "Dealer") + " win!");

    const again = await askPlayAgain();
    if (!again) break;
    // clear stage by resetting canvas (renderer persists)
    STATE.stage.children = [];
  }

  function askPlayAgain() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = 0;
      overlay.style.top = 0;
      overlay.style.right = 0;
      overlay.style.bottom = 0;
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(0,0,0,0.5)';
      overlay.style.zIndex = 9999;

      const box = document.createElement('div');
      box.style.background = '#223';
      box.style.color = '#fff';
      box.style.padding = '16px 20px';
      box.style.border = '2px solid #99b';
      box.style.fontFamily = 'monospace';
      box.style.borderRadius = '8px';
      box.style.textAlign = 'center';
      box.innerHTML = `
        <div style="margin-bottom:10px;">Play Again? (Y/N)</div>
        <div>
          <button id="yesBtn" style="margin-right:8px;">Y</button>
          <button id="noBtn">N</button>
        </div>
      `;
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      const cleanup = (ans) => {
        document.body.removeChild(overlay);
        resolve(ans);
      };
      box.querySelector('#yesBtn').addEventListener('click', () => cleanup(true));
      box.querySelector('#noBtn').addEventListener('click', () => cleanup(false));
      window.addEventListener('keydown', (e) => {
        if (e.key.toLowerCase() === 'y') cleanup(true);
        if (e.key.toLowerCase() === 'n') cleanup(false);
      }, { once: true });
    });
  }
})();
