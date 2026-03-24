import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';

export const BOARD_SIZE = 40;
export const GRID_SIZE = 11;
export const HALF_GRID = Math.floor(GRID_SIZE / 2); // 5

export function getTilePosition(index: number): [number, number, number] {
  // 改为顺时针方向：反转 X 轴坐标
  if (index <= 10) {
    return [HALF_GRID - index, 0, HALF_GRID];
  }
  if (index <= 20) {
    return [-HALF_GRID, 0, HALF_GRID - (index - 10)];
  }
  if (index <= 30) {
    return [-(HALF_GRID - (index - 20)), 0, -HALF_GRID];
  }
  return [HALF_GRID, 0, -HALF_GRID + (index - 30)];
}

export type TileType = 'bank' | 'normal' | 'bonus';

export type GameMode = 'classic' | 'strict_bank';
export type TurnMode = 'simultaneous' | 'turn-based';
export type CameraMode = 'follow' | 'isometric' | 'top-down';

export type GameSettings = {
  trapDropPercentage: number;
  stealPercentage: number;
  turnMode: TurnMode;
  aiDelay: boolean;
  winTarget: number;
};

export type Player = {
  id: string;
  isAI: boolean;
  position: number;
  visualPosition: number;
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
};

// 游戏全局状态管理 (Zustand)
export type GameState = {
  players: Player[]; // 所有玩家数据（包含人类和AI）
  tiles: TileType[]; // 棋盘格子类型数据
  traps: Trap[]; // 场上存在的陷阱
  droppedCoins: DroppedCoin[]; // 场上掉落的金币
  flyingCoins: FlyingCoin[]; // 正在飞行的金币动画数据
  winner: string | null; // 获胜者 ID
  gameMode: GameMode | null; // 当前游戏模式
  settings: GameSettings; // 游戏设置
  currentPlayerIndex: number; // 当前回合玩家索引（仅在轮流模式下有效）
  autoSpin: boolean; // 是否开启自动掷骰子（针对人类玩家）
  gameId: number; // 游戏局数计数器，用于重置时强制刷新 3D 组件
  cameraMode: CameraMode; // 当前摄像机视角
  pauseUntil: number; // 暂停游戏逻辑直到指定时间戳
  
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
  // 游戏主循环 tick，每秒触发多次，处理移动、AI决策、陷阱等
  tick: () => void;
};

function generateTiles(mode: GameMode): TileType[] {
  const tiles: TileType[] = Array(BOARD_SIZE).fill('normal');
  
  if (mode === 'classic') {
    tiles[0] = 'bank';
  } else {
    // Strict bank mode: 6 banks distributed evenly
    [0, 7, 13, 20, 27, 33].forEach(i => tiles[i] = 'bank');
  }
  
  // Fixed bonus tiles (5 tiles evenly distributed)
  [4, 10, 17, 24, 30].forEach(i => {
    if (tiles[i] === 'normal') {
      tiles[i] = 'bonus';
    }
  });
  
  return tiles;
}

const FIXED_TRAP_POSITIONS = [3, 8, 12, 18, 23, 28, 34, 38];

