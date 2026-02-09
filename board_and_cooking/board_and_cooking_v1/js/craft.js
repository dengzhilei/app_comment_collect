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
        if (!ok) {
          canCraft = false;
          var info = getItemInfo(n.id);
          missingNames.push(info.name);
        }
        var row = document.createElement('div');
        row.className = 'formula-row' + (ok ? '' : ' missing');
        var info = getItemInfo(n.id);
        row.innerHTML = '<span>' + info.emoji + ' ' + info.name + ' (' + have + '/' + n.n + ')</span><span class="' + (ok ? 'formula-ok' : '') + '">' + (ok ? '✅' : '❌') + '</span>';
        formulaEl.appendChild(row);
      });
      if (missingNames.length) {
        var hint = document.createElement('p');
        hint.className = 'formula-row missing craft-detail-missing-hint';
        hint.textContent = '缺：' + missingNames.join('、');
        formulaEl.appendChild(hint);
      }
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
              renderCraftGrid();
              renderCraftChain(state.currentChain);
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

  function renderCraftChain(chainKey) {
    state.currentChain = chainKey;
    document.querySelectorAll('.craft-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.chain === chainKey);
    });
    fillCraftContainers(chainKey, document.getElementById('craft-chain'), function() { renderCraftChain(state.currentChain); });
    renderCraftGrid();
    bindCraftFilterOnce();
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
  global.doChainCraft = doChainCraft;
  global.doCrossCraft = doCrossCraft;
  global.openCraftDetail = openCraftDetail;
  global.closeCraftDetail = closeCraftDetail;
})(typeof window !== 'undefined' ? window : this);
