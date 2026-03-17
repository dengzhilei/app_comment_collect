/**
 * Board & Merge - items (chains only, no cross recipes)
 */
(function(global) {
  var _valueCache = null;

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
  }

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
    return 1;
  }

  function getItemInfo(id) {
    for (var key in CHAINS) {
      var chain = CHAINS[key];
      var f = chain.find(function(x) { return x.id === id; });
      if (f) return { name: f.name, emoji: f.emoji || '', img: f.img || '' };
    }
    return { name: id, emoji: '\uD83D\uDCE6', img: '' };
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

  function getItemLevel(itemId) {
    for (var key in CHAINS) {
      var idx = CHAINS[key].findIndex(function(x) { return x.id === itemId; });
      if (idx !== -1) return idx + 1;
    }
    return 0;
  }

  function getMaxChainLevel(chainKey) {
    var maxByLevel = CHEF_LEVEL_CHAIN_MAX && CHEF_LEVEL_CHAIN_MAX[state.chefLevel];
    return (maxByLevel && maxByLevel[chainKey]) ? maxByLevel[chainKey] : 0;
  }

  function isChainItemUnlocked(itemId) {
    var chainKey = getChainForItem(itemId);
    if (!chainKey) return false;
    var level = getItemLevel(itemId);
    return level > 0 && level <= getMaxChainLevel(chainKey);
  }

  function getMergeResult(itemId) {
    if (!CHAIN_RECIPES) return null;
    for (var resultId in CHAIN_RECIPES) {
      var rec = CHAIN_RECIPES[resultId];
      if (rec && rec.from === itemId && rec.count === 2) return resultId;
    }
    return null;
  }

  function getAllItemIds() {
    var ids = [];
    for (var key in CHAINS) {
      (CHAINS[key] || []).forEach(function(item) { ids.push(item.id); });
    }
    return ids;
  }

  function isBaseItem(itemId) {
    return (typeof BASE_ITEM_IDS !== 'undefined' && BASE_ITEM_IDS.indexOf(itemId) !== -1);
  }

  /** 返回该物品所在合成链从 L1 到该物品的整段（用于弹窗展示） */
  function getChainSliceForItem(itemId) {
    var key = getChainForItem(itemId);
    if (!key || !CHAINS[key]) return [];
    var chain = CHAINS[key];
    var level = getItemLevel(itemId);
    if (level <= 0) return [];
    return chain.slice(0, level);
  }

  global.getItemInfo = getItemInfo;
  global.getItemName = getItemName;
  global.getChainForItem = getChainForItem;
  global.getItemLevel = getItemLevel;
  global.getMaxChainLevel = getMaxChainLevel;
  global.isChainItemUnlocked = isChainItemUnlocked;
  global.getItemValue = getItemValue;
  global.getUnlockChefLevelForItem = getUnlockChefLevelForItem;
  global.getAllItemIds = getAllItemIds;
  global.getMergeResult = getMergeResult;
  global.isBaseItem = isBaseItem;
  global.getChainSliceForItem = getChainSliceForItem;
})(typeof window !== 'undefined' ? window : this);
