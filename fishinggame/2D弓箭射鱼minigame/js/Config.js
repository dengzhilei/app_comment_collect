// 游戏配置
const CONFIG = {
    GAME_DURATION: 45,
    SPAWN_RATE_INITIAL: 60,
    MAX_CHARGE: 100,
    CHARGE_SPEED: 2,
    ARROW_SPEED_BASE: 8,        
    ARROW_SPEED_MULTIPLIER: 0.25, 
    GRAVITY: 0.4,               
    FEVER_THRESHOLD: 5,
    FEVER_DURATION: 5,
    BOSS_SPAWN_TIME: 20,    // 提前到 20s 登场，给玩家更充裕的时间
    BOSS_HP_PER_TENTACLE: 2, // 降低触手血量，减少枯燥点击
    BOSS_CORE_HP: 20, 
    
    // 道具配置
    BUBBLE_SPAWN_RATE: 300, 
    BUBBLE_CHANCE: 0.5,     
    POWERUP_DURATION: 6     
};

const FISH_TYPES = [
    { id: 1, name: '小丑鱼', color: '#FF4136', speed: 3, score: 10, radius: 15, spawnWeight: 0.5, effect: 'normal', hp: 1 },
    { id: 2, name: '金枪鱼', color: '#7FDBFF', speed: 2, score: 30, radius: 25, spawnWeight: 0.25, effect: 'normal', hp: 1 },
    { id: 3, name: '黄金鲨', color: '#FFDC00', speed: 1, score: 100, radius: 40, spawnWeight: 0.05, effect: 'normal', hp: 3 }, 
    { id: 4, name: '时间鱼', color: '#2ECC40', speed: 2.5, score: 50, radius: 20, spawnWeight: 0.1, effect: 'time', hp: 1 },
    { id: 5, name: '炸弹河豚', color: '#B10DC9', speed: 1.5, score: -50, radius: 30, spawnWeight: 0.1, effect: 'bomb', hp: 1 }
];

// 道具类型
const POWERUPS = [
    { type: 'split', color: '#0074D9', symbol: '🔱', name: '三叉戟' }, // 散射
    { type: 'laser', color: '#F012BE', symbol: '⚡', name: '激光' }    // 激光
];