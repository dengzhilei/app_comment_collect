import type { Player, TileType, Trap, GameMode, TurnMode, GameSettings } from './store';

// ============================================================
//  骰子调控系统 — 基于权重的点数选取
//
//  流程：
//    1. 列出 2~12 全部可能总点数，赋予 2D6 自然概率权重
//    2. 为每个点数计算落点位置、地格类型、是否有陷阱/其他玩家
//    3. 逐条规则修改对应点数的权重（乘以倍率）
//    4. 根据最终权重做加权随机，选出一个总点数
//    5. 从该总点数的所有骰子组合中随机取一组作为 [d1, d2]
//    6. 任何异常直接回退到纯随机 2D6
// ============================================================


// ────────────────────────────────────────────────────────────
//  2D6 自然权重（各总点数出现的组合数，共 36 种）
// ────────────────────────────────────────────────────────────
const NATURAL_WEIGHTS: Record<number, number> = {
  2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6,
  8: 5, 9: 4, 10: 3, 11: 2, 12: 1
};

// ────────────────────────────────────────────────────────────
//  各总点数对应的骰子组合，用于最终还原为 [d1, d2]
// ────────────────────────────────────────────────────────────
const DICE_COMBOS: Record<number, [number, number][]> = {
  2:  [[1, 1]],
  3:  [[1, 2], [2, 1]],
  4:  [[1, 3], [2, 2], [3, 1]],
  5:  [[1, 4], [2, 3], [3, 2], [4, 1]],
  6:  [[1, 5], [2, 4], [3, 3], [4, 2], [5, 1]],
  7:  [[1, 6], [2, 5], [3, 4], [4, 3], [5, 2], [6, 1]],
  8:  [[2, 6], [3, 5], [4, 4], [5, 3], [6, 2]],
  9:  [[3, 6], [4, 5], [5, 4], [6, 3]],
  10: [[4, 6], [5, 5], [6, 4]],
  11: [[5, 6], [6, 5]],
  12: [[6, 6]]
};


// ============================================================
//  调控规则配置（每条规则独立开关，参数就地修改）
// ============================================================

// ── 1. 橡皮筋 / 追赶机制 ──
// 生效模式：全部（simultaneous / turn-based × classic / strict_bank）
// 领先者：高点数权重降低、低点数权重提升 → 倾向走慢
// 落后者：低点数权重降低、高点数权重提升 → 倾向走快
export const RUBBER_BANDING = {
  enabled: true,
  /** 携带金币折算系数（有效财富 = bankedCoins + carriedCoins × carryWeight） */
  carryWeight: 0.5,
  /** |devPct| < 此值时不触发（%） */
  deviationThresholdPct: 20,
  /** |devPct| ≥ 此值时调控强度 = 1（%） */
  deviationFullPct: 80,
  /** 强度 = 1 时，最极端点数（sum=2 或 sum=12）的权重倍率 */
  maxBoostFactor: 2.0,
};

// ── 2. 银行格权重调控 ──
// 生效模式：仅 strict_bank
// 数组定义任意段：每段 { maxCarried, multiplier }
// 从上到下匹配第一个 carried ≤ maxCarried 的段，使用其 multiplier
// 所有段都不匹配时 multiplier = 1（不干预）
export const BANK_CONTROL = {
  enabled: true,
  segments: [
    { maxCarried: 4,   multiplier: 0 },  // 0~5:   降至 10%（存了没意义）
    { maxCarried: 8,  multiplier: 0.5 },  
    { maxCarried: 15,  multiplier: 1 },  
    { maxCarried: 25,  multiplier: 2.2 },  
    { maxCarried: 40,  multiplier: 1.7 },  
    { maxCarried: 9999, multiplier: 1 },  
  ],
};

// ── 3. 陷阱磁吸 ──
// 生效模式：全部
// 数组定义任意段：每段 { maxLeadPct, multiplier }
// 从上到下匹配第一个 leadPct ≤ maxLeadPct 的段，使用其 multiplier
// 所有段都不匹配时 multiplier = 1（不干预）
export const TRAP_MAGNETISM = {
  enabled: true,
  segments: [
    { maxLeadPct: 20,   multiplier: 1.0 },
    { maxLeadPct: 35,   multiplier: 1.5 },
    { maxLeadPct: 50,   multiplier: 2.0 },
    { maxLeadPct: 9999, multiplier: 2.5 },
  ],
};