export const useGameStore = create<GameState>((set, get) => ({
  players: [],
  tiles: [],
  traps: [],
  droppedCoins: [],
  flyingCoins: [],
  winner: null,
  gameMode: null,
  settings: {
    trapDropPercentage: 50,
    stealPercentage: 50,
    turnMode: 'turn-based',
    aiDelay: false,
    winTarget: 200
  },
  currentPlayerIndex: 0,
  autoSpin: false,
  gameId: 0,
  cameraMode: 'isometric',
  pauseUntil: 0,

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
    const newTiles = generateTiles(mode);
    const initialTraps: Trap[] = FIXED_TRAP_POSITIONS.map(pos => ({
      id: uuidv4(),
      position: pos
    }));

    set(state => ({
      gameId: state.gameId + 1,
      gameMode: mode,
      settings,
      currentPlayerIndex: 0,
      players: [
        { id: 'p1', isAI: false, position: 0, visualPosition: 0, stepsRemaining: 0, carriedCoins: 0, bankedCoins: 0, color: '#3b82f6', cooldown: 0, diceResult: null, nextDiceResult: null, autoRollAt: null, message: null, messageTimeout: 0 },
        { id: 'p2', isAI: true, position: 0, visualPosition: 0, stepsRemaining: 0, carriedCoins: 0, bankedCoins: 0, color: '#ef4444', cooldown: 0, diceResult: null, nextDiceResult: null, autoRollAt: null, message: null, messageTimeout: 0 },
        { id: 'p3', isAI: true, position: 0, visualPosition: 0, stepsRemaining: 0, carriedCoins: 0, bankedCoins: 0, color: '#10b981', cooldown: 0, diceResult: null, nextDiceResult: null, autoRollAt: null, message: null, messageTimeout: 0 }
      ],
      tiles: newTiles,
      traps: initialTraps,
      droppedCoins: [],
      flyingCoins: [],
      winner: null
    }));
  },

    rollDice: (playerId: string) => {
    const state = get();
    if (state.winner) return;
    if (Date.now() < state.pauseUntil) return;
    
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    const player = state.players[playerIndex];
    if (!player || player.stepsRemaining > 0) return;

    // 如果是轮流模式，检查是否轮到该玩家
    if (state.settings.turnMode === 'turn-based' && state.currentPlayerIndex !== playerIndex) {
      return;
    }

    // 如果是同时模式，检查冷却时间
    if (state.settings.turnMode === 'simultaneous' && player.cooldown > Date.now()) {
      return;
    }

    const d1 = player.nextDiceResult ? player.nextDiceResult[0] : Math.floor(Math.random() * 6) + 1;
    const d2 = player.nextDiceResult ? player.nextDiceResult[1] : Math.floor(Math.random() * 6) + 1;
    const steps = d1 + d2;

    set(state => ({
      players: state.players.map(p => 
        p.id === playerId 
          ? { ...p, stepsRemaining: p.stepsRemaining + steps, cooldown: Date.now() + (steps * 200) + 1000, diceResult: [d1, d2], nextDiceResult: null, autoRollAt: null } 
          : p
      )
    }));
  },

  // 游戏主循环：处理移动、AI 决策、触发事件
  tick: () => {
    const state = get();
    if (state.winner) return;
    if (Date.now() < state.pauseUntil) return;

    let newPlayers = [...state.players];
    let newTraps = [...state.traps];
    let newDroppedCoins = [...state.droppedCoins];
    let newFlyingCoins = [...state.flyingCoins];
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

    // 1. 生成预计算的骰子结果（nextDiceResult）和自动掷骰时间（autoRollAt）
    newPlayers = newPlayers.map((p, i) => {
      const isMyTurn = state.settings.turnMode === 'simultaneous' || newCurrentPlayerIndex === i;
      
      if (isMyTurn && p.stepsRemaining === 0 && p.diceResult === null && p.nextDiceResult === null && p.cooldown < now) {
        // 确保在轮流模式下，没有任何玩家正在移动
        if (state.settings.turnMode === 'turn-based') {
          const isAnyoneMoving = newPlayers.some(otherPlayer => otherPlayer.stepsRemaining > 0);
          if (isAnyoneMoving) return p;
        }

        const d1 = Math.floor(Math.random() * 6) + 1;
        const d2 = Math.floor(Math.random() * 6) + 1;
        
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
          cooldown: now + (steps * 200) + 1000, 
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
        const nextPos = (p.position + 1) % BOARD_SIZE;
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
          const tilePos = getTilePosition(nextPos);
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
            newCooldown = Math.max(newCooldown, now + c * 50 + duration + 500);
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
                const tilePos = getTilePosition(nextPos);
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
                  newCooldown = Math.max(newCooldown, now + c * 50 + duration + 500);
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

        // Passing start in classic mode
        if (state.gameMode === 'classic' && nextPos === 0) {
          if (newCarried > 0) {
            // Spawn flying coins
            const numCoinsToFly = Math.min(newCarried, 20); // Cap visual coins
            const startPos = getTilePosition(0); // Player is arriving at 0
            const endPos = getTilePosition(0);
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
                startTime: now + c * 50, // Stagger start times
                duration: duration
              });
              newCooldown = Math.max(newCooldown, now + c * 50 + duration + 500);
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

        let currentStepsRemaining = p.stepsRemaining;
        
        // 轮流模式下，如果最后一步的落点有其他玩家，则多走一步
        if (state.settings.turnMode === 'turn-based' && currentStepsRemaining === 1) {
          const isOccupied = newPlayers.some((otherPlayer, otherIdx) => otherIdx !== i && otherPlayer.position === nextPos);
          if (isOccupied) {
            currentStepsRemaining++;
            newMessage = "Bumped!";
            newMessageTimeout = now + 1000;
          }
        }

        const isLastStep = currentStepsRemaining === 1;
        
        // Landing effects
        if (isLastStep) {
          // Reset cooldown to exactly 1s when movement finishes to avoid jitter
          newCooldown = Math.max(newCooldown, now + 1000);
          const tile = state.tiles[nextPos];
          
          // Landing on bank in strict mode
          if (state.gameMode === 'strict_bank' && tile === 'bank') {
            if (newCarried > 0) {
              // Spawn flying coins
              const numCoinsToFly = Math.min(newCarried, 20); // Cap visual coins
              const startPos = getTilePosition(nextPos); // Player is arriving at nextPos
              const endPos = getTilePosition(nextPos);
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
                  startTime: now + c * 50, // Stagger start times
                  duration: duration
                });
                newCooldown = Math.max(newCooldown, now + c * 50 + duration + 500);
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

          if (tile === 'bonus') {
            newCarried += 5;
            newMessage = `Bonus +5!`;
            newMessageTimeout = now + 2000;
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
              
              const startTilePos = getTilePosition(nextPos);
              const spawnDroppedCoins = (amount: number, offset: number) => {
                if (amount <= 0) return;
                const dropPos = (nextPos - offset + BOARD_SIZE) % BOARD_SIZE;
                newDroppedCoins.push({ id: uuidv4(), position: dropPos, amount });
                
                const endTilePos = getTilePosition(dropPos);
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
                  newCooldown = Math.max(newCooldown, now + c * 50 + duration + 500);
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

        newPlayers[i] = {
          ...p,
          position: nextPos,
          stepsRemaining: currentStepsRemaining - 1,
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

    // Clean up finished flying coins
    newFlyingCoins = newFlyingCoins.filter(c => now < c.startTime + c.duration);

    set({
      players: newPlayers,
      traps: newTraps,
      droppedCoins: newDroppedCoins,
      flyingCoins: newFlyingCoins,
      winner: newWinner,
      currentPlayerIndex: newCurrentPlayerIndex
    });
  }
}));
