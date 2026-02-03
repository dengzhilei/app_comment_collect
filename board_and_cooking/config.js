/**
 * Board & Cooking - 配置常量
 */

const TILE_TYPES = ['wheat', 'milk', 'egg', 'tomato'];
const TILE_EMOJI = { wheat: '🌾', milk: '🥛', egg: '🥚', tomato: '🍅' };
const TILE_GAIN = { wheat: 'wheat', milk: 'milk', egg: 'egg', tomato: 'tomato' };

const BOARD_CELLS = 16;
const HOLLOW_GRID_SIZE = 5;
const PATH_GRID = [
  [0,0],[0,1],[0,2],[0,3],[0,4], [1,4],[2,4],[3,4], [4,4],[4,3],[4,2],[4,1],[4,0], [3,0],[2,0],[1,0]
];

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
    { id: 'tomato', name: '番茄', emoji: '🍅' },
    { id: 'lettuce', name: '生菜', emoji: '🥬' },
    { id: 'potato', name: '土豆', emoji: '🥔' }
  ],
  protein: [
    { id: 'egg', name: '鸡蛋', emoji: '🥚' },
    { id: 'drumstick', name: '鸡腿', emoji: '🍗' },
    { id: 'steak', name: '牛排', emoji: '🥩' }
  ]
};

const CHAIN_RECIPES = {
  flour: { from: 'wheat', count: 2 },
  bread: { from: 'flour', count: 2 },
  butter: { from: 'milk', count: 2 },
  cheese: { from: 'butter', count: 2 },
  lettuce: { from: 'tomato', count: 2 },
  potato: { from: 'lettuce', count: 2 },
  drumstick: { from: 'egg', count: 2 },
  steak: { from: 'drumstick', count: 2 }
};

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

const BASE_ITEM_IDS = ['wheat', 'milk', 'egg', 'tomato'];