// ── 4a. +5 格吸引 ──
// 生效模式：全部
// 数组定义任意段：每段 { maxTrailPct, multiplier }
// 从上到下匹配第一个 trailPct ≤ maxTrailPct 的段，使用其 multiplier
// 所有段都不匹配时 multiplier = 1（不干预）
export const BONUS_10_ATTRACTION = {
  enabled: true,
  segments: [
    { maxTrailPct: 20,   multiplier: 1.0 },
    { maxTrailPct: 35,   multiplier: 1.5 },
    { maxTrailPct: 50,   multiplier: 2.0 },
    { maxTrailPct: 9999, multiplier: 2.5 },
  ],
};

// ── 4b. x2 格调控 ──
// 生效模式：全部
// 两层逻辑：
//   层1（追赶加成）：落后者提升 x2 权重，与 +5 类似
//   层2（携带金币过滤）：无条件生效，携带金币太少或太多时降低 x2 权重
export const BONUS_X2_CONTROL = {
  enabled: true,

  // ── 层1：追赶加成（仅落后者触发） ──
  /** trailPct ≥ 此值时触发追赶加成 */
  trailThresholdPct: 30,
  /** 追赶加成倍率 */
  trailWeightMultiplier: 2.5,

  // ── 层2：携带金币过滤（无条件，所有玩家生效） ──
  /** 携带金币 ≤ 此值时降低 x2 概率（翻倍收益太低） */
  carriedLowThreshold: 5,
  /** 低金币时的权重乘数（0.2 = 降至 20%） */
  carriedLowMultiplier: 0.2,
  /** 携带金币 ≥ 此值时降低 x2 概率（翻倍收益过强） */
  carriedHighThreshold: 40,
  /** 高金币时的权重乘数 */
  carriedHighMultiplier: 0,
};

// ── 5. 落点防重叠 ──
// 生效模式：仅 turn-based（turnBasedOnly = true 时）
// 降低落在有其他玩家格子上的点数权重
export const BUMP_AVOIDANCE = {
  enabled: true,
  /** true = 仅 turn-based 生效；false = 全模式生效 */
  turnBasedOnly: true,
  /** 有人格子落点的权重 ×= 此值（0.2 = 降至 20%） */
  weightMultiplier: 0.2,
};

// ── 7. 同格分散 ──
// 生效模式：仅 simultaneous（simultaneousOnly = true 时）
// 当多个玩家位于同一格时，根据玩家在该格内的序号确定性地偏向不同的骰子区间
// 序号靠前的偏小点数，序号靠后的偏大点数，使他们自然散开
export const SPREAD_CONTROL = {
  enabled: true,
  /** true = 仅 simultaneous 生效 */
  simultaneousOnly: true,
  /** 偏向区间最极端点数的权重倍率（越大分散力越强） */
  boostMultiplier: 1.8,
};

// ── 6. 攻击格调控 ──
// 生效模式：全部
// 当所有对手的 bankedCoins 都 < attackDamage 时，攻击格权重降为 0（踩了也白踩）
export const ATTACK_CONTROL = {
  enabled: true,
  /** 无有效目标时攻击格权重乘数（0 = 完全不会踩到） */
  noTargetMultiplier: 0,
};


// ============================================================
//  候选结构
// ============================================================

type Candidate = {
  sum: number;
  position: number;
  tileType: TileType;
  hasTrap: boolean;
  hasPlayer: boolean;
  weight: number;
};


// ============================================================
//  工具函数
// ============================================================

