/**
 * Board & Cooking - 制作模块（依赖 config.js, state.js, items.js, board.js）
 * 区域 A：链内合成；区域 B：筛选栏 + 4 列菜品网格 + 详情弹窗内制作
 */
(function(global) {
  var _craftDetailBound = false;
  var _craftFilterBound = false;
  var _currentDetailRecipe = null;

  function getRecipeFromItemId(itemId) {
    var recipe = CHAIN_RECIPES[itemId];
    if (recipe) return getItemInfo(recipe.from).name;
    return '';
  }

  /** v6：根据配置 CRAFT_BATCH_OPTIONS 计算要显示的批量档位 [1] 或 [1, size]（取材料足够且等级已解锁的最大档） */
  function getBatchCountsToShow(chefLevel, maxCount) {
    var options = (typeof CRAFT_BATCH_OPTIONS !== 'undefined' && Array.isArray(CRAFT_BATCH_OPTIONS))
      ? CRAFT_BATCH_OPTIONS.slice()
      : [{ size: 3, unlockChefLevel: 2 }, { size: 5, unlockChefLevel: 3 }];
    options.sort(function(a, b) { return (b.size || 0) - (a.size || 0); });
    for (var i = 0; i < options.length; i++) {
      var opt = options[i];
      var size = opt.size != null ? opt.size : 0;
      var needLv = opt.unlockChefLevel != null ? opt.unlockChefLevel : 1;
      if (size >= 2 && chefLevel >= needLv && maxCount >= size) return [1, size];
    }
    return [1];
  }

  function getFilteredRecipes() {
    var category = (state.craftFilterCategory != null) ? state.craftFilterCategory : 'all';
    return (CROSS_RECIPES || []).filter(function(rec) {
      if (category !== 'all' && (rec.category || 'main') !== category) return false;
      return true;
    });
  }

  function fillCraftContainers(chainKey, chainContainer, afterCraft) {
    var chain = CHAINS[chainKey];
    if (!chain || !chainContainer) return;
    var maxLevel = getMaxChainLevel(chainKey);
    chainContainer.innerHTML = '';
    chain.forEach(function(item, level) {
      var itemLevel = level + 1;
      if (itemLevel > maxLevel) return;
      var levelDiv = document.createElement('div');
      levelDiv.className = 'craft-level';
      levelDiv.innerHTML = '<span class="label">Lv' + itemLevel + '</span>';
      var count = getInv(item.id);
      var span = document.createElement('span');
      span.className = 'craft-item';
      span.innerHTML = item.emoji + ' ' + item.name + ' <span class="count">×' + count + '</span>';
      levelDiv.appendChild(span);
      var recipe = CHAIN_RECIPES[item.id];
      if (recipe) {
        var have = getInv(recipe.from);
        var maxCount = Math.floor(have / recipe.count);
        var chefLevel = state.chefLevel || 1;
        var fromName = getRecipeFromItemId(item.id) || recipe.from;
        var counts = getBatchCountsToShow(chefLevel, maxCount);
        var btnWrap = document.createElement('div');
        btnWrap.className = 'craft-chain-buttons';
        counts.forEach(function(c) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn-craft';
          btn.textContent = (c === 1 && counts.length === 1)
            ? ('合成(需' + recipe.count + fromName + ')')
            : (c === 1 ? '合成×1' : '合成×' + c);
          btn.disabled = maxCount < c;
          var tid = item.id;
          btn.onclick = function() {
            doChainCraft(tid, c);
            if (afterCraft) afterCraft();
          };
          btnWrap.appendChild(btn);
        });
        levelDiv.appendChild(btnWrap);
      }
      chainContainer.appendChild(levelDiv);
    });
  }

  function renderCraftGrid() {
    var grid = document.getElementById('craft-grid');
    if (!grid) return;
    var list = getFilteredRecipes();
    grid.innerHTML = '';
    list.forEach(function(rec) {
      var unlocked = isCrossRecipeUnlocked(rec);
      var canCraft = rec.needs.every(function(n) { return getInv(n.id) >= n.n; });
      var card = document.createElement('div');
      card.className = 'craft-card';
      if (!unlocked) card.classList.add('craft-card-locked');
      else if (canCraft) card.classList.add('craft-card-makeable');
      else card.classList.add('craft-card-short');
      var lv = rec.unlockChefLevel != null ? rec.unlockChefLevel : 1;
      var statusText = unlocked ? (canCraft ? '🟢可制作' : '🔴缺料') : '🔒未解锁';
      var icon = unlocked ? rec.emoji : '?';
      var name = unlocked ? rec.name : '???';
      card.innerHTML =
        '<span class="craft-card-lv">Lv.' + lv + '</span>' +
        '<span class="craft-card-status">' + statusText + '</span>' +
        '<span class="craft-card-icon">' + icon + '</span>' +
        '<span class="craft-card-name">' + name + '</span>';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      (function(r) {
        card.addEventListener('click', function() { openCraftDetail(r); });
      })(rec);
      grid.appendChild(card);
    });
  }

  function openCraftDetail(rec) {
    _currentDetailRecipe = rec;
    var modal = document.getElementById('modal-craft-detail');
    var titleEl = modal && modal.querySelector('.craft-detail-title');
    var formulaEl = document.getElementById('craft-detail-formula');
    var buttonsEl = document.getElementById('craft-detail-buttons');
    if (!modal || !titleEl || !formulaEl || !buttonsEl) return;
    var unlocked = isCrossRecipeUnlocked(rec);
    var displayEmoji = unlocked ? rec.emoji : '?';
    var displayName = unlocked ? rec.name : '???';
    titleEl.innerHTML = '<span>' + displayEmoji + '</span><span>' + displayName + '</span>';
    formulaEl.innerHTML = '';
    buttonsEl.innerHTML = '';
    if (!unlocked) {
      var needLv = rec.unlockChefLevel != null ? rec.unlockChefLevel : 1;
      formulaEl.innerHTML = '<p class="formula-row missing">未解锁，需厨师等级 Lv.' + needLv + '</p>';
      var btnDisabled = document.createElement('button');
      btnDisabled.type = 'button';
      btnDisabled.className = 'btn-craft-make';
      btnDisabled.disabled = true;
      btnDisabled.textContent = '未解锁';
      buttonsEl.appendChild(btnDisabled);
    } else {
      var canCraft = true;
      var missingNames = [];
      rec.needs.forEach(function(n) {
        var have = getInv(n.id);
        var ok = have >= n.n;
        if (!ok) canCraft = false;
        var row = document.createElement('div');
        row.className = 'formula-row' + (ok ? '' : ' missing');
        var info = getItemInfo(n.id);
        row.innerHTML = '<span>' + info.emoji + ' ' + info.name + ' (' + have + '/' + n.n + ')</span><span class="' + (ok ? 'formula-ok' : '') + '">' + (ok ? '✅' : '❌') + '</span>';
        if (!ok && typeof openRecipeDetail === 'function') {
          var detailBtn = document.createElement('button');
          detailBtn.type = 'button';
          detailBtn.className = 'btn-detail-inline craft-detail-detail-btn';
          detailBtn.textContent = '详情';
          detailBtn.onclick = (function(id) {
            return function() {
              if (typeof closeCraftDetail === 'function') closeCraftDetail();
              openRecipeDetail(id);
            };
          })(n.id);
          row.appendChild(detailBtn);
        }
        formulaEl.appendChild(row);
      });
      var chefLevel = state.chefLevel || 1;
      var maxBatch = maxCrossCraftCount(rec);
      if (canCraft) {
        var counts = getBatchCountsToShow(chefLevel, maxBatch);
        counts.forEach(function(c) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn-craft-make';
          btn.textContent = (c === 1 && counts.length === 1) ? '制作' : (c === 1 ? '制作×1' : '制作×' + c);
          btn.onclick = (function(cnt) {
            return function() {
              doCrossCraft(rec.id, cnt);
              closeCraftDetail();
              if (typeof renderMakingDesk === 'function') renderMakingDesk();
              if (typeof renderTownMap === 'function') renderTownMap();
            };
          })(c);
          buttonsEl.appendChild(btn);
        });
      } else {
        var btnDisabled = document.createElement('button');
        btnDisabled.type = 'button';
        btnDisabled.className = 'btn-craft-make';
        btnDisabled.disabled = true;
        btnDisabled.textContent = '材料不足';
        buttonsEl.appendChild(btnDisabled);
      }
    }
    modal.classList.remove('hidden');
    bindCraftDetailOnce();
  }

  function closeCraftDetail() {
    _currentDetailRecipe = null;
    var modal = document.getElementById('modal-craft-detail');
    if (modal) modal.classList.add('hidden');
  }

  function bindCraftDetailOnce() {
    if (_craftDetailBound) return;
    _craftDetailBound = true;
    var btnClose = document.getElementById('btn-close-craft-detail');
    if (btnClose) btnClose.addEventListener('click', function() { closeCraftDetail(); });
  }

  function bindCraftFilterOnce() {
    if (_craftFilterBound) return;
    _craftFilterBound = true;
    document.querySelectorAll('.craft-filter-tab').forEach(function(t) {
      t.addEventListener('click', function() {
        state.craftFilterCategory = t.dataset.category || 'all';
        document.querySelectorAll('.craft-filter-tab').forEach(function(x) { x.classList.toggle('active', x === t); });
        renderCraftGrid();
      });
    });
  }

  var CHAIN_LABELS = { wheat: '主食', veggie: '蔬菜', protein: '蛋白质' };

  /** 根据物品 id 得到所属链的 key（如 flour → wheat） */
  function getChainKeyByItemId(itemId) {
    if (!itemId || !CHAINS) return null;
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      if (!chain) continue;
      for (var i = 0; i < chain.length; i++) {
        if (chain[i].id === itemId) return key;
      }
    }
    return null;
  }

  /** 制作台：主食/乳制品/蔬菜/蛋白质/合成品 各行，每格 icon+名称+数量，点击打开对应弹窗 */
  function renderMakingDesk() {
    var container = document.getElementById('craft-desk');
    if (!container) return;
    container.innerHTML = '';
    var chainKeys = TILE_TYPES || ['wheat', 'veggie', 'protein'];
    chainKeys.forEach(function(chainKey) {
      var section = document.createElement('div');
      section.className = 'craft-desk-section-row';
      var label = document.createElement('div');
      label.className = 'craft-desk-label';
      label.textContent = '[' + (CHAIN_LABELS[chainKey] || chainKey) + ']';
      section.appendChild(label);
      var row = document.createElement('div');
      row.className = 'craft-desk-row';
      var chain = CHAINS[chainKey];
      if (chain) {
        var maxLevel = getMaxChainLevel(chainKey);
        chain.forEach(function(item, level) {
          if (level + 1 > maxLevel) return;
          if (level > 0) {
            var arrow = document.createElement('span');
            arrow.className = 'craft-desk-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '›';
            row.appendChild(arrow);
          }
          var cell = document.createElement('button');
          cell.type = 'button';
          cell.className = 'craft-desk-cell';
          cell.dataset.itemId = item.id;
          cell.dataset.chain = '1';
          var count = getInv(item.id);
          var lv = level + 1;
          cell.innerHTML = '<span class="cell-lv">Lv' + lv + '</span><span class="cell-icon">' + item.emoji + '</span><span class="cell-name">' + item.name + '</span><span class="cell-count">×' + count + '</span>';
          cell.onclick = function() {
            if (CHAIN_RECIPES[item.id]) openChainCraftModal(item.id);
            else {
              var ck = getChainKeyByItemId(item.id);
              if (ck && CHAINS[ck] && CHAINS[ck][1]) openChainCraftModal(CHAINS[ck][1].id);
            }
          };
          row.appendChild(cell);
        });
      }
      section.appendChild(row);
      container.appendChild(section);
    });
    var unlockedCross = (CROSS_RECIPES || []).filter(function(rec) { return isCrossRecipeUnlocked(rec); });
    if (unlockedCross.length > 0) {
      var crossSection = document.createElement('div');
      crossSection.className = 'craft-desk-section-row';
      var crossLabel = document.createElement('div');
      crossLabel.className = 'craft-desk-label';
      crossLabel.textContent = '[合成品]';
      crossSection.appendChild(crossLabel);
      var crossRow = document.createElement('div');
      crossRow.className = 'craft-desk-row';
      unlockedCross.forEach(function(rec) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'craft-desk-cell';
        var count = getInv(rec.id);
        cell.innerHTML = '<span class="cell-icon">' + rec.emoji + '</span><span class="cell-name">' + rec.name + '</span><span class="cell-count">×' + count + '</span>';
        cell.onclick = function() { openCraftDetail(rec); };
        crossRow.appendChild(cell);
      });
      crossSection.appendChild(crossRow);
      container.appendChild(crossSection);
    }
  }

  /** 打开链内合成弹窗：显示该物品所属的完整合成链（所有可合成等级及其配方与按钮） */
  function openChainCraftModal(itemId) {
    var chainKey = getChainKeyByItemId(itemId);
    if (!chainKey || !CHAINS[chainKey]) return;
    var chain = CHAINS[chainKey];
    var modal = document.getElementById('modal-chain-craft');
    var titleEl = document.getElementById('chain-craft-title');
    var stepsEl = document.getElementById('chain-craft-steps');
    if (!modal || !titleEl || !stepsEl) return;
    var chainLabel = CHAIN_LABELS[chainKey] || chainKey;
    titleEl.textContent = chainLabel + ' · 链内合成';
    stepsEl.innerHTML = '';
    var maxLevel = getMaxChainLevel(chainKey);
    var chefLevel = state.chefLevel || 1;
    for (var i = 1; i < chain.length; i++) {
      if (i + 1 > maxLevel) break;
      var item = chain[i];
      var recipe = CHAIN_RECIPES[item.id];
      if (!recipe) continue;
      var info = getItemInfo(item.id);
      var fromInfo = getItemInfo(recipe.from);
      var have = getInv(recipe.from);
      var maxCount = Math.floor(have / recipe.count);
      var counts = getBatchCountsToShow(chefLevel, maxCount);
      var stepDiv = document.createElement('div');
      stepDiv.className = 'chain-step';
      var titleSpan = document.createElement('div');
      titleSpan.className = 'chain-step-title';
      titleSpan.innerHTML = 'Lv' + (i + 1) + ' ' + info.emoji + ' ' + info.name + ' <span class="chain-step-count">×' + getInv(item.id) + '</span>';
      stepDiv.appendChild(titleSpan);
      var formulaSpan = document.createElement('div');
      formulaSpan.className = 'chain-step-formula';
      formulaSpan.textContent = '需要：' + fromInfo.emoji + ' ' + fromInfo.name + ' ×' + recipe.count + '（当前 ' + have + '）';
      stepDiv.appendChild(formulaSpan);
      var btnWrap = document.createElement('div');
      btnWrap.className = 'chain-step-buttons';
      counts.forEach(function(c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-craft';
        btn.textContent = c === 1 && counts.length === 1 ? '合成' : (c === 1 ? '合成×1' : '合成×' + c);
        btn.disabled = maxCount < c;
        (function(tid, cnt) {
          btn.onclick = function() {
            doChainCraft(tid, cnt);
            closeChainCraftModal();
            renderMakingDesk();
            if (typeof renderTownMap === 'function') renderTownMap();
            openChainCraftModal(itemId);
          };
        })(item.id, c);
        btnWrap.appendChild(btn);
      });
      stepDiv.appendChild(btnWrap);
      stepsEl.appendChild(stepDiv);
    }
    modal.classList.remove('hidden');
  }

  function closeChainCraftModal() {
    var modal = document.getElementById('modal-chain-craft');
    if (modal) modal.classList.add('hidden');
  }

  function renderCraftChain(chainKey) {
    state.currentChain = chainKey;
    var chainContainer = document.getElementById('craft-chain');
    if (chainContainer) {
      document.querySelectorAll('.craft-tab').forEach(function(t) { t.classList.toggle('active', t.dataset.chain === chainKey); });
      fillCraftContainers(chainKey, chainContainer, function() { renderCraftChain(state.currentChain); });
    }
    var grid = document.getElementById('craft-grid');
    if (grid) { renderCraftGrid(); bindCraftFilterOnce(); }
    renderMakingDesk();
  }

  /** count 默认 1；批量合成时传入 3 或 5 */
  function doChainCraft(targetId, count) {
    count = count || 1;
    if (!isChainItemUnlocked(targetId)) return;
    var recipe = CHAIN_RECIPES[targetId];
    if (!recipe) return;
    var need = recipe.count * count;
    if (getInv(recipe.from) < need) return;
    subInv(recipe.from, need);
    addInv(targetId, count);
    showToast('合成成功！×' + count);
    renderCraftChain(state.currentChain);
  }

  /** count 默认 1；批量合成时传入 3 或 5 */
  function doCrossCraft(targetId, count) {
    count = count || 1;
    var rec = CROSS_RECIPES.find(function(r) { return r.id === targetId; });
    if (!rec || !isCrossRecipeUnlocked(rec)) return;
    if (!rec.needs.every(function(n) { return getInv(n.id) >= (n.n || 1) * count; })) return;
    rec.needs.forEach(function(n) { subInv(n.id, (n.n || 1) * count); });
    addInv(targetId, count);
    showToast('合成成功！×' + count);
    renderCraftChain(state.currentChain);
  }

  /** 当前材料最多可制作该合成菜品的份数 */
  function maxCrossCraftCount(rec) {
    if (!rec || !rec.needs || !rec.needs.length) return 0;
    var min = Infinity;
    rec.needs.forEach(function(n) {
      var have = getInv(n.id);
      var per = n.n || 1;
      var c = Math.floor(have / per);
      if (c < min) min = c;
    });
    return min === Infinity ? 0 : min;
  }

  global.getRecipeFromItemId = getRecipeFromItemId;
  global.fillCraftContainers = fillCraftContainers;
  global.renderCraftChain = renderCraftChain;
  global.renderCraftGrid = renderCraftGrid;
  global.renderMakingDesk = renderMakingDesk;
  global.doChainCraft = doChainCraft;
  global.doCrossCraft = doCrossCraft;
  global.openCraftDetail = openCraftDetail;
  global.closeCraftDetail = closeCraftDetail;
  global.openChainCraftModal = openChainCraftModal;
  global.closeChainCraftModal = closeChainCraftModal;
})(typeof window !== 'undefined' ? window : this);
