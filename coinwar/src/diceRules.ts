import type { Player, TileType, Trap, GameMode, TurnMode } from './store';

// ============================================================
//  骰子调控规则 & 参数配置
//  所有影响骰子结果的隐性机制集中在此文件，方便调参和审查。
//  骰子调控的核心思路：生成多个候选结果，根据规则选取最合适的。
//  所有机制均可通过 enabled 开关独立关闭。
// ============================================================


// ────────────────────────────────────────────────────────────
//  1. 银行回避（仅 strict_bank 模式）
// ────────────────────────────────────────────────────────────
//  当玩家携带的金币很少时，降低骰子恰好停在银行格的概率。
//  原因：存 3、5 个金币是低效的，不如多跑几圈攒到有分量再存。
//  实现：如果骰子落点是银行且金币 ≤ 阈值，以一定概率重掷。
export const BANK_AVOIDANCE = {
  enabled: true,
  /** 携带金币 ≤ 此值时触发回避（建议 5–15） */
  coinThreshold: 10,
  /** 每次命中银行后的重掷概率（0–1，越高越难踩到银行） */
  avoidChance: 0.85,
  /** 最多重掷次数（超过后接受结果，防止死循环） */
  maxRerolls: 3,
};


// ────────────────────────────────────────────────────────────
//  2. 追赶机制 / 橡皮筋（Rubber Banding）
// ────────────────────────────────────────────────────────────
//  根据玩家间的财富差距动态调控骰子大小：
//    领先者 → 更容易掷出小点数
//    落后者 → 更容易掷出大点数
//  保持比赛悬念，避免一方独大后毫无翻盘机会。
//
//  「谁前谁后」的定义：
//    有效财富 = bankedCoins + carriedCoins × carryWeight
//    以全体玩家的平均有效财富为基准，各自计算偏差百分比。
//    2 人局：等价于两人直接比较。
//    3 人局：每人独立对比平均值，可能出现 1 人领先、2 人落后等情况。
//
//  实现：生成多组候选骰子，领先者取总点数最小的，落后者取最大的。
//  候选数量随偏差幅度线性增长（刚过阈值 → 1 组额外，达到满值 → 最多 N 组）。
export const RUBBER_BANDING = {
  enabled: true,
  /** 携带金币折算系数（未存入的金币随时可能丢，不如 banked 稳定） */
  carryWeight: 0.5,
  /** 偏差百分比 ≤ 此值时不触发（避免开局微小差距就调控） */
  deviationThresholdPct: 20,
  /** 偏差百分比达到此值时调控力度拉满 */
  deviationFullPct: 80,
  /** 调控力度满时的额外候选骰子对数（越多 → 对结果影响越大） */
  maxExtraCandidates: 2,
};


// ────────────────────────────────────────────────────────────
//  3. 陷阱磁吸（针对领先者）
// ────────────────────────────────────────────────────────────
//  财富大幅领先的玩家更容易"吸"向陷阱格，增加翻盘可能。
//  实现：如果当前骰子落点不是陷阱，以一定概率尝试重掷，
//        若重掷结果恰好落在陷阱上则采用，否则保留原结果。
export const TRAP_MAGNETISM = {
  enabled: true,
  /** 有效财富超过平均值此百分比后触发（如 40 = 领先 40%） */
  leadThresholdPct: 40,
  /** 触发后尝试偏向陷阱的概率（0–1） */
  magnetChance: 0.35,
  /** 最多重掷几次来寻找陷阱落点 */
  maxRerolls: 2,
};


// ────────────────────────────────────────────────────────────
//  4. 奖励格吸引（针对落后者）
// ────────────────────────────────────────────────────────────
//  财富大幅落后的玩家更容易踩到 +10 / +50% 奖励格，提供追赶手段。
//  与陷阱磁吸对称：落后者的骰子有小概率偏向奖励格。
export const BONUS_ATTRACTION = {
  enabled: true,
  /** 有效财富低于平均值此百分比后触发（如 30 = 落后 30%） */
  trailThresholdPct: 30,
  /** 触发后尝试偏向奖励格的概率（0–1） */
  attractChance: 0.3,
  /** 最多重掷几次来寻找奖励格 */
  maxRerolls: 2,
};


// ────────────────────────────────────────────────────────────
//  5. 落点防重叠（Bump Avoidance）
// ────────────────────────────────────────────────────────────
//  掷骰子时尽量避免落点与其他玩家重叠。
//  实现：若骰子落点有其他玩家，以一定概率重掷寻找空位。
export const BUMP_AVOIDANCE = {
  enabled: true,
  /** 仅轮流模式 (turn-based) 生效 */
  turnBasedOnly: true,
  /** 落点有人时的重掷概率（0–1） */
  avoidChance: 0.9,
  /** 最多重掷次数 */
  maxRerolls: 3,
};


// ============================================================
//  内部工具函数
// ============================================================

