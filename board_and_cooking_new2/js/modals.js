/**
 * Board & Cooking - 背包与配方详情弹窗（依赖 config.js, state.js, items.js, board.js）
 */
(function(global) {

  function openInventory() {
    var list = document.getElementById('inventory-list');
    list.innerHTML = '';
    var chainKeys = ['wheat', 'dairy', 'veggie', 'protein'];
    var chainLabels = { wheat: '主食', dairy: '乳制品', veggie: '蔬菜', protein: '蛋白质' };
    chainKeys.forEach(function(chainKey) {
      var chain = CHAINS[chainKey];
      var itemsWithCount = chain.filter(function(item) { return getInv(item.id) > 0; });
      if (itemsWithCount.length === 0) return;
      var section = document.createElement('div');
      section.className = 'inv-chain-row';
      var label = document.createElement('div');
      label.className = 'inv-chain-label';
      label.textContent = chainLabels[chainKey] || chainKey;
      section.appendChild(label);
      var wrap = document.createElement('div');
      wrap.className = 'inv-chain-items';
      itemsWithCount.forEach(function(item) {
        var count = getInv(item.id);
        var div = document.createElement('div');
        div.className = 'inv-item';
        div.innerHTML = '<span>' + item.emoji + '</span><span>' + item.name + '</span><span class="count">×' + count + '</span>';
        wrap.appendChild(div);
      });
      section.appendChild(wrap);
      list.appendChild(section);
    });
    var crossWithCount = CROSS_RECIPES.filter(function(rec) { return getInv(rec.id) > 0; });
    if (crossWithCount.length > 0) {
      var section = document.createElement('div');
      section.className = 'inv-chain-row inv-cross-row';
      var label = document.createElement('div');
      label.className = 'inv-chain-label';
      label.textContent = '合成物品';
      section.appendChild(label);
      var wrap = document.createElement('div');
      wrap.className = 'inv-chain-items';
      crossWithCount.forEach(function(rec) {
        var count = getInv(rec.id);
        var div = document.createElement('div');
        div.className = 'inv-item inv-item-cross';
        div.innerHTML = '<span>' + rec.emoji + '</span><span>' + rec.name + '</span><span class="count">×' + count + '</span>';
        wrap.appendChild(div);
      });
      section.appendChild(wrap);
      list.appendChild(section);
    }
    document.getElementById('modal-inventory').classList.remove('hidden');
  }

  function closeInventory() {
    document.getElementById('modal-inventory').classList.add('hidden');
  }

  function openRecipeDetail(itemId) {
    state.recipeDetailStack = [itemId];
    document.getElementById('modal-recipe-detail').classList.remove('hidden');
    renderRecipeDetail();
  }

  function closeRecipeDetail() {
    state.recipeDetailStack = [];
    document.getElementById('modal-recipe-detail').classList.add('hidden');
  }

  function renderRecipeDetail() {
    var modal = document.getElementById('modal-recipe-detail');
    var titleEl = modal.querySelector('.recipe-detail-title');
    var bodyEl = modal.querySelector('.recipe-detail-body');
    var backBtn = modal.querySelector('.btn-recipe-back');
    if (!titleEl || !bodyEl) return;
    var itemId = state.recipeDetailStack[state.recipeDetailStack.length - 1];
    var recipe = getRecipeForItem(itemId);
    var info = getItemInfo(itemId);
    bodyEl.innerHTML = '';
    if (!recipe) {
      titleEl.textContent = info.emoji + ' ' + info.name;
      bodyEl.textContent = '基础物品，无需合成。';
      if (backBtn) backBtn.classList.add('hidden');
      return;
    }

    if (recipe.type === 'chain') {
      titleEl.textContent = info.emoji + ' ' + info.name;
      var chainKey = getChainForItem(itemId);
      var chain = CHAINS[chainKey];
      var flow = document.createElement('div');
      flow.className = 'recipe-detail-chain-flow';
      chain.forEach(function(item, index) {
        var node = document.createElement('span');
        node.className = 'chain-node';
        if (item.id === itemId) node.classList.add('chain-target');
        var unlocked = typeof isChainItemUnlocked === 'function' && isChainItemUnlocked(item.id);
        var emoji = unlocked ? item.emoji : '?';
        var name = unlocked ? item.name : '???';
        node.textContent = 'Lv' + (index + 1) + ' ' + emoji + ' ' + name;
        flow.appendChild(node);
        if (index < chain.length - 1) {
          var arrow = document.createElement('span');
          arrow.className = 'chain-arrow';
          arrow.textContent = '→';
          flow.appendChild(arrow);
        }
      });
      bodyEl.appendChild(flow);
      if (backBtn) backBtn.classList.add('hidden');
      return;
    }

    titleEl.textContent = info.emoji + ' ' + info.name + ' 合成配方';
    bodyEl.appendChild(document.createTextNode('需要：'));
    var ul = document.createElement('ul');
    ul.className = 'recipe-detail-list';
    recipe.ingredients.forEach(function(ing) {
      var li = document.createElement('li');
      var ingInfo = getItemInfo(ing.id);
      var known = typeof isItemKnownToPlayer === 'function' && isItemKnownToPlayer(ing.id);
      var ingEmoji = known ? ingInfo.emoji : '?';
      var ingName = known ? ingInfo.name : '???';
      li.appendChild(document.createTextNode(ingEmoji + ' ' + ingName + ' ×' + ing.n));
      if (!isBaseItem(ing.id) && known) {
        var detailBtn = document.createElement('button');
        detailBtn.type = 'button';
        detailBtn.className = 'btn-detail-inline';
        detailBtn.textContent = '详情';
        detailBtn.onclick = function() {
          state.recipeDetailStack.push(ing.id);
          renderRecipeDetail();
        };
        li.appendChild(document.createTextNode(' '));
        li.appendChild(detailBtn);
      }
      ul.appendChild(li);
    });
    bodyEl.appendChild(ul);
    if (backBtn) {
      backBtn.classList.toggle('hidden', state.recipeDetailStack.length <= 1);
      backBtn.onclick = function() {
        state.recipeDetailStack.pop();
        renderRecipeDetail();
      };
    }
  }

  global.openInventory = openInventory;
  global.closeInventory = closeInventory;
  global.openRecipeDetail = openRecipeDetail;
  global.closeRecipeDetail = closeRecipeDetail;
  global.renderRecipeDetail = renderRecipeDetail;
})(typeof window !== 'undefined' ? window : this);
