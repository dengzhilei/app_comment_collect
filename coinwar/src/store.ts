import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { generateDice } from './diceRules';

export const BOARD_SIZE = 40;

export function getHalfGrid(boardSize: number): number {
  const gridSize = (boardSize + 4) / 4;
  return Math.floor(gridSize / 2);
}

export function getTilePosition(index: number, boardSize: number = BOARD_SIZE): [number, number, number] {
  const gridSize = (boardSize + 4) / 4;
  const halfGrid = Math.floor(gridSize / 2);
  const side = gridSize - 1;

  if (index <= side) {
    return [halfGrid - index, 0, halfGrid];
  }
  if (index <= 2 * side) {
    return [-halfGrid, 0, halfGrid - (index - side)];
  }
  if (index <= 3 * side) {
    return [-(halfGrid - (index - 2 * side)), 0, -halfGrid];
  }
  return [halfGrid, 0, -halfGrid + (index - 3 * side)];
}

export type TileType = 'bank' | 'normal' | 'bonus_10' | 'bonus_x2' | 'attack';

export type GameMode = 'classic' | 'strict_bank';
export type TurnMode = 'simultaneous' | 'turn-based';
export type CameraMode = 'follow' | 'isometric' | 'top-down';

export type GameSettings = {
  boardSize: number;
  playerCount: number;
  trapDropPercentage: number;
  stealPercentage: number;
  turnMode: TurnMode;
  aiDelay: boolean;
  winTarget: number;
  bankCount: number;
  trapCount: number;
  bonus10Count: number;
  bonusX2Count: number;
  attackCount: number;
  attackDamage: number;
  carryLimit: number;
};

export type Player = {
  id: string;
  isAI: boolean;
  position: number;
  stepsRemaining: number;
  carriedCoins: number;
  bankedCoins: number;
  color: string;
  cooldown: number;
  diceResult: [number, number] | null;
  nextDiceResult: [number, number] | null;
  autoRollAt: number | null;
  message: string | null;
  messageTimeout: number;
};

export type Trap = {
  id: string;
  position: number;
};

export type DroppedCoin = {
  id: string;
  position: number;
  amount: number;
};

export type FlyingCoin = {
  id: string;
  startPos: [number, number, number];
  endPos: [number, number, number];
  startTime: number;
  duration: number;
  color?: string;
  scale?: number;
};

export type TileFlash = {
  position: number;
  color: string;
  until: number;
};

// 游戏全局状态管理 (Zustand)
export type GameState = {
  players: Player[]; // 所有玩家数据（包含人类和AI）
  tiles: TileType[]; // 棋盘格子类型数据
  traps: Trap[]; // 场上存在的陷阱
  droppedCoins: DroppedCoin[]; // 场上掉落的金币
  flyingCoins: FlyingCoin[]; // 正在飞行的金币动画数据
  tileFlashes: TileFlash[]; // 地格闪烁特效
  winner: string | null; // 获胜者 ID
  gameMode: GameMode | null; // 当前游戏模式
  settings: GameSettings; // 游戏设置
  currentPlayerIndex: number; // 当前回合玩家索引（仅在轮流模式下有效）
  autoSpin: boolean; // 是否开启自动掷骰子（针对人类玩家）
  gameId: number; // 游戏局数计数器，用于重置时强制刷新 3D 组件
  cameraMode: CameraMode; // 当前摄像机视角
  pauseUntil: number; // 暂停游戏逻辑直到指定时间戳
  countdownUntil: number; // 开局倒计时结束时间戳（0 = 无倒计时）
  
  // 设置暂停时间
  setPauseUntil: (time: number) => void;
  // 初始化游戏，生成地图和陷阱
  initGame: (mode: GameMode, settings: GameSettings) => void;
  // 返回主菜单
  resetToMenu: () => void;
  // 切换自动掷骰子
  toggleAutoSpin: () => void;
  // 切换摄像机视角
  setCameraMode: (mode: CameraMode) => void;
  // 掷骰子逻辑
  rollDice: (playerId: string) => void;
  // GM：设置指定玩家下一次骰子结果
  setNextDice: (playerId: string, dice: [number, number] | null) => void;
  // 游戏主循环 tick，每秒触发多次，处理移动、AI决策、陷阱等
  tick: () => void;
};

// 在 available 位置中均匀选取 count 个位置
function distributeEvenly(available: number[], count: number): number[] {
  if (count <= 0) return [];
  const n = available.length;
  if (count >= n) return [...available];
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i + 0.5) * n / count);
    result.push(available[idx]);
  }
  return result;
}

