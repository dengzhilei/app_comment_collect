/**
 * Board & Cooking - 配方详情弹窗（依赖 config.js, state.js, items.js, board.js）
 */
(function(global) {

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

  global.openRecipeDetail = openRecipeDetail;
  global.closeRecipeDetail = closeRecipeDetail;
  global.renderRecipeDetail = renderRecipeDetail;
})(typeof window !== 'undefined' ? window : this);
