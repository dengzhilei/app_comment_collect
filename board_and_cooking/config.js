/**
 * Board & Cooking - 配置常量
 * 棋盘产出、掉落表、基础物品均由「地格→合成链」+ 链数据 推导，避免重复书写 id。
 */

// ---------- 棋盘外观（地格类型与展示） ----------
const TILE_TYPES = ['wheat', 'milk', 'egg', 'tomato'];
const TILE_EMOJI = { wheat: '🌾', milk: '🥛', egg: '🥚', tomato: '🍅' };
const TILE_IMAGE = {
  wheat: 'img/tiles/wheat.png',
  milk: 'img/tiles/milk.png',
  egg: 'img/tiles/egg.png',
  tomato: 'img/tiles/tomato.png'
};

// ---------- 合成链（权威数据源：每条链 Lv1→Lv2→…→LvN） ----------
const CHAINS = {
  wheat: [
    { id: 'wheat', name: '小麦', emoji: '🌾' },
    { id: 'flour', name: '面粉', emoji: '🥡' },
    { id: 'bread', name: '面包', emoji: '🍞' }
  ],
  dairy: [
    { id: 'milk', name: '牛奶', emoji: '🥛' },
    { id: 'butter', name: '黄油', emoji: '🧈' },
    { id: 'cheese', name: '芝士', emoji: '🧀' }
  ],
  veggie: [
    { id: 'lettuce', name: '生菜', emoji: '🥬' },
    { id: 'tomato', name: '番茄', emoji: '🍅' },
    { id: 'potato', name: '土豆', emoji: '🥔' },
    { id: 'mushroom', name: '蘑菇', emoji: '🍄' }
  ],
  protein: [
    { id: 'egg', name: '鸡蛋', emoji: '🥚' },
    { id: 'bacon', name: '培根', emoji: '🥓' },
    { id: 'drumstick', name: '鸡腿', emoji: '🍗' },
    { id: 'steak', name: '牛排', emoji: '🥩' }
  ]
};

// 地格类型 → 合成链 key（棋盘上该格对应哪条链）
const TILE_TO_CHAIN = {
  wheat: 'wheat',
  milk: 'dairy',
  egg: 'protein',
  tomato: 'veggie'
};

// 按链等级数使用的掉落权重（权重和 100，等级从低到高）
const DROP_WEIGHTS_BY_LEVELS = {
  3: [78, 18, 4],
  4: [78, 18, 4, 0]
};

// 由链推导：棋盘基础产出 = 对应链第 0 个物品 id
const TILE_GAIN = (function() {
  var o = {};
  for (var i = 0; i < TILE_TYPES.length; i++) {
    var t = TILE_TYPES[i];
    var chainKey = TILE_TO_CHAIN[t];
    if (chainKey && CHAINS[chainKey] && CHAINS[chainKey][0])
      o[t] = CHAINS[chainKey][0].id;
  }
  return o;
})();

// 由链推导：掉落表 = 对应链各级物品 + 对应权重
const TILE_DROP_TABLES = (function() {
  var o = {};
  for (var i = 0; i < TILE_TYPES.length; i++) {
    var t = TILE_TYPES[i];
    var chain = CHAINS[TILE_TO_CHAIN[t]];
    if (!chain) continue;
    var weights = DROP_WEIGHTS_BY_LEVELS[chain.length] || DROP_WEIGHTS_BY_LEVELS[3];
    o[t] = chain.map(function(item, idx) {
      return { id: item.id, weight: weights[idx] !== undefined ? weights[idx] : 0 };
    }).filter(function(x) { return x.weight > 0; });
  }
  return o;
})();

// 由链推导：基础物品 = 每条链第 0 个物品 id（不可合成）
const BASE_ITEM_IDS = (function() {
  var ids = [];
  for (var key in CHAINS) {
    if (CHAINS[key] && CHAINS[key][0]) ids.push(CHAINS[key][0].id);
  }
  return ids;
})();

// ---------- 棋盘结构 ----------
const BOARD_CELLS = 24;
const HOLLOW_GRID_SIZE = 7;
const PATH_GRID = [
  [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],
  [1,6],[2,6],[3,6],[4,6],[5,6],
  [6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [5,0],[4,0],[3,0],[2,0],[1,0]
];

// ---------- 链内合成配方（Lv2+ 由下级合成） ----------
const CHAIN_RECIPES = {
  flour: { from: 'wheat', count: 2 },
  bread: { from: 'flour', count: 2 },
  butter: { from: 'milk', count: 2 },
  cheese: { from: 'butter', count: 2 },
  tomato: { from: 'lettuce', count: 2 },
  potato: { from: 'tomato', count: 2 },
  mushroom: { from: 'potato', count: 2 },
  bacon: { from: 'egg', count: 2 },
  drumstick: { from: 'bacon', count: 2 },
  steak: { from: 'drumstick', count: 2 }
};

// ---------- 交叉合成 ----------
const CROSS_RECIPES = [
  { id: 'toast', name: '芝士吐司', emoji: '🍞', needs: [{ id: 'bread', n: 1 }, { id: 'butter', n: 1 }, { id: 'cheese', n: 1 }] },
  { id: 'sandwich', name: '三明治', emoji: '🥪', needs: [{ id: 'bread', n: 1 }, { id: 'lettuce', n: 1 }, { id: 'drumstick', n: 1 }] },
  { id: 'salad', name: '沙拉', emoji: '🥗', needs: [{ id: 'lettuce', n: 1 }, { id: 'tomato', n: 1 }, { id: 'egg', n: 1 }] }
];

const BET_OPTIONS = [1, 2, 3, 5, 10];

const NPCS = [
  { id: 'npc1', name: '面包师', emoji: '👨‍🍳', order: { items: [{ id: 'bread', n: 1 }], reward: { dice: 3 } } },
  { id: 'npc2', name: '农夫', emoji: '👩‍🌾', order: { items: [{ id: 'wheat', n: 2 }, { id: 'tomato', n: 1 }], reward: { dice: 3 } } },
  { id: 'npc3', name: '厨师', emoji: '👩‍🍳', order: { items: [{ id: 'toast', n: 1 }], reward: { dice: 5 } } },
  { id: 'npc4', name: '孩子', emoji: '🧒', order: { items: [{ id: 'sandwich', n: 1 }], reward: { dice: 5 } } },
  { id: 'npc5', name: '老板娘', emoji: '👩', order: { items: [{ id: 'salad', n: 1 }, { id: 'bread', n: 1 }], reward: { dice: 6 } } }
];
