/**
 * Board & Cooking - 配置常量
 * 棋盘产出、掉落表、基础物品均由「地格→合成链」+ 链数据 推导，避免重复书写 id。
 */

// ---------- 棋盘外观（地格类型与展示，与合成链 CHAINS 的 key 统一） ----------
const TILE_TYPES = ['wheat', 'dairy', 'veggie', 'protein'];
/** 四种基础地格在「可分配格」中的数量（对象形式，键为地格类型 = 链名）。总和须等于可分配格数。未配置或总和不对时按原逻辑均分。 */
const TILE_COUNTS = { wheat: 11, dairy: 7, veggie: 6, protein: 5};
const TILE_EMOJI = { wheat: '🌾', dairy: '🥛', veggie: '🥬', protein: '🥚' };
const TILE_IMAGE = {
  wheat: 'img/tiles/wheat.png',
  dairy: 'img/tiles/milk.png',
  veggie: 'img/tiles/tomato.png',
  protein: 'img/tiles/egg.png'
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

// 地格类型即合成链 key，无需单独映射

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
    if (CHAINS[t] && CHAINS[t][0]) o[t] = CHAINS[t][0].id;
  }
  return o;
})();

// 由链推导：掉落表 = 对应链各级物品 + 对应权重
const TILE_DROP_TABLES = (function() {
  var o = {};
  for (var i = 0; i < TILE_TYPES.length; i++) {
    var t = TILE_TYPES[i];
    var chain = CHAINS[t];
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

// ---------- 棋盘结构（doc_3 v1：仅外圈 40 格，方形中空无内圈） ----------
const BOARD_CELLS = 40;
const HOLLOW_GRID_SIZE = 11;
// 路径：仅外圈 40 格（11×11 周长 = 11+10+10+9）
const PATH_GRID = [
  [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],
  [1,10],[2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],
  [10,9],[10,8],[10,7],[10,6],[10,5],[10,4],[10,3],[10,2],[10,1],[10,0],
  [9,0],[8,0],[7,0],[6,0],[5,0],[4,0],[3,0],[2,0],[1,0]
];
// 视口可见格数（宽/高），用于镜头裁剪与移动
const BOARD_VIEWPORT_CELLS = 8;
// 每次掷骰使用的骰子数量，步数 = 两骰点数之和
const DICE_PER_ROLL = 2;

// ---------- doc_3 v2：特殊格（飞机场 / 四角空地 / 问号格） ----------
// 四边中央格为飞机场（路径下标：上5 右15 下25 左35）
const BOARD_AIRPORT_PATH_INDICES = [5, 15, 25, 35];
// 四角为占位空地（路径下标：左上0 右上10 右下20 左下30）
const BOARD_CORNER_PATH_INDICES = [0, 10, 20, 30];
// 左下角显示为 GO 起点格
const BOARD_GO_PATH_INDEX = 30;
// 问号格：直接配置路径下标（0–39），未配置时则按数量随机抽取
const BOARD_QUESTION_PATH_INDICES = [12, 26, 37];
// 未配置 BOARD_QUESTION_PATH_INDICES 时，从非飞机场、非角格中随机抽取的数量
const BOARD_QUESTION_MARK_COUNT = 3;

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

// ---------- 厨师等级与节奏（v1） ----------
// 每级（1-4）每条链允许的最大等级（1-based）
const CHEF_LEVEL_CHAIN_MAX = {
  1: { wheat: 2, dairy: 1, veggie: 1, protein: 1 },
  2: { wheat: 3, dairy: 2, veggie: 2, protein: 2 },
  3: { wheat: 3, dairy: 3, veggie: 3, protein: 3 },
  4: { wheat: 3, dairy: 3, veggie: 4, protein: 4 }
};
// 达到 2/3/4 级所需累计经验
const CHEF_EXP_THRESHOLDS = [50, 150, 300];
// 厨师等级称号（升级弹窗「晋升成为 xx」）
const CHEF_LEVEL_TITLES = {
  1: '见习厨师',
  2: '正式厨师',
  3: '高级厨师',
  4: '传奇厨师'
};

// ---------- 交叉合成（含解锁等级与分类） ----------
const CROSS_RECIPES = [
  { id: 'pancakes', name: '松饼', emoji: '🥞', needs: [{ id: 'flour', n: 1 }, { id: 'milk', n: 1 }], unlockChefLevel: 1, category: 'breakfast' },
  { id: 'fresh_pasta', name: '生鲜意面', emoji: '🍝', needs: [{ id: 'flour', n: 1 }, { id: 'egg', n: 1 }], unlockChefLevel: 1, category: 'main' },
  { id: 'egg_salad', name: '鸡蛋沙拉', emoji: '🥗', needs: [{ id: 'egg', n: 1 }, { id: 'lettuce', n: 1 }], unlockChefLevel: 1, category: 'main' },
  { id: 'butter_toast', name: '经典吐司', emoji: '🍞', needs: [{ id: 'bread', n: 1 }, { id: 'butter', n: 1 }], unlockChefLevel: 2, category: 'breakfast' },
  { id: 'blt', name: 'BLT三明治', emoji: '🥪', needs: [{ id: 'bread', n: 1 }, { id: 'bacon', n: 1 }, { id: 'lettuce', n: 1 }], unlockChefLevel: 2, category: 'main' },
  { id: 'tomato_pasta', name: '番茄意面', emoji: '🍝', needs: [{ id: 'flour', n: 1 }, { id: 'tomato', n: 1 }], unlockChefLevel: 2, category: 'main' },
  { id: 'breakfast_plate', name: '英式早餐', emoji: '🍳', needs: [{ id: 'bread', n: 1 }, { id: 'egg', n: 1 }, { id: 'bacon', n: 1 }], unlockChefLevel: 2, category: 'breakfast' },
  { id: 'fried_chicken', name: '炸鸡', emoji: '🍗', needs: [{ id: 'flour', n: 1 }, { id: 'drumstick', n: 1 }], unlockChefLevel: 3, category: 'main' },
  { id: 'fries', name: '炸薯条', emoji: '🍟', needs: [{ id: 'potato', n: 1 }, { id: 'butter', n: 1 }], unlockChefLevel: 3, category: 'main' },
  { id: 'pizza', name: '玛格丽特披萨', emoji: '🍕', needs: [{ id: 'flour', n: 1 }, { id: 'tomato', n: 1 }, { id: 'cheese', n: 1 }], unlockChefLevel: 3, category: 'main' },
  { id: 'baked_potato', name: '芝士焗土豆', emoji: '🥔', needs: [{ id: 'potato', n: 1 }, { id: 'cheese', n: 1 }, { id: 'bacon', n: 1 }], unlockChefLevel: 3, category: 'main' },
  { id: 'wellington', name: '惠灵顿牛排', emoji: '🥩', needs: [{ id: 'bread', n: 1 }, { id: 'steak', n: 1 }, { id: 'mushroom', n: 1 }], unlockChefLevel: 4, category: 'main' },
  { id: 'steak_mash', name: '牛排配薯泥', emoji: '🍽️', needs: [{ id: 'steak', n: 1 }, { id: 'potato', n: 1 }, { id: 'butter', n: 1 }], unlockChefLevel: 4, category: 'main' },
  { id: 'mushroom_soup', name: '奶油蘑菇汤', emoji: '🍲', needs: [{ id: 'mushroom', n: 1 }, { id: 'milk', n: 1 }, { id: 'flour', n: 1 }], unlockChefLevel: 4, category: 'main' }
];

const BET_OPTIONS = [1, 2, 3, 5, 10];

// v2：NPC 池（仅形象，订单由随机规则生成）
const NPC_POOL = [
  { id: 'npc1', name: '面包师', emoji: '👨‍🍳' }, { id: 'npc2', name: '农夫', emoji: '👩‍🌾' },
  { id: 'npc3', name: '厨师', emoji: '👩‍🍳' }, { id: 'npc4', name: '孩子', emoji: '🧒' },
  { id: 'npc5', name: '老板娘', emoji: '👩' }, { id: 'npc6', name: '老爷爷', emoji: '👴' },
  { id: 'npc7', name: '奶奶', emoji: '👵' }, { id: 'npc8', name: '服务员', emoji: '🧑‍💼' },
  { id: 'npc9', name: '探险家', emoji: '🧭' }, { id: 'npc10', name: '诗人', emoji: '🎭' },
  { id: 'npc11', name: '骑士', emoji: '🦸' }, { id: 'npc12', name: '魔法师', emoji: '🧙' },
  { id: 'npc13', name: '渔夫', emoji: '🎣' }, { id: 'npc14', name: '商人', emoji: '🧳' },
  { id: 'npc15', name: '旅人', emoji: '🚶' }, { id: 'npc16', name: '猫娘', emoji: '🐱' }
];
const ORDER_VISIBLE_COUNT = 4;

// ---------- v4：订单价值与奖励（动态算法） ----------
// 每种最基础菜品（链 Lv1）的初始价值，用于推导链内/交叉合成价值
const BASE_ITEM_VALUES = {
  wheat: 1,
  milk: 1,
  lettuce: 1,
  egg: 1
};
// 订单奖励公式：骰子 = REWARD_DICE_BASE + floor(订单总价值 * REWARD_DICE_PER_VALUE)，经验同理
const REWARD_DICE_BASE = 0;
const REWARD_DICE_PER_VALUE = 1;
const REWARD_EXP_BASE = 0;
const REWARD_EXP_PER_VALUE = 2;

// v4：订单池权重（按「解锁等级」与「是否为本等级新解锁」区分）
// 本等级刚解锁的物品在订单中出现权重（提升新内容曝光）
const ORDER_WEIGHT_SAME_LEVEL = 14;
// 更早解锁的物品权重（可再细化为按解锁等级，见 ORDER_WEIGHT_BY_UNLOCK_LEVEL）
const ORDER_WEIGHT_OTHER = 5;
// 可选：按物品解锁等级单独配置（未配置时用 ORDER_WEIGHT_OTHER）
const ORDER_WEIGHT_BY_UNLOCK_LEVEL = {
  1: 6,
  2: 6,
  3: 5,
  4: 4
};

// ---------- v5/v6：批量合成（按厨师等级解锁，支持任意档位配置） ----------
// 批量档位配置：每项 { size: 数量, unlockChefLevel: 解锁所需厨师等级 }
// 显示规则：始终有×1；再取「材料足够且等级已解锁」中 size 最大的一个档位
const CRAFT_BATCH_OPTIONS = [
  { size: 2, unlockChefLevel: 2 },
  { size: 3, unlockChefLevel: 3 },
  { size: 5, unlockChefLevel: 4 }
];