function rollRaw(): [number, number] {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function total(d: [number, number]): number {
  return d[0] + d[1];
}

function effectiveWealth(p: Player): number {
  return p.bankedCoins + p.carriedCoins * RUBBER_BANDING.carryWeight;
}

function landingPos(player: Player, dice: [number, number], boardSize: number): number {
  return (player.position + total(dice)) % boardSize;
}


// ============================================================
//  调控流水线
//  按顺序执行：橡皮筋 → 银行回避 → 陷阱磁吸 → 奖励吸引 → 防重叠
//  每一步都可能替换骰子结果，后续步骤在前一步的结果上继续判断。
// ============================================================

/**
 * 对外唯一入口：根据当前游戏状态生成经过调控的骰子结果。
 * 在 store.ts 的 tick() 和 rollDice() 中调用。
 */
export function generateDice(
  player: Player,
  allPlayers: Player[],
  tiles: TileType[],
  traps: Trap[],
  gameMode: GameMode | null,
  boardSize: number,
  turnMode: TurnMode = 'turn-based'
): [number, number] {
  let dice = applyRubberBanding(player, allPlayers);
  dice = applyBankAvoidance(dice, player, tiles, gameMode, boardSize);
  dice = applyTrapMagnetism(dice, player, allPlayers, traps, boardSize);
  dice = applyBonusAttraction(dice, player, allPlayers, tiles, boardSize);
  dice = applyBumpAvoidance(dice, player, allPlayers, turnMode, boardSize);
  return dice;
}


// ────────── 橡皮筋 ──────────

function applyRubberBanding(player: Player, allPlayers: Player[]): [number, number] {
  const base = rollRaw();
  if (!RUBBER_BANDING.enabled || allPlayers.length < 2) return base;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return base;

  const devPct = ((myW - avgW) / avgW) * 100;
  const { deviationThresholdPct: thresh, deviationFullPct: full, maxExtraCandidates } = RUBBER_BANDING;
  if (Math.abs(devPct) < thresh) return base;

  const intensity = Math.min(1, (Math.abs(devPct) - thresh) / Math.max(full - thresh, 1));
  const extraCount = Math.max(1, Math.round(intensity * maxExtraCandidates));

  const candidates: [number, number][] = [base];
  for (let i = 0; i < extraCount; i++) candidates.push(rollRaw());

  if (devPct > 0) {
    return candidates.reduce((best, c) => total(c) < total(best) ? c : best);
  } else {
    return candidates.reduce((best, c) => total(c) > total(best) ? c : best);
  }
}


// ────────── 银行回避 ──────────

function applyBankAvoidance(
  dice: [number, number],
  player: Player,
  tiles: TileType[],
  gameMode: GameMode | null,
  boardSize: number
): [number, number] {
  if (!BANK_AVOIDANCE.enabled) return dice;
  if (gameMode !== 'strict_bank') return dice;
  if (player.carriedCoins > BANK_AVOIDANCE.coinThreshold) return dice;
  if (tiles[landingPos(player, dice, boardSize)] !== 'bank') return dice;

  for (let i = 0; i < BANK_AVOIDANCE.maxRerolls; i++) {
    if (Math.random() > BANK_AVOIDANCE.avoidChance) break;
    const alt = rollRaw();
    if (tiles[landingPos(player, alt, boardSize)] !== 'bank') return alt;
  }
  return dice;
}


// ────────── 陷阱磁吸 ──────────

function applyTrapMagnetism(
  dice: [number, number],
  player: Player,
  allPlayers: Player[],
  traps: Trap[],
  boardSize: number
): [number, number] {
  if (!TRAP_MAGNETISM.enabled || traps.length === 0) return dice;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return dice;

  const leadPct = ((myW - avgW) / avgW) * 100;
  if (leadPct < TRAP_MAGNETISM.leadThresholdPct) return dice;
  if (Math.random() > TRAP_MAGNETISM.magnetChance) return dice;

  const trapSet = new Set(traps.map(t => t.position));
  for (let i = 0; i < TRAP_MAGNETISM.maxRerolls; i++) {
    const alt = rollRaw();
    if (trapSet.has(landingPos(player, alt, boardSize))) return alt;
  }
  return dice;
}


// ────────── 奖励吸引 ──────────

function applyBonusAttraction(
  dice: [number, number],
  player: Player,
  allPlayers: Player[],
  tiles: TileType[],
  boardSize: number
): [number, number] {
  if (!BONUS_ATTRACTION.enabled) return dice;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return dice;

  const trailPct = ((avgW - myW) / avgW) * 100;
  if (trailPct < BONUS_ATTRACTION.trailThresholdPct) return dice;
  if (Math.random() > BONUS_ATTRACTION.attractChance) return dice;

  for (let i = 0; i < BONUS_ATTRACTION.maxRerolls; i++) {
    const alt = rollRaw();
    const tile = tiles[landingPos(player, alt, boardSize)];
    if (tile === 'bonus_10' || tile === 'bonus_x2') return alt;
  }
  return dice;
}


// ────────── 防重叠 ──────────

function applyBumpAvoidance(
  dice: [number, number],
  player: Player,
  allPlayers: Player[],
  turnMode: TurnMode,
  boardSize: number
): [number, number] {
  if (!BUMP_AVOIDANCE.enabled) return dice;
  if (BUMP_AVOIDANCE.turnBasedOnly && turnMode !== 'turn-based') return dice;

  const landing = landingPos(player, dice, boardSize);
  const occupied = allPlayers.some(p => p.id !== player.id && p.position === landing);
  if (!occupied) return dice;

  for (let i = 0; i < BUMP_AVOIDANCE.maxRerolls; i++) {
    if (Math.random() > BUMP_AVOIDANCE.avoidChance) break;
    const alt = rollRaw();
    const altLanding = landingPos(player, alt, boardSize);
    if (!allPlayers.some(p => p.id !== player.id && p.position === altLanding)) return alt;
  }
  return dice;
}
