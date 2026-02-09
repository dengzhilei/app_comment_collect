/**
 * Board & Cooking - 入口与事件绑定（依赖 config.js, game.js）
 */
(function() {
  function init() {
    initGame();

    document.querySelectorAll('.tab[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    document.getElementById('btn-roll').addEventListener('click', rollDice);
    document.getElementById('btn-inventory').addEventListener('click', openInventory);
    document.getElementById('btn-close-inventory').addEventListener('click', closeInventory);
    document.getElementById('btn-close-recipe-detail').addEventListener('click', closeRecipeDetail);
    document.getElementById('btn-gm-dice').addEventListener('click', gmAddDice);
    var gmNextInput = document.getElementById('gm-next-roll');
    var gmSetRollBtn = document.getElementById('btn-gm-set-roll');
    if (gmSetRollBtn && gmNextInput) {
      gmSetRollBtn.addEventListener('click', function() {
        var v = parseInt(gmNextInput.value, 10);
        if (v >= 2 && v <= 12) {
          state.gmNextRollSteps = v;
          if (typeof showToast === 'function') showToast('下次掷骰点数已设为 ' + v);
        }
      });
    }

    const betCycleBtn = document.getElementById('bet-cycle-btn');
    if (betCycleBtn) betCycleBtn.addEventListener('click', cycleBet);

    document.querySelectorAll('.craft-tab[data-chain]').forEach(t => {
      t.addEventListener('click', () => renderCraftChain(t.dataset.chain));
    });

    window.addEventListener('resize', function() {
      if (typeof updatePlayerToken === 'function') updatePlayerToken();
      if (typeof updateBoardCamera === 'function') updateBoardCamera();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