function rollRaw(): [number, number] {
  return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function effectiveWealth(p: Player): number {
  return p.bankedCoins + p.carriedCoins * RUBBER_BANDING.carryWeight;
}

function pickComboFromSum(sum: number): [number, number] {
  const combos = DICE_COMBOS[sum];
  if (!combos || combos.length === 0) return rollRaw();
  return combos[Math.floor(Math.random() * combos.length)];
}

function weightedPick(candidates: Candidate[]): number {
  const totalW = candidates.reduce((s, c) => s + c.weight, 0);
  if (totalW <= 0) return -1;
  let r = Math.random() * totalW;
  for (const c of candidates) {
    r -= c.weight;
    if (r <= 0) return c.sum;
  }
  return candidates[candidates.length - 1].sum;
}


// ============================================================
//  调控函数（直接修改 candidates[].weight）
// ============================================================

// ── 1. 橡皮筋 ──
function applyRubberBanding(candidates: Candidate[], player: Player, allPlayers: Player[]): void {
  if (!RUBBER_BANDING.enabled || allPlayers.length < 2) return;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return;

  const devPct = ((myW - avgW) / avgW) * 100;
  const { deviationThresholdPct: thresh, deviationFullPct: full, maxBoostFactor } = RUBBER_BANDING;
  if (Math.abs(devPct) < thresh) return;

  const intensity = Math.min(1, (Math.abs(devPct) - thresh) / Math.max(full - thresh, 1));
  // direction: 领先 → -1（偏向小点数），落后 → +1（偏向大点数）
  const direction = devPct > 0 ? -1 : 1;

  for (const c of candidates) {
    // normalized: sum=2 → -1, sum=7 → 0, sum=12 → +1
    const normalized = (c.sum - 7) / 5;
    const exponent = direction * normalized * intensity;
    c.weight *= Math.pow(maxBoostFactor, exponent);
  }
}

// ── 2. 银行格权重调控 ──
function applyBankControl(candidates: Candidate[], player: Player, gameMode: GameMode | null): void {
  if (!BANK_CONTROL.enabled) return;
  if (gameMode !== 'strict_bank') return;

  const carried = player.carriedCoins;
  const seg = BANK_CONTROL.segments.find(s => carried <= s.maxCarried);
  const multiplier = seg ? seg.multiplier : 1;

  if (multiplier === 1) return;

  for (const c of candidates) {
    if (c.tileType === 'bank') {
      c.weight *= multiplier;
    }
  }
}

// ── 3. 陷阱磁吸 ──
function applyTrapMagnetism(candidates: Candidate[], player: Player, allPlayers: Player[]): void {
  if (!TRAP_MAGNETISM.enabled) return;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return;

  const leadPct = ((myW - avgW) / avgW) * 100;
  if (leadPct <= 0) return;

  const seg = TRAP_MAGNETISM.segments.find(s => leadPct <= s.maxLeadPct);
  const multiplier = seg ? seg.multiplier : 1;
  if (multiplier === 1) return;

  for (const c of candidates) {
    if (c.hasTrap) {
      c.weight *= multiplier;
    }
  }
}

// ── 4a. +5 格吸引 ──
function applyBonus10Attraction(candidates: Candidate[], player: Player, allPlayers: Player[]): void {
  if (!BONUS_10_ATTRACTION.enabled) return;

  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW <= 0) return;

  const trailPct = ((avgW - myW) / avgW) * 100;
  if (trailPct <= 0) return;

  const seg = BONUS_10_ATTRACTION.segments.find(s => trailPct <= s.maxTrailPct);
  const multiplier = seg ? seg.multiplier : 1;
  if (multiplier === 1) return;

  for (const c of candidates) {
    if (c.tileType === 'bonus_10') {
      c.weight *= multiplier;
    }
  }
}

// ── 4b. x2 格调控 ──
function applyBonusX2Control(candidates: Candidate[], player: Player, allPlayers: Player[]): void {
  if (!BONUS_X2_CONTROL.enabled) return;

  const carried = player.carriedCoins;
  const cfg = BONUS_X2_CONTROL;

  // 层1：追赶加成（仅落后者）
  const myW = effectiveWealth(player);
  const avgW = allPlayers.reduce((s, p) => s + effectiveWealth(p), 0) / allPlayers.length;
  if (avgW > 0) {
    const trailPct = ((avgW - myW) / avgW) * 100;
    if (trailPct >= cfg.trailThresholdPct) {
      for (const c of candidates) {
        if (c.tileType === 'bonus_x2') {
          c.weight *= cfg.trailWeightMultiplier;
        }
      }
    }
  }

  // 层2：携带金币过滤（所有玩家，无条件）
  for (const c of candidates) {
    if (c.tileType === 'bonus_x2') {
      if (carried <= cfg.carriedLowThreshold) {
        c.weight *= cfg.carriedLowMultiplier;
      } else if (carried >= cfg.carriedHighThreshold) {
        c.weight *= cfg.carriedHighMultiplier;
      }
    }
  }
}