function generateTiles(mode: GameMode, settings: GameSettings): TileType[] {
  const bs = settings.boardSize;
  const tiles: TileType[] = Array(bs).fill('normal');
  const all = Array.from({ length: bs }, (_, i) => i);

  tiles[0] = 'bank';
  if (settings.bankCount > 1) {
    const avail = all.filter(i => tiles[i] === 'normal');
    distributeEvenly(avail, settings.bankCount - 1).forEach(p => { tiles[p] = 'bank'; });
  }

  let avail = all.filter(i => tiles[i] === 'normal');
  distributeEvenly(avail, settings.bonus10Count).forEach(p => { tiles[p] = 'bonus_10'; });

  avail = all.filter(i => tiles[i] === 'normal');
  distributeEvenly(avail, settings.bonusX2Count).forEach(p => { tiles[p] = 'bonus_x2'; });

  avail = all.filter(i => tiles[i] === 'normal');
  distributeEvenly(avail, settings.attackCount).forEach(p => { tiles[p] = 'attack'; });

  return tiles;
}

function generateTraps(tiles: TileType[], trapCount: number): Trap[] {
  const avail = Array.from({ length: tiles.length }, (_, i) => i).filter(i => tiles[i] === 'normal');
  return distributeEvenly(avail, trapCount).map(pos => ({ id: uuidv4(), position: pos }));
}

