/**
 * Board & Cooking - 物品与配方查询（依赖 config.js）
 */
(function(global) {
  function getItemInfo(id) {
    var chain, f, c;
    for (var key in CHAINS) {
      chain = CHAINS[key];
      f = chain.find(function(x) { return x.id === id; });
      if (f) return { name: f.name, emoji: f.emoji };
    }
    c = CROSS_RECIPES.find(function(r) { return r.id === id; });
    if (c) return { name: c.name, emoji: c.emoji };
    return { name: id, emoji: '📦' };
  }

  function getItemName(id) {
    var info = getItemInfo(id);
    return info.emoji + ' ' + info.name;
  }

  function getChainForItem(itemId) {
    for (var key in CHAINS) {
      if (CHAINS[key].some(function(x) { return x.id === itemId; }))
        return key;
    }
    return null;
  }

  /** 物品在合成链上的等级 1/2/3，非链物品返回 0 */
  function getItemLevel(itemId) {
    var chain, idx;
    for (var key in CHAINS) {
      chain = CHAINS[key];
      idx = chain.findIndex(function(x) { return x.id === itemId; });
      if (idx !== -1) return idx + 1;
    }
    return 0;
  }

  function canCraftItem(itemId) {
    var chainKey = getChainForItem(itemId);
    if (chainKey) {
      var recipe = CHAIN_RECIPES[itemId];
      if (recipe) return getInv(recipe.from) >= recipe.count;
    }
    var cross = CROSS_RECIPES.find(function(r) { return r.id === itemId; });
    if (cross) return cross.needs.every(function(n) { return getInv(n.id) >= n.n; });
    return false;
  }

  function isBaseItem(itemId) {
    return BASE_ITEM_IDS.indexOf(itemId) !== -1;
  }

  /** 获取物品合成配方，基础物品返回 null */
  function getRecipeForItem(itemId) {
    if (isBaseItem(itemId)) return null;
    var recipe = CHAIN_RECIPES[itemId];
    if (recipe) return { type: 'chain', ingredients: [{ id: recipe.from, n: recipe.count }], resultId: itemId };
    var cross = CROSS_RECIPES.find(function(r) { return r.id === itemId; });
    if (cross) return { type: 'cross', ingredients: cross.needs.map(function(n) { return { id: n.id, n: n.n }; }), resultId: itemId };
    return null;
  }

  global.getItemInfo = getItemInfo;
  global.getItemName = getItemName;
  global.getChainForItem = getChainForItem;
  global.getItemLevel = getItemLevel;
  global.canCraftItem = canCraftItem;
  global.isBaseItem = isBaseItem;
  global.getRecipeForItem = getRecipeForItem;
})(typeof window !== 'undefined' ? window : this);
