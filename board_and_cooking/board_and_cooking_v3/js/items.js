/**
 * Board & Cooking - 物品与配方查询（依赖 config.js）
 */
(function(global) {
  var _valueCache = null;

  /** v4：计算物品价值（基础→链内→交叉，依赖配置 BASE_ITEM_VALUES） */
  function getItemValue(itemId) {
    if (!_valueCache) buildValueCache();
    return _valueCache[itemId] != null ? _valueCache[itemId] : 1;
  }

  function buildValueCache() {
    _valueCache = {};
    var baseValues = typeof BASE_ITEM_VALUES !== 'undefined' ? BASE_ITEM_VALUES : {};
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      if (!chain || !chain[0]) continue;
      var baseId = chain[0].id;
      _valueCache[baseId] = baseValues[baseId] != null ? baseValues[baseId] : 1;
    }
    for (var key in CHAINS) {
      var c = CHAINS[key];
      for (var i = 1; i < c.length; i++) {
        var recipe = CHAIN_RECIPES[c[i].id];
        if (recipe && _valueCache[recipe.from] != null)
          _valueCache[c[i].id] = _valueCache[recipe.from] * recipe.count;
      }
    }
    (CROSS_RECIPES || []).forEach(function(r) {
      var sum = 0;
      (r.needs || []).forEach(function(n) {
        var v = _valueCache[n.id] != null ? _valueCache[n.id] : 1;
        sum += v * (n.n || 1);
      });
      _valueCache[r.id] = sum;
    });
  }

  /** v4：物品解锁所需的厨师等级（链内=该链等级开放的最小等级，交叉=unlockChefLevel） */
  function getUnlockChefLevelForItem(itemId) {
    var chainKey = getChainForItem(itemId);
    if (chainKey) {
      var itemLevel = getItemLevel(itemId);
      for (var L = 1; L <= 4; L++) {
        var maxBy = CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[L];
        var maxLv = (maxBy && maxBy[chainKey]) || 0;
        if (maxLv >= itemLevel) return L;
      }
      return 4;
    }
    var cross = (CROSS_RECIPES || []).find(function(r) { return r.id === itemId; });
    if (cross) return cross.unlockChefLevel != null ? cross.unlockChefLevel : 1;
    return 1;
  }

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

  /** 当前厨师等级下，某链允许的最大等级（1-based） */
  function getMaxChainLevel(chainKey) {
    var maxByLevel = CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[state.chefLevel];
    return (maxByLevel && maxByLevel[chainKey]) ? maxByLevel[chainKey] : 0;
  }

  /** 链内物品是否已解锁（当前厨师等级允许合成/使用） */
  function isChainItemUnlocked(itemId) {
    var chainKey = getChainForItem(itemId);
    if (!chainKey) return false;
    var level = getItemLevel(itemId);
    return level > 0 && level <= getMaxChainLevel(chainKey);
  }

  /** 交叉配方是否已解锁 */
  function isCrossRecipeUnlocked(recipe) {
    var need = recipe && recipe.unlockChefLevel != null ? recipe.unlockChefLevel : 1;
    return (state.chefLevel || 1) >= need;
  }

  /** 玩家是否已「知晓」该物品（用于订单详情：未解锁显示 ???） */
  function isItemKnownToPlayer(itemId) {
    var chainKey = getChainForItem(itemId);
    if (chainKey) return isChainItemUnlocked(itemId);
    var cross = CROSS_RECIPES.find(function(r) { return r.id === itemId; });
    if (cross) return isCrossRecipeUnlocked(cross);
    return true;
  }

  /** 所有物品 id 列表（链内 + 交叉配方），供 GM 等使用 */
  function getAllItemIds() {
    var ids = [];
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      if (chain) chain.forEach(function(item) { ids.push(item.id); });
    }
    (CROSS_RECIPES || []).forEach(function(r) { if (r.id) ids.push(r.id); });
    return ids;
  }

  global.getItemInfo = getItemInfo;
  global.getItemName = getItemName;
  global.getChainForItem = getChainForItem;
  global.getItemLevel = getItemLevel;
  global.canCraftItem = canCraftItem;
  global.isBaseItem = isBaseItem;
  global.getRecipeForItem = getRecipeForItem;
  global.getMaxChainLevel = getMaxChainLevel;
  global.isChainItemUnlocked = isChainItemUnlocked;
  global.isCrossRecipeUnlocked = isCrossRecipeUnlocked;
  global.isItemKnownToPlayer = isItemKnownToPlayer;
  global.getItemValue = getItemValue;
  global.getUnlockChefLevelForItem = getUnlockChefLevelForItem;
  global.getAllItemIds = getAllItemIds;
})(typeof window !== 'undefined' ? window : this);
