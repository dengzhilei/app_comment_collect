/**
 * Board & Cooking - 制作模块（依赖 config.js, state.js, items.js, board.js）
 */
(function(global) {

  function getRecipeFromItemId(itemId) {
    var recipe = CHAIN_RECIPES[itemId];
    if (recipe) return getItemInfo(recipe.from).name;
    return '';
  }

  function fillCraftContainers(chainKey, chainContainer, crossContainer, afterCraft) {
    var chain = CHAINS[chainKey];
    if (!chain || !chainContainer) return;
    chainContainer.innerHTML = '';
    chain.forEach(function(item, level) {
      var levelDiv = document.createElement('div');
      levelDiv.className = 'craft-level';
      levelDiv.innerHTML = '<span class="label">Lv' + (level + 1) + '</span>';
      var count = getInv(item.id);
      var span = document.createElement('span');
      span.className = 'craft-item';
      span.innerHTML = item.emoji + ' ' + item.name + ' <span class="count">×' + count + '</span>';
      levelDiv.appendChild(span);
      var recipe = CHAIN_RECIPES[item.id];
      if (recipe) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-craft';
        var fromName = getRecipeFromItemId(item.id) || recipe.from;
        btn.textContent = '合成(需' + recipe.count + fromName + ')';
        btn.disabled = getInv(recipe.from) < recipe.count;
        btn.onclick = function() {
          doChainCraft(item.id);
          if (afterCraft) afterCraft();
        };
        levelDiv.appendChild(btn);
      }
      chainContainer.appendChild(levelDiv);
    });

    if (!crossContainer) return;
    crossContainer.innerHTML = '';
    CROSS_RECIPES.forEach(function(rec) {
      var div = document.createElement('div');
      div.className = 'cross-recipe';
      var parts = rec.needs.map(function(n) { return getItemInfo(n.id).name + '×' + n.n; }).join(' + ');
      var canCraft = rec.needs.every(function(n) { return getInv(n.id) >= n.n; });
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-craft';
      btn.textContent = '合成';
      btn.disabled = !canCraft;
      btn.onclick = function() {
        doCrossCraft(rec.id);
        if (afterCraft) afterCraft();
      };
      div.innerHTML = '<span>' + parts + '</span> <span class="arrow">→</span> <span>' + rec.emoji + ' ' + rec.name + '</span>';
      div.appendChild(btn);
      crossContainer.appendChild(div);
    });
  }

  function renderCraftChain(chainKey) {
    state.currentChain = chainKey;
    document.querySelectorAll('.craft-tab').forEach(function(t) {
      t.classList.toggle('active', t.dataset.chain === chainKey);
    });
    fillCraftContainers(chainKey,
      document.getElementById('craft-chain'),
      document.getElementById('cross-recipes'),
      function() { renderCraftChain(state.currentChain); }
    );
  }

  function doChainCraft(targetId) {
    var recipe = CHAIN_RECIPES[targetId];
    if (!recipe || getInv(recipe.from) < recipe.count) return;
    subInv(recipe.from, recipe.count);
    addInv(targetId, 1);
    showToast('合成成功！');
    renderCraftChain(state.currentChain);
  }

  function doCrossCraft(targetId) {
    var rec = CROSS_RECIPES.find(function(r) { return r.id === targetId; });
    if (!rec || !rec.needs.every(function(n) { return getInv(n.id) >= n.n; })) return;
    rec.needs.forEach(function(n) { subInv(n.id, n.n); });
    addInv(targetId, 1);
    showToast('合成成功！');
    renderCraftChain(state.currentChain);
  }

  global.getRecipeFromItemId = getRecipeFromItemId;
  global.fillCraftContainers = fillCraftContainers;
  global.renderCraftChain = renderCraftChain;
  global.doChainCraft = doChainCraft;
  global.doCrossCraft = doCrossCraft;
})(typeof window !== 'undefined' ? window : this);
