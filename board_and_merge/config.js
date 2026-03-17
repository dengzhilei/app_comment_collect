/**
 * Board & Merge - config
 * Board tiles: money (no effect in demo), energy (produce energy for merge).
 * Merge: 3 chains (crop lines), no cooking/cross recipes.
 */

// ---------- Board tile types: money (no effect) + energy (for merge) ----------
const TILE_TYPES = ['money', 'energy'];
const TILE_COUNTS = { money: 14, energy: 15 };
const TILE_EMOJI = { money: '\uD83D\uDCB0', energy: '\u26A1' };
const TILE_IMAGE = {};
// Energy per landing on energy tile = bet * ENERGY_PER_BET
const ENERGY_PER_BET = 2;

// ---------- Merge chains (需求v2: Wheat / Milk / Veggie 各5级) ----------
const CHAINS = {
  wheat: [
    { id: 'wheat1', name: '小麦', emoji: '\uD83C\uDF3E', img: 'img/order/OrderSystem_Wheet_item1.png' },
    { id: 'wheat2', name: '面粉', emoji: '\uD83E\uDDE1', img: 'img/order/OrderSystem_Wheet_item2.png' },
    { id: 'wheat3', name: '面包', emoji: '\uD83C\uDF5E', img: 'img/order/OrderSystem_Wheet_item3.png' },
    { id: 'wheat4', name: '三明治', emoji: '\uD83E\uDD6A', img: 'img/order/OrderSystem_Wheet_item4.png' },
    { id: 'wheat5', name: '汉堡', emoji: '\uD83C\uDF54', img: 'img/order/OrderSystem_Wheet_item5.png' }
  ],
  milk: [
    { id: 'milk1', name: '牛奶', emoji: '\uD83E\uDD5B', img: 'img/order/OrderSystem_Milk_item1.png' },
    { id: 'milk2', name: '黄油', emoji: '\uD83E\uDDC8', img: 'img/order/OrderSystem_Milk_item2.png' },
    { id: 'milk3', name: '三角芝士', emoji: '\uD83E\uDDC0', img: 'img/order/OrderSystem_Milk_item3.png' },
    { id: 'milk4', name: '车轮芝士', emoji: '\uD83E\uDDC0', img: 'img/order/OrderSystem_Milk_item4.png' },
    { id: 'milk5', name: '披萨', emoji: '\uD83C\uDF55', img: 'img/order/OrderSystem_Milk_item5.png' }
  ],
  veggie: [
    { id: 'veggie1', name: '番茄', emoji: '\uD83C\uDF45', img: 'img/order/OrderSystem_Vegetable_item1.png' },
    { id: 'veggie2', name: '生菜', emoji: '\uD83E\uDD6C', img: 'img/order/OrderSystem_Vegetable_item2.png' },
    { id: 'veggie3', name: '沙拉', emoji: '\uD83F\uDF57', img: 'img/order/OrderSystem_Vegetable_item3.png' },
    { id: 'veggie4', name: '蔬菜拼盘', emoji: '\uD83E\uDD6D', img: 'img/order/OrderSystem_Vegetable_item4.png' },
    { id: 'veggie5', name: '普罗旺斯炖菜', emoji: '\uD83C\uDF73', img: 'img/order/OrderSystem_Vegetable_item5.png' }
  ]
};

const CHAIN_KEYS = ['wheat', 'milk', 'veggie'];
const BASE_ITEM_IDS = CHAIN_KEYS.map(function(k) { return CHAINS[k][0].id; });

// Merge: 2 same items -> next level
const CHAIN_RECIPES = {
  wheat2: { from: 'wheat1', count: 2 },
  wheat3: { from: 'wheat2', count: 2 },
  wheat4: { from: 'wheat3', count: 2 },
  wheat5: { from: 'wheat4', count: 2 },
  milk2: { from: 'milk1', count: 2 },
  milk3: { from: 'milk2', count: 2 },
  milk4: { from: 'milk3', count: 2 },
  milk5: { from: 'milk4', count: 2 },
  veggie2: { from: 'veggie1', count: 2 },
  veggie3: { from: 'veggie2', count: 2 },
  veggie4: { from: 'veggie3', count: 2 },
  veggie5: { from: 'veggie4', count: 2 }
};

// ---------- Board (same path as v3) ----------
const BOARD_CELLS = 40;
const HOLLOW_GRID_SIZE = 11;
const PATH_GRID = [
  [0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],
  [1,10],[2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],
  [10,9],[10,8],[10,7],[10,6],[10,5],[10,4],[10,3],[10,2],[10,1],[10,0],
  [9,0],[8,0],[7,0],[6,0],[5,0],[4,0],[3,0],[2,0],[1,0]
];
const BOARD_VIEWPORT_CELLS = 8;
const DICE_PER_ROLL = 2;
const BOARD_AIRPORT_PATH_INDICES = [5, 15, 25, 35];
const BOARD_CORNER_PATH_INDICES = [0, 10, 20, 30];
const BOARD_GO_PATH_INDEX = 30;
const BOARD_QUESTION_PATH_INDICES = [12, 26, 37];
const BET_OPTIONS = [1, 2, 3, 5, 10];

// ---------- Merge grid ----------
const MERGE_GRID_ROWS = 5;
const MERGE_GRID_COLS = 5;
const MERGE_SPAWN_ENERGY_COST = 1;
// 生成器有概率直接出高级作物，此概率下触发 Lucky 飘字
const MERGE_SPAWN_ADVANCED_PROB = 0.25;

// ---------- Orders (chain items only), 3 slots, NPC 可重复 ----------
const NPC_POOL = [
  { id: 'npc1', name: 'NPC1', emoji: '\uD83E\uDDD1', img: 'img/npc/OrderSystem_NPC_1.png' },
  { id: 'npc2', name: 'NPC2', emoji: '\uD83E\uDDD1', img: 'img/npc/OrderSystem_NPC_2.png' }
];
const ORDER_VISIBLE_COUNT = 3;
const BASE_ITEM_VALUES = { wheat1: 1, milk1: 1, veggie1: 1 };
const REWARD_DICE_BASE = 1;
const REWARD_DICE_PER_VALUE = 0.8;
const REWARD_EXP_BASE = 4;
const REWARD_EXP_PER_VALUE = 0.6;
const CHEF_EXP_THRESHOLDS = [50, 150, 300];
const CHEF_LEVEL_CHAIN_MAX = {
  1: { wheat: 2, milk: 2, veggie: 2 },
  2: { wheat: 3, milk: 3, veggie: 3 },
  3: { wheat: 4, milk: 4, veggie: 4 },
  4: { wheat: 5, milk: 5, veggie: 5 }
};
const ORDER_WEIGHT_SAME_LEVEL = 14;
const ORDER_WEIGHT_OTHER = 5;
