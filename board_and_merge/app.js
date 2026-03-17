/**
 * Board & Merge - event bindings
 */
(function() {
  function init() {
    initGame();

    document.querySelectorAll('.tab[data-tab]').forEach(function(tab) {
      tab.addEventListener('click', function() { switchTab(tab.dataset.tab); });
    });

    document.getElementById('btn-roll').addEventListener('click', rollDice);

    var betCycleBtn = document.getElementById('bet-cycle-btn');
    if (betCycleBtn) betCycleBtn.addEventListener('click', cycleBet);

    document.getElementById('btn-gm-dice').addEventListener('click', gmAddDice);

    var btnGmUnstick = document.getElementById('btn-gm-unstick');
    if (btnGmUnstick) {
      btnGmUnstick.addEventListener('click', function() {
        state.moving = false;
        if (typeof updateRollButton === 'function') updateRollButton();
        if (typeof showToast === 'function') showToast('Roll unstick');
      });
    }

    var gmNextInput = document.getElementById('gm-next-roll');
    var gmSetRollBtn = document.getElementById('btn-gm-set-roll');
    if (gmSetRollBtn && gmNextInput) {
      gmSetRollBtn.addEventListener('click', function() {
        var v = parseInt(gmNextInput.value, 10);
        if (v >= 2 && v <= 12) {
          state.gmNextRollSteps = v;
          if (typeof showToast === 'function') showToast('Next roll set to ' + v);
        }
      });
    }

    var btnGmEnergy = document.getElementById('btn-gm-energy');
    if (btnGmEnergy) {
      btnGmEnergy.addEventListener('click', function() {
        state.energy = (state.energy || 0) + 50;
        if (typeof updateEnergyUI === 'function') updateEnergyUI();
        if (typeof showToast === 'function') showToast('+50 Energy');
      });
    }

    var gmExpInput = document.getElementById('gm-exp');
    var btnGmAddExp = document.getElementById('btn-gm-add-exp');
    if (btnGmAddExp && gmExpInput) {
      btnGmAddExp.addEventListener('click', function() {
        var v = parseInt(gmExpInput.value, 10) || 0;
        if (v > 0) {
          state.chefExp = (state.chefExp || 0) + v;
          if (typeof updateChefUI === 'function') updateChefUI();
          if (typeof showToast === 'function') showToast('+' + v + ' Exp');
        }
      });
    }

    var gmItemSelect = document.getElementById('gm-item-select');
    if (gmItemSelect && typeof getAllItemIds === 'function' && typeof getItemName === 'function') {
      var allIds = getAllItemIds();
      allIds.forEach(function(id) {
        var opt = document.createElement('option');
        opt.value = id;
        opt.textContent = getItemName(id);
        gmItemSelect.appendChild(opt);
      });
    }

    var btnGmAddItem = document.getElementById('btn-gm-add-item');
    if (btnGmAddItem && gmItemSelect) {
      btnGmAddItem.addEventListener('click', function() {
        var id = gmItemSelect.value;
        if (!id) return;
        var grid = state.mergeGrid || [];
        var idx = -1;
        for (var i = 0; i < grid.length; i++) {
          if (!grid[i]) { idx = i; break; }
        }
        if (idx < 0) {
          if (typeof showToast === 'function') showToast('Grid full');
          return;
        }
        state.mergeGrid[idx] = { id: id };
        if (typeof renderMergeGrid === 'function') renderMergeGrid();
        if (typeof renderTownMap === 'function') renderTownMap();
        if (typeof showToast === 'function') showToast('Added ' + getItemName(id));
      });
    }

    var btnCloseChain = document.getElementById('btn-close-chain');
    if (btnCloseChain && typeof closeChainModal === 'function') {
      btnCloseChain.addEventListener('click', closeChainModal);
    }

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