export const useGameStore = create<GameState>((set, get) => ({
  players: [],
  tiles: [],
  traps: [],
  droppedCoins: [],
  flyingCoins: [],
  tileFlashes: [],
  winner: null,
  gameMode: null,
  settings: {
    boardSize: 32,
    playerCount: 3,
    trapDropPercentage: 50,
    stealPercentage: 50,
    turnMode: 'simultaneous',
    aiDelay: false,
    winTarget: 250,
    bankCount: 6,
    trapCount: 9,
    bonus10Count: 4,
    bonusX2Count: 1,
    attackCount: 2,
    attackDamage: 20,
    carryLimit: 60
  },
  currentPlayerIndex: 0,
  autoSpin: false,
  gameId: 0,
  cameraMode: 'isometric',
  pauseUntil: 0,
  countdownUntil: 0,

  setPauseUntil: (time: number) => set({ pauseUntil: time }),
  resetToMenu: () => set({ gameMode: null, players: [], winner: null }),
  toggleAutoSpin: () => set(state => {
    const newAutoSpin = !state.autoSpin;
    let newPlayers = [...state.players];
    if (newAutoSpin) {
      // 如果开启了自动掷骰子，将人类玩家的等待时间立即清零
      newPlayers = newPlayers.map(p => 
        !p.isAI && p.autoRollAt !== null ? { ...p, autoRollAt: Date.now() } : p
      );
    }
    return { autoSpin: newAutoSpin, players: newPlayers };
  }),
  setCameraMode: (mode: CameraMode) => set({ cameraMode: mode }),

  initGame: (mode: GameMode, settings: GameSettings) => {
    const newTiles = generateTiles(mode, settings);
    const initialTraps = generateTraps(newTiles, settings.trapCount);

    const PLAYER_COLORS = ['#3b82f6', '#ef4444', '#10b981'];
    const players: Player[] = [];
    for (let i = 0; i < settings.playerCount; i++) {
      players.push({
        id: `p${i + 1}`,
        isAI: i > 0,
        position: 0, stepsRemaining: 0,
        carriedCoins: 0, bankedCoins: 0,
        color: PLAYER_COLORS[i],
        cooldown: 0, diceResult: null, nextDiceResult: null,
        autoRollAt: null, message: null, messageTimeout: 0
      });
    }

    const countdownEnd = Date.now() + 3500;
    set(state => ({
      gameId: state.gameId + 1,
      gameMode: mode,
      settings,
      currentPlayerIndex: 0,
      players,
      tiles: newTiles,
      traps: initialTraps,
      droppedCoins: [],
      flyingCoins: [],
      tileFlashes: [],
      winner: null,
      countdownUntil: countdownEnd,
      pauseUntil: countdownEnd
    }));
  },

  setNextDice: (playerId: string, dice: [number, number] | null) => {
    set(state => ({
      players: state.players.map(p => p.id === playerId ? { ...p, nextDiceResult: dice } : p)
    }));
  },

  rollDice: (playerId: string) => {
    const state = get();
    if (state.winner) return;
    if (Date.now() < state.pauseUntil) return;
    
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    const player = state.players[playerIndex];
    if (!player || player.stepsRemaining > 0) return;

    // 如果是轮流模式，检查是否轮到该玩家，且本回合尚未掷过骰子
    if (state.settings.turnMode === 'turn-based') {
      if (state.currentPlayerIndex !== playerIndex) return;
      if (player.diceResult !== null) return;
    }

    // 如果是同时模式，检查冷却时间
    if (state.settings.turnMode === 'simultaneous' && player.cooldown > Date.now()) {
      return;
    }

    let d1: number, d2: number;
    if (player.nextDiceResult) {
      [d1, d2] = player.nextDiceResult;
    } else {
      [d1, d2] = generateDice(player, state.players, state.tiles, state.traps, state.gameMode, state.settings.boardSize, state.settings.turnMode, state.settings);
    }
    const steps = d1 + d2;

    set(state => ({
      players: state.players.map(p => 
        p.id === playerId 
          ? { ...p, stepsRemaining: p.stepsRemaining + steps, cooldown: Date.now() + 1000, diceResult: [d1, d2], nextDiceResult: null, autoRollAt: null } 
          : p
      )
    }));
  },

  // 游戏主循环：处理移动、AI 决策、触发事件
  tick: () => {
    const state = get();
    if (state.winner) return;
    if (Date.now() < state.pauseUntil) return;

    const bs = state.settings.boardSize;
    let newPlayers = [...state.players];
    let newTraps = [...state.traps];
    let newDroppedCoins = [...state.droppedCoins];
    let newFlyingCoins = [...state.flyingCoins];
    let newTileFlashes = [...state.tileFlashes];
    let newWinner = state.winner;
    let newCurrentPlayerIndex = state.currentPlayerIndex;
    const now = Date.now();

    // 在轮流模式下，如果当前玩家行动完毕且冷却时间已过，则切换到下一个玩家
    if (state.settings.turnMode === 'turn-based') {
      const currentPlayer = newPlayers[state.currentPlayerIndex];
      // 确保玩家已经掷过骰子（diceResult !== null）且行动完毕（stepsRemaining === 0）且冷却时间已过
      // 并且只有在没有获胜者的情况下才切换
      // 还需要确保没有任何玩家正在移动（防止因为挤走机制导致其他玩家还在移动）
      const isAnyoneMoving = newPlayers.some(p => p.stepsRemaining > 0);
      if (!isAnyoneMoving && currentPlayer.diceResult !== null && currentPlayer.stepsRemaining === 0 && currentPlayer.cooldown < now && !state.winner) {
        newCurrentPlayerIndex = (state.currentPlayerIndex + 1) % newPlayers.length;
        
        // 清除老玩家的 diceResult
        newPlayers[state.currentPlayerIndex] = {
          ...newPlayers[state.currentPlayerIndex],
          diceResult: null
        };

        // 给新玩家一点冷却时间，用于摄像机强切和视觉缓冲，并重置其 diceResult
        newPlayers[newCurrentPlayerIndex] = {
          ...newPlayers[newCurrentPlayerIndex],
          cooldown: now + 500,
          diceResult: null
        };
      }
    }

    // 在实时模式下，玩家行动完毕且冷却结束后，清除 diceResult 以允许下一次掷骰
    if (state.settings.turnMode === 'simultaneous') {
      newPlayers = newPlayers.map(p => {
        if (p.stepsRemaining === 0 && p.diceResult !== null && p.cooldown < now) {
          return { ...p, diceResult: null };
        }
        return p;
      });
    }

    // 1. 生成预计算的骰子结果（nextDiceResult）和自动掷骰时间（autoRollAt）
    newPlayers = newPlayers.map((p, i) => {
      const isMyTurn = state.settings.turnMode === 'simultaneous' || newCurrentPlayerIndex === i;
      
      if (isMyTurn && p.stepsRemaining === 0 && p.diceResult === null && p.nextDiceResult === null && p.cooldown < now) {
        // 确保在轮流模式下，没有任何玩家正在移动
        if (state.settings.turnMode === 'turn-based') {
          const isAnyoneMoving = newPlayers.some(otherPlayer => otherPlayer.stepsRemaining > 0);
          if (isAnyoneMoving) return p;
        }

        const [d1, d2] = generateDice(p, newPlayers, state.tiles, newTraps, state.gameMode, bs, state.settings.turnMode, state.settings);
        
        // 决定延迟时间
        const isHumanAutoSpin = !p.isAI && state.autoSpin;
        let delay = 0;
        if (isHumanAutoSpin) {
          delay = 0; // 自动掷骰子：立即执行
        } else if (p.isAI) {
          delay = state.settings.aiDelay ? Math.random() * 2000 : 0; // AI：根据设置决定是否有0-2秒随机延迟
        } else {
          delay = 5000; // 人类玩家：5秒倒计时
        }

        return { ...p, nextDiceResult: [d1, d2], autoRollAt: now + delay };
      }
      return p;
    });

    // 2. 处理自动掷骰子（当时间到达 autoRollAt 时）
    newPlayers = newPlayers.map((p, i) => {
      const isMyTurn = state.settings.turnMode === 'simultaneous' || newCurrentPlayerIndex === i;
      
      if (isMyTurn && p.nextDiceResult !== null && p.autoRollAt !== null && now >= p.autoRollAt) {
        // 确保在轮流模式下，没有任何玩家正在移动
        if (state.settings.turnMode === 'turn-based') {
          const isAnyoneMoving = newPlayers.some(otherPlayer => otherPlayer.stepsRemaining > 0);
          if (isAnyoneMoving) return p;
        }

        const steps = p.nextDiceResult[0] + p.nextDiceResult[1];
        return { 
          ...p, 
          stepsRemaining: steps, 
          cooldown: now + 1000, 
          diceResult: p.nextDiceResult,
          nextDiceResult: null,
          autoRollAt: null
        };
      }
      return p;
    });

    // Process movement
    for (let i = 0; i < newPlayers.length; i++) {
      const p = newPlayers[i];
      const justRolledThisTick = p.diceResult !== null && state.players[i].diceResult === null;
      if (p.stepsRemaining > 0 && !justRolledThisTick) {
        const nextPos = (p.position + 1) % state.settings.boardSize;
        let newCarried = p.carriedCoins + 1; // 1 coin per step
        let newBanked = p.bankedCoins;
        let newMessage = p.message;
        let newMessageTimeout = p.messageTimeout;

        let newCooldown = p.cooldown;

        // Check picking up dropped coins
        const coinsHere = newDroppedCoins.filter(c => c.position === nextPos);
        if (coinsHere.length > 0) {
          const totalAmount = coinsHere.reduce((sum, c) => sum + c.amount, 0);
          
          // Spawn flying coins from ground to backpack
          const numCoinsToFly = Math.min(totalAmount, 15);
          const tilePos = getTilePosition(nextPos, bs);
          for (let c = 0; c < numCoinsToFly; c++) {
            const duration = 400 + Math.random() * 200;
            newFlyingCoins.push({
              id: uuidv4(),
              startPos: [
                tilePos[0] + (Math.random() - 0.5) * 1.5,
                0.1, // Ground
                tilePos[2] + (Math.random() - 0.5) * 1.5
              ],
              endPos: [
                tilePos[0] + (Math.random() - 0.5) * 0.5,
                1.5 + Math.random(), // Backpack
                tilePos[2] + (Math.random() - 0.5) * 0.5
              ],
              startTime: now + c * 50,
              duration: duration
            });
          }

          newCarried += totalAmount;
          newDroppedCoins = newDroppedCoins.filter(c => c.position !== nextPos);
          newMessage = `Picked up ${totalAmount}!`;
          newMessageTimeout = now + 2000;
        }

        // Stealing from other players on the same tile
        if (state.settings.stealPercentage > 0) {
          for (let j = 0; j < newPlayers.length; j++) {
            if (i !== j && newPlayers[j].position === nextPos) {
              const stealAmount = Math.floor(newPlayers[j].carriedCoins * (state.settings.stealPercentage / 100));
              if (stealAmount > 0) {
                // Spawn flying coins for stealing
                const numCoinsToFly = Math.min(stealAmount, 15);
                const tilePos = getTilePosition(nextPos, bs);
                for (let c = 0; c < numCoinsToFly; c++) {
                  const duration = 500 + Math.random() * 200;
                  newFlyingCoins.push({
                    id: uuidv4(),
                    startPos: [
                      tilePos[0] + (Math.random() - 0.5) * 1.5,
                      1.5 + Math.random(), // Victim's backpack
                      tilePos[2] + (Math.random() - 0.5) * 1.5
                    ],
                    endPos: [
                      tilePos[0] + (Math.random() - 0.5) * 0.5,
                      1.5 + Math.random(), // Thief's backpack
                      tilePos[2] + (Math.random() - 0.5) * 0.5
                    ],
                    startTime: now + c * 50,
                    duration: duration
                  });
                }

                newCarried += stealAmount;
                newMessage = `Stole ${stealAmount}!`;
                newMessageTimeout = now + 2000;
                newPlayers[j] = {
                  ...newPlayers[j],
                  carriedCoins: newPlayers[j].carriedCoins - stealAmount,
                  message: `Lost ${stealAmount}!`,
                  messageTimeout: now + 2000
                };
              }
            }
          }
        }

        // Passing bank in classic mode
        if (state.gameMode === 'classic' && state.tiles[nextPos] === 'bank') {
          if (newCarried > 0) {
            // Spawn flying coins
            const numCoinsToFly = Math.min(newCarried, 20); // Cap visual coins
            const startPos = getTilePosition(0, bs);
            const endPos = getTilePosition(0, bs);
            for (let c = 0; c < numCoinsToFly; c++) {
              const duration = 600 + Math.random() * 200;
              newFlyingCoins.push({
                id: uuidv4(),
                startPos: [
                  startPos[0] + (Math.random() - 0.5) * 1.5,
                  1.5 + Math.random(), // Start high up (like flying out of backpack)
                  startPos[2] + (Math.random() - 0.5) * 1.5
                ],
                endPos: [
                  endPos[0] + (Math.random() - 0.5) * 0.5,
                  0.1,
                  endPos[2] + (Math.random() - 0.5) * 0.5
                ],
                startTime: now + c * 50,
                duration: duration
              });
            }

            newBanked += newCarried;
            newCarried = 0;
            newMessage = `Banked!`;
            newMessageTimeout = now + 2000;
            if (newBanked >= state.settings.winTarget) {
              newWinner = p.id;
            }
          }
        }

        const isLastStep = p.stepsRemaining === 1;
        
        // Landing effects
        if (isLastStep) {
          newCooldown = now + 1000;
          const tile = state.tiles[nextPos];
          
          // Landing on bank in strict mode
          if (state.gameMode === 'strict_bank' && tile === 'bank') {
            if (newCarried > 0) {
              // Spawn flying coins
              const numCoinsToFly = Math.min(newCarried, 20); // Cap visual coins
              const startPos = getTilePosition(nextPos, bs);
              const endPos = getTilePosition(nextPos, bs);
              for (let c = 0; c < numCoinsToFly; c++) {
                const duration = 600 + Math.random() * 200;
                newFlyingCoins.push({
                  id: uuidv4(),
                  startPos: [
                    startPos[0] + (Math.random() - 0.5) * 1.5,
                    1.5 + Math.random(), // Start high up (like flying out of backpack)
                    startPos[2] + (Math.random() - 0.5) * 1.5
                  ],
                  endPos: [
                    endPos[0] + (Math.random() - 0.5) * 0.5,
                    0.1,
                    endPos[2] + (Math.random() - 0.5) * 0.5
                  ],
                  startTime: now + c * 50,
                  duration: duration
                });
              }

              newBanked += newCarried;
              newCarried = 0;
              newMessage = `Banked!`;
              newMessageTimeout = now + 2000;
              if (newBanked >= state.settings.winTarget) {
                newWinner = p.id;
              }
            }
          }

          if (tile === 'bonus_10') {
            newCarried += 5;
            newMessage = `+5!`;
            newMessageTimeout = now + 2000;
          }

          if (tile === 'bonus_x2') {
            newCarried = newCarried * 2;
            newMessage = `x2!`;
            newMessageTimeout = now + 2000;
          }

          if (tile === 'attack') {
            const others = newPlayers
              .map((op, idx) => ({ op, idx }))
              .filter(({ idx }) => idx !== i);
            if (others.length > 0) {
              const target = others.reduce((a, b) => a.op.bankedCoins >= b.op.bankedCoins ? a : b);
              const dmg = Math.min(target.op.bankedCoins, state.settings.attackDamage);
              const targetLabel = newPlayers[target.idx].isAI ? 'AI ' + newPlayers[target.idx].id : 'You';
              if (dmg > 0) {
                const tPos = getTilePosition(target.op.position, bs);
                const numCoinsToFly = Math.min(dmg, 20);
                for (let c = 0; c < numCoinsToFly; c++) {
                  const angle = (c / numCoinsToFly) * Math.PI * 2 + Math.random() * 0.5;
                  const radius = 1.5 + Math.random() * 2;
                  const duration = 600 + Math.random() * 400;
                  newFlyingCoins.push({
                    id: uuidv4(),
                    startPos: [
                      tPos[0] + (Math.random() - 0.5) * 0.5,
                      1.5 + Math.random() * 0.5,
                      tPos[2] + (Math.random() - 0.5) * 0.5
                    ],
                    endPos: [
                      tPos[0] + Math.cos(angle) * radius,
                      3 + Math.random() * 2,
                      tPos[2] + Math.sin(angle) * radius
                    ],
                    startTime: now + c * 30,
                    duration,
                    color: '#ef4444',
                    scale: 1.3
                  });
                }
                newPlayers[target.idx] = {
                  ...newPlayers[target.idx],
                  bankedCoins: newPlayers[target.idx].bankedCoins - dmg,
                  message: `Bank -${dmg}!`,
                  messageTimeout: now + 2500
                };
                newMessage = `Demolish! ${targetLabel} bank -${dmg}`;
                newTileFlashes.push({ position: nextPos, color: '#ef4444', until: now + 1000 });
                newTileFlashes.push({ position: target.op.position, color: '#ef4444', until: now + 1200 });
              } else {
                newMessage = `Demolish missed! ${targetLabel} bank = 0`;
                newTileFlashes.push({ position: nextPos, color: '#fb923c', until: now + 600 });
              }
              newMessageTimeout = now + 2000;
            }
          }

          // Check trap
          const trapIdx = newTraps.findIndex(t => t.position === nextPos);
          if (trapIdx !== -1) {
            const trap = newTraps[trapIdx];
            
            const dropAmount = Math.floor(newCarried * (state.settings.trapDropPercentage / 100));
            newCarried -= dropAmount;
            if (dropAmount > 0) {
              // Distribute coins behind the player (1 to 3 tiles back)
              const part1 = Math.floor(dropAmount / 3);
              const part2 = Math.floor(dropAmount / 3);
              const part3 = dropAmount - part1 - part2;
              
              const startTilePos = getTilePosition(nextPos, bs);
              const spawnDroppedCoins = (amount: number, offset: number) => {
                if (amount <= 0) return;
                const dropPos = (nextPos - offset + state.settings.boardSize) % state.settings.boardSize;
                newDroppedCoins.push({ id: uuidv4(), position: dropPos, amount });
                
                const endTilePos = getTilePosition(dropPos, bs);
                const numCoinsToFly = Math.min(amount, 10);
                for (let c = 0; c < numCoinsToFly; c++) {
                  const duration = 500 + Math.random() * 200;
                  newFlyingCoins.push({
                    id: uuidv4(),
                    startPos: [
                      startTilePos[0] + (Math.random() - 0.5) * 0.5,
                      1.5 + Math.random(), // Backpack
                      startTilePos[2] + (Math.random() - 0.5) * 0.5
                    ],
                    endPos: [
                      endTilePos[0] + (Math.random() - 0.5) * 1.5,
                      0.1, // Ground
                      endTilePos[2] + (Math.random() - 0.5) * 1.5
                    ],
                    startTime: now + c * 50,
                    duration: duration
                  });
                }
              };

              spawnDroppedCoins(part1, 1);
              spawnDroppedCoins(part2, 2);
              spawnDroppedCoins(part3, 3);
            }
            newMessage = `Trapped! Lost ${state.settings.trapDropPercentage}%!`;
            newMessageTimeout = now + 2000;
          }
        }

        newCarried = Math.min(newCarried, state.settings.carryLimit);

        newPlayers[i] = {
          ...p,
          position: nextPos,
          stepsRemaining: p.stepsRemaining - 1,
          carriedCoins: newCarried,
          bankedCoins: newBanked,
          message: newMessage,
          messageTimeout: newMessageTimeout,
          cooldown: newCooldown
        };
      } else {
        // Clear message if expired
        if (p.message && p.messageTimeout < now) {
          newPlayers[i] = { ...p, message: null };
        }
      }
    }

    newFlyingCoins = newFlyingCoins.filter(c => now < c.startTime + c.duration);
    newTileFlashes = newTileFlashes.filter(f => now < f.until);

    set({
      players: newPlayers,
      traps: newTraps,
      droppedCoins: newDroppedCoins,
      flyingCoins: newFlyingCoins,
      tileFlashes: newTileFlashes,
      winner: newWinner,
      currentPlayerIndex: newCurrentPlayerIndex
    });
  }
}));
