/**
 * Board & Merge - tab switch and init
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
    if (tabId === 'merge') {
      if (typeof renderTownMap === 'function') renderTownMap();
      if (typeof renderMergeGrid === 'function') renderMergeGrid();
      if (typeof renderGenerators === 'function') renderGenerators();
      if (typeof updateEnergyUI === 'function') updateEnergyUI();
    }
  }

  function initGame() {
    initBoard();
    updateDiceUI();
    updateBetUI();
    updateBoardGainUI();
    updateDiceResultUI();
    if (typeof updateEnergyUI === 'function') updateEnergyUI();
    if (typeof updateChefUI === 'function') updateChefUI();
    if (typeof renderGenerators === 'function') renderGenerators();
    if (typeof renderMergeGrid === 'function') renderMergeGrid();
    if (typeof renderTownMap === 'function') renderTownMap();
  }

  function updateChefUI() {
    var el = document.getElementById('chef-level-num');
    if (el) el.textContent = 'Lv.' + (state.chefLevel || 1);
  }

  global.switchTab = switchTab;
  global.initGame = initGame;
  global.updateChefUI = updateChefUI;
})(typeof window !== 'undefined' ? window : this);
