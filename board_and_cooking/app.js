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

    const betCycleBtn = document.getElementById('bet-cycle-btn');
    if (betCycleBtn) betCycleBtn.addEventListener('click', cycleBet);

    document.querySelectorAll('.craft-tab[data-chain]').forEach(t => {
      t.addEventListener('click', () => renderCraftChain(t.dataset.chain));
    });

    window.addEventListener('resize', updatePlayerToken);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
