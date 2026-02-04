/**
 * Board & Cooking - 游戏状态与背包数量读写（依赖 config.js）
 */
(function(global) {
  global.state = {
    dice: 20,
    bet: 1,
    position: 0,
    inventory: {},
    boardTiles: [],
    selectedNpcId: null,
    currentChain: 'wheat',
    recipeDetailStack: [],
    lastRollSteps: 0,
    lastGain: null,
    moving: false,
    chefLevel: 1,
    chefExp: 0,
    craftFilterCategory: 'all',
    craftOnlyMakeable: false,
    activeOrders: [],
    selectedOrderSlot: null
  };

  function getInv(id) {
    return global.state.inventory[id] || 0;
  }
  function addInv(id, n) {
    global.state.inventory[id] = (global.state.inventory[id] || 0) + n;
  }
  function subInv(id, n) {
    var have = global.state.inventory[id] || 0;
    if (have < n) return false;
    global.state.inventory[id] = have - n;
    return true;
  }

  global.getInv = getInv;
  global.addInv = addInv;
  global.subInv = subInv;
})(typeof window !== 'undefined' ? window : this);
