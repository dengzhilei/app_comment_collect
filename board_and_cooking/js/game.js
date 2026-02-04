/**
 * Board & Cooking - 入口编排与标签切换（依赖 config, state, items, board, orders, craft, modals）
 */
(function(global) {

  function switchTab(tabId) {
    document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
    var panel = document.getElementById('panel-' + tabId);
    var tab = document.querySelector('.tab[data-tab="' + tabId + '"]');
    if (panel) panel.classList.add('active');
    if (tab) tab.classList.add('active');

    if (tabId === 'board') {
      setTimeout(function() {
        if (typeof updatePlayerToken === 'function') updatePlayerToken();
        if (typeof updateBoardCamera === 'function') updateBoardCamera();
      }, 50);
      updateBetUI();
      updateBoardGainUI();
      updateDiceResultUI();
    }
    if (tabId === 'orders') renderTownMap();
    if (tabId === 'craft') renderCraftChain(state.currentChain);
  }

  function initGame() {
    initBoard();
    updateDiceUI();
    updateBetUI();
    updateBoardGainUI();
    updateDiceResultUI();
    if (typeof updateChefUI === 'function') updateChefUI();
  }

  global.switchTab = switchTab;
  global.initGame = initGame;
})(typeof window !== 'undefined' ? window : this);
