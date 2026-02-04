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
    var btnCloseChainCraft = document.getElementById('btn-close-chain-craft');
    if (btnCloseChainCraft && typeof closeChainCraftModal === 'function') btnCloseChainCraft.addEventListener('click', closeChainCraftModal);
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
    var gmExpInput = document.getElementById('gm-exp');
    var btnGmAddExp = document.getElementById('btn-gm-add-exp');
    if (btnGmAddExp && gmExpInput) {
      btnGmAddExp.addEventListener('click', function() {
        var v = parseInt(gmExpInput.value, 10) || 0;
        if (v > 0) {
          state.chefExp = (state.chefExp || 0) + v;
          if (typeof updateChefUI === 'function') updateChefUI();
          if (typeof showToast === 'function') showToast('已加 ' + v + ' 经验');
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
    var gmItemQty = document.getElementById('gm-item-qty');
    var btnGmAddItem = document.getElementById('btn-gm-add-item');
    if (btnGmAddItem && gmItemSelect && gmItemQty) {
      btnGmAddItem.addEventListener('click', function() {
        var id = gmItemSelect.value;
        var n = parseInt(gmItemQty.value, 10) || 1;
        if (id && n > 0) {
          addInv(id, n);
          if (typeof showToast === 'function') showToast('已添加 ' + (typeof getItemName === 'function' ? getItemName(id) : id) + ' ×' + n);
          if (typeof renderMakingDesk === 'function') renderMakingDesk();
          if (typeof renderTownMap === 'function') renderTownMap();
        }
      });
    }
    var btnGmAddBase = document.getElementById('btn-gm-add-base');
    if (btnGmAddBase && typeof BASE_ITEM_IDS !== 'undefined') {
      btnGmAddBase.addEventListener('click', function() {
        BASE_ITEM_IDS.forEach(function(id) { addInv(id, 5); });
        if (typeof showToast === 'function') showToast('已为每种基础食材 +5');
        if (typeof renderMakingDesk === 'function') renderMakingDesk();
        if (typeof renderTownMap === 'function') renderTownMap();
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