// ── 5. 落点防重叠 ──
function applyBumpAvoidance(candidates: Candidate[], turnMode: TurnMode): void {
  if (!BUMP_AVOIDANCE.enabled) return;
  if (BUMP_AVOIDANCE.turnBasedOnly && turnMode !== 'turn-based') return;

  for (const c of candidates) {
    if (c.hasPlayer) {
      c.weight *= BUMP_AVOIDANCE.weightMultiplier;
    }
  }
}

// ── 7. 同格分散 ──
function applySpreadControl(candidates: Candidate[], player: Player, allPlayers: Player[], turnMode: TurnMode): void {
  if (!SPREAD_CONTROL.enabled) return;
  if (SPREAD_CONTROL.simultaneousOnly && turnMode !== 'simultaneous') return;

  const colocated = allPlayers.filter(p => p.position === player.position);
  if (colocated.length < 2) return;

  const sorted = [...colocated].sort((a, b) => a.id.localeCompare(b.id));
  const myIndex = sorted.findIndex(p => p.id === player.id);

  // maps 0..n-1 → -1..+1, e.g. 2 players: [-1, 1], 3 players: [-1, 0, 1]
  const direction = sorted.length === 1 ? 0 : (myIndex / (sorted.length - 1)) * 2 - 1;
  if (direction === 0) return;

  for (const c of candidates) {
    // sum=2 → -1, sum=7 → 0, sum=12 → +1
    const normalized = (c.sum - 7) / 5;
    c.weight *= Math.pow(SPREAD_CONTROL.boostMultiplier, direction * normalized);
  }
}

// ── 6. 攻击格调控 ──
function applyAttackControl(candidates: Candidate[], player: Player, allPlayers: Player[], settings: GameSettings): void {
  if (!ATTACK_CONTROL.enabled) return;

  const others = allPlayers.filter(p => p.id !== player.id);
  const hasValidTarget = others.some(p => p.bankedCoins >= settings.attackDamage);

  if (hasValidTarget) return;

  for (const c of candidates) {
    if (c.tileType === 'attack') {
      c.weight *= ATTACK_CONTROL.noTargetMultiplier;
    }
  }
}


// ============================================================
//  对外唯一入口
// ============================================================

export function generateDice(
  player: Player,
  allPlayers: Player[],
  tiles: TileType[],
  traps: Trap[],
  gameMode: GameMode | null,
  boardSize: number,
  turnMode: TurnMode = 'turn-based',
  settings?: GameSettings
): [number, number] {
  try {
    // 1. 构建 11 个候选（sum 2~12），初始权重 = 自然概率
    const candidates: Candidate[] = [];
    for (let sum = 2; sum <= 12; sum++) {
      const pos = (player.position + sum) % boardSize;
      candidates.push({
        sum,
        position: pos,
        tileType: tiles[pos],
        hasTrap: traps.some(t => t.position === pos),
        hasPlayer: allPlayers.some(p => p.id !== player.id && p.position === pos),
        weight: NATURAL_WEIGHTS[sum]
      });
    }

    // 2. 依次执行调控规则，修改权重
    applyRubberBanding(candidates, player, allPlayers);
    applyBankControl(candidates, player, gameMode);
    applyTrapMagnetism(candidates, player, allPlayers);
    applyBonus10Attraction(candidates, player, allPlayers);
    applyBonusX2Control(candidates, player, allPlayers);
    applyBumpAvoidance(candidates, turnMode);
    applySpreadControl(candidates, player, allPlayers, turnMode);
    if (settings) applyAttackControl(candidates, player, allPlayers, settings);

    // 3. 加权随机选取总点数
    const sum = weightedPick(candidates);
    if (sum < 2 || sum > 12) return rollRaw();

    // 4. 从该总点数的所有骰子组合中随机取一组
    return pickComboFromSum(sum);
  } catch {
    // 任何异常 → 纯随机
    return rollRaw();
  }
}
