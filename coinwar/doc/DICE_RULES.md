# 骰子调控系统 (Dice Manipulation)

> 源文件：`src/diceRules.ts`

## 核心流程

```
┌─────────────────────────────────────────────────────────┐
│  1. 列出 2~12 共 11 个候选总点数                          │
│     每个点数赋予 2D6 自然概率权重（见下表）                  │
│                                                         │
│  2. 为每个点数计算：                                      │
│     · 落点位置 = (当前位置 + 总点数) % 棋盘格数             │
│     · 落点地格类型（bank / normal / bonus_10 / ...）       │
│     · 落点是否有陷阱                                      │
│     · 落点是否有其他玩家                                   │
│                                                         │
│  3. 按规则逐条修改权重（每条规则 = 对符合条件的点数         │
│     的权重乘以一个倍率）                                   │
│     ① 橡皮筋 → ② 银行格调控 → ③ 陷阱磁吸                │
│     → ④a +10吸引 → ④b x2调控 → ⑤ 落点防重叠             │
│                                                         │
│  4. 根据最终权重做加权随机，选出一个总点数                   │
│                                                         │
│  5. 从该总点数的所有骰子组合中随机取一组作为 [d1, d2]       │
│                                                         │
│  ※ 任何步骤出现异常 → 回退到纯随机 2D6                    │
└─────────────────────────────────────────────────────────┘
```

## 2D6 自然权重

| 总点数 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 组合数 | 1 | 2 | 3 | 4 | 5 | 6 | 5 | 4 | 3 | 2 | 1 |
| 自然概率 | 2.8% | 5.6% | 8.3% | 11.1% | 13.9% | 16.7% | 13.9% | 11.1% | 8.3% | 5.6% | 2.8% |

调控规则不改变组合数（36 种），只改变各总点数被选中的相对权重。

## 通用定义

### 有效财富

```
有效财富 = bankedCoins + carriedCoins × 0.5
```

`0.5` 是 `RUBBER_BANDING.carryWeight`。银行金币计全额，携带金币计半额。

### 偏差百分比

```
平均有效财富 = 全体玩家有效财富之和 ÷ 玩家人数
devPct  = (我的有效财富 − 平均) ÷ 平均 × 100    正值 = 领先
leadPct = devPct（仅取正值方向）                   用于陷阱磁吸
trailPct = −devPct（仅取正值方向）                 用于奖励吸引
```

---

## 规则详解

### ① 橡皮筋 / 追赶机制 (Rubber Banding)

| 属性 | 值 |
|---|---|
| 生效模式 | **全部 4 种组合** |
| 默认开关 | `enabled: true` |

**作用**：对 11 个候选点数的权重施加指数倍率，使领先者偏向低点数、落后者偏向高点数。

**计算步骤**：

1. 计算 `devPct`。若 `|devPct| < 20`（`deviationThresholdPct`），跳过本规则，不修改任何权重。
2. 计算调控强度：
   ```
   intensity = min(1, (|devPct| − 20) ÷ (80 − 20))
   ```
   `|devPct|` 在 20~80 之间线性映射到 0~1，≥ 80 时固定为 1。
3. 确定方向：
   - `devPct > 0`（领先）：`direction = −1`
   - `devPct < 0`（落后）：`direction = +1`
4. 对每个候选点数 `sum`（2~12），计算权重倍率并乘上去：
   ```
   normalized = (sum − 7) ÷ 5          范围 −1（sum=2）到 +1（sum=12）
   exponent   = direction × normalized × intensity
   weight    ×= 3.0 ^ exponent          3.0 = maxBoostFactor
   ```

**计算示例**：玩家 A 有效财富 120，平均 80，`devPct = 50`，`intensity = 0.5`，`direction = −1`（领先）

| sum | normalized | exponent | 倍率 (3^exp) | 原权重 | 修改后权重 |
|--:|--:|--:|--:|--:|--:|
| 2 | −1.0 | +0.5 | 1.73 | 1 | 1.73 |
| 3 | −0.8 | +0.4 | 1.55 | 2 | 3.10 |
| 7 | 0.0 | 0.0 | 1.00 | 6 | 6.00 |
| 11 | +0.8 | −0.4 | 0.64 | 2 | 1.29 |
| 12 | +1.0 | −0.5 | 0.58 | 1 | 0.58 |

结果：sum=2 选中概率从 2.8% 提升到 ~4.8%，sum=12 从 2.8% 降到 ~1.6%。

| 参数 | 默认值 | 含义 |
|---|---|---|
| `carryWeight` | 0.5 | 携带金币折算系数 |
| `deviationThresholdPct` | 20 | \|devPct\| < 此值时跳过本规则 |
| `deviationFullPct` | 80 | \|devPct\| ≥ 此值时 intensity = 1 |
| `maxBoostFactor` | 3.0 | intensity = 1 时最极端点数的权重倍率 |

---

### ② 银行格权重调控 (Bank Control)

| 属性 | 值 |
|---|---|
| 生效模式 | **仅 strict_bank** |
| 默认开关 | `enabled: true` |
| 配置对象 | `BANK_CONTROL` |

**作用**：根据玩家携带金币数量，对银行格落点的权重做三段式调整。

**三段逻辑**（对落点为 `bank` 的候选点数）：

| 携带金币 | 操作 | 原因 |
|---|---|---|
| ≤ 10（`lowThreshold`） | `weight ×= 0.1`（`lowMultiplier`） | 存几个金币没意义，降权 |
| 11 ~ 39（中间区间） | `weight ×= 2.0`（`midMultiplier`） | 该存了，提高命中银行概率 |
| ≥ 40（`highThreshold`） | 不干预（×1） | 金币足够多，自然概率即可 |

**举例**：sum=5 和 sum=9 落在银行格

携带 3 枚金币（≤ 10）：
- sum=5 权重：4 × 0.1 = 0.4
- sum=9 权重：4 × 0.1 = 0.4

携带 25 枚金币（中间区间）：
- sum=5 权重：4 × 2.0 = 8.0
- sum=9 权重：4 × 2.0 = 8.0

携带 50 枚金币（≥ 40）：
- 不修改，保持自然权重

| 参数 | 默认值 | 含义 |
|---|---|---|
| `lowThreshold` | 10 | 携带金币 ≤ 此值时降权 |
| `lowMultiplier` | 0.1 | 低金币时银行格权重乘数 |
| `highThreshold` | 40 | 携带金币 ≥ 此值时不干预 |
| `midMultiplier` | 2.0 | 适中金币时银行格权重乘数 |

---

### ③ 陷阱磁吸 (Trap Magnetism)

| 属性 | 值 |
|---|---|
| 生效模式 | **全部 4 种组合** |
| 默认开关 | `enabled: true` |

**作用**：将所有落在陷阱格的点数权重乘以 2.5。

**触发条件**（全部满足才执行）：
1. 场上存在至少 1 个陷阱
2. `leadPct` ≥ 40（`leadThresholdPct`）

**执行**：对落点有陷阱的每个候选点数：
```
weight ×= 2.5
```

**举例**：3 人局，有效财富 100 / 50 / 60，平均 70。玩家 A `leadPct = 42.9` ≥ 40，触发。sum=4 落在陷阱格：
- sum=4 权重：3 × 2.5 = 7.5
- 其他点数权重不变

| 参数 | 默认值 | 含义 |
|---|---|---|
| `leadThresholdPct` | 40 | leadPct < 此值时跳过本规则 |
| `weightMultiplier` | 2.5 | 陷阱格落点的权重乘数 |

---

### ④a +10 格吸引 (Bonus 10 Attraction)

| 属性 | 值 |
|---|---|
| 生效模式 | **全部 4 种组合** |
| 默认开关 | `enabled: true` |
| 配置对象 | `BONUS_10_ATTRACTION` |

**作用**：落后者落在 +10 格的点数权重提升。

**触发条件**：`trailPct` ≥ 30（`trailThresholdPct`）

**执行**：对落点是 `bonus_10` 的每个候选点数：
```
weight ×= 2.5
```

| 参数 | 默认值 | 含义 |
|---|---|---|
| `trailThresholdPct` | 30 | trailPct < 此值时跳过 |
| `weightMultiplier` | 2.5 | +10 格落点的权重乘数 |

---

### ④b x2 格调控 (Bonus x2 Control)

| 属性 | 值 |
|---|---|
| 生效模式 | **全部 4 种组合** |
| 默认开关 | `enabled: true` |
| 配置对象 | `BONUS_X2_CONTROL` |

**作用**：对 x2 格的权重分两层调整。

**层1 — 追赶加成**（仅落后者触发）：
- 触发条件：`trailPct` ≥ 30
- 执行：对落点是 `bonus_x2` 的每个候选点数 `weight ×= 2.5`

**层2 — 携带金币过滤**（所有玩家，无条件执行）：
- 携带金币 ≤ 8（`carriedLowThreshold`）：`weight ×= 0.2`（翻倍收益太低，降权）
- 携带金币 ≥ 50（`carriedHighThreshold`）：`weight ×= 0.3`（翻倍收益过强，降权）
- 8 < 携带金币 < 50：不做修改

两层按顺序执行，倍率累乘。

**举例**：某落后玩家 `trailPct = 35`，携带 5 枚金币，sum=8 落在 x2 格：
- 层1 追赶加成：权重 5 × 2.5 = 12.5
- 层2 低金币过滤（5 ≤ 8）：权重 12.5 × 0.2 = **2.5**
- 结果：虽然追赶加成提权了，但携带金币太少又拉回来，最终权重低于原始值 5

**举例**：同一玩家携带 30 枚金币：
- 层1 追赶加成：权重 5 × 2.5 = 12.5
- 层2 中间区间（8 < 30 < 50）：不修改
- 结果：权重 **12.5**，x2 机会明显提升

| 参数 | 默认值 | 含义 |
|---|---|---|
| `trailThresholdPct` | 30 | 追赶加成的触发阈值 |
| `trailWeightMultiplier` | 2.5 | 追赶加成倍率 |
| `carriedLowThreshold` | 8 | 携带金币 ≤ 此值时降权 |
| `carriedLowMultiplier` | 0.2 | 低金币时的权重乘数 |
| `carriedHighThreshold` | 50 | 携带金币 ≥ 此值时降权 |
| `carriedHighMultiplier` | 0.3 | 高金币时的权重乘数 |

---

### ⑤ 落点防重叠 (Bump Avoidance)

| 属性 | 值 |
|---|---|
| 生效模式 | **仅 turn-based**（`turnBasedOnly: true` 时） |
| 默认开关 | `enabled: true` |

**作用**：将所有落在有其他玩家格子上的点数权重乘以 0.2。

**触发条件**：
1. `turnBasedOnly = true` 时，当前必须是 turn-based 模式

**执行**：对落点有其他玩家的每个候选点数：
```
weight ×= 0.2
```

| 参数 | 默认值 | 含义 |
|---|---|---|
| `turnBasedOnly` | true | true = 仅 turn-based 生效；false = 全模式 |
| `weightMultiplier` | 0.2 | 有人格子落点的权重乘数 |

---

### ⑥ 攻击格调控 (Attack Control)

| 属性 | 值 |
|---|---|
| 生效模式 | **全部** |
| 默认开关 | `enabled: true` |

**作用**：当所有对手的 `bankedCoins` 都 < `attackDamage` 时，攻击格权重降为 0（踩了也白踩）。

**执行**：
1. 遍历所有对手，检查是否存在至少一个 `bankedCoins ≥ attackDamage` 的有效目标
2. 若无有效目标，所有落在攻击格的候选点数：`weight ×= 0`

| 参数 | 默认值 | 含义 |
|---|---|---|
| `noTargetMultiplier` | 0 | 无有效目标时攻击格权重乘数 |

---

### ⑦ 同格分散 (Spread Control)

| 属性 | 值 |
|---|---|
| 生效模式 | **仅 simultaneous**（`simultaneousOnly: true` 时） |
| 默认开关 | `enabled: true` |

**作用**：当多个玩家位于同一格时，根据各自在该格内的排名确定性地偏向不同的骰子区间，使他们自然散开而非扎堆行进。

**完整流程**：
1. 筛选出所有与当前玩家同格的玩家
2. 若同格玩家 < 2 人，不触发
3. 将同格玩家按 ID 排序，确定当前玩家的 `rank`（0-indexed）
4. 计算偏向方向 `direction`：
   ```
   direction = (rank / (同格人数 - 1)) × 2 - 1
   ```
   - 2 人时：rank 0 → direction=-1，rank 1 → direction=+1
   - 3 人时：rank 0 → -1，rank 1 → 0（不干预），rank 2 → +1
5. 对每个候选点数：
   ```
   normalized = (sum - 7) / 5       // sum=2 → -1, sum=7 → 0, sum=12 → +1
   weight ×= boostMultiplier ^ (direction × normalized)
   ```

**举例**：2 个玩家（A、B）在同一格，`boostMultiplier = 1.8`：
- 玩家 A（direction=-1）：sum=2 权重 ×= 1.8^((-1)×(-1)) = **1.8**，sum=12 权重 ×= 1.8^((-1)×1) = **0.56**
- 玩家 B（direction=+1）：sum=2 权重 ×= 1.8^(1×(-1)) = **0.56**，sum=12 权重 ×= 1.8^(1×1) = **1.8**
- 结果：A 偏向小点数走近处，B 偏向大点数走远处，自然分开

| 参数 | 默认值 | 含义 |
|---|---|---|
| `simultaneousOnly` | true | true = 仅 simultaneous 生效 |
| `boostMultiplier` | 1.8 | 最极端点数（sum=2/12）的权重倍率 |

---

## 生效模式汇总

| 规则 | Simultaneous + Classic | Simultaneous + Strict Bank | Turn-based + Classic | Turn-based + Strict Bank |
|---|:---:|:---:|:---:|:---:|
| ① 橡皮筋 | ✅ | ✅ | ✅ | ✅ |
| ② 银行格调控 | ❌ | ✅ | ❌ | ✅ |
| ③ 陷阱磁吸 | ✅ | ✅ | ✅ | ✅ |
| ④a +5 吸引 | ✅ | ✅ | ✅ | ✅ |
| ④b x2 调控 | ✅ | ✅ | ✅ | ✅ |
| ⑤ 防重叠 | ❌ | ❌ | ✅ | ✅ |
| ⑥ 攻击格调控 | ✅ | ✅ | ✅ | ✅ |
| ⑦ 同格分散 | ✅ | ✅ | ❌ | ❌ |

## 规则叠加

8 条规则按顺序依次执行，倍率累乘。同一个候选点数可能被多条规则同时影响。

**举例**：某个 sum=6 的候选点数，落点同时是陷阱格，且有其他玩家在上面。当前玩家领先 50%，turn-based 模式：
- ① 橡皮筋：权重 ×= 1.73（领先者偏向小点数，sum=6 得到轻微提升）
- ③ 陷阱磁吸：权重 ×= 2.5（陷阱格提升）
- ⑤ 防重叠：权重 ×= 0.2（有人格子降低）
- 最终：5（原始） × 1.73 × 2.5 × 0.2 = **4.33**

## 调参指南

| 想要的效果 | 修改方式 |
|---|---|
| 完全关闭某条规则 | 对应配置 `enabled: false` |
| 关闭全部调控 | 所有规则 `enabled: false`，回归纯 2D6 |
| 加强追赶效果 | 提高 `RUBBER_BANDING.maxBoostFactor`（如 2→3），或降低 `deviationThresholdPct` |
| 减弱追赶效果 | 降低 `maxBoostFactor`（如 2→1.3），或提高 `deviationThresholdPct` |
| 银行格分段调整 | 修改 `BANK_CONTROL.segments` 数组 |
| 加强对领先者的陷阱惩罚 | 提高 `TRAP_MAGNETISM.segments` 中大 `leadPct` 段的倍率 |
| 实时模式也启用落点防重叠 | `BUMP_AVOIDANCE.turnBasedOnly = false` |
| 加强同格分散力度 | 提高 `SPREAD_CONTROL.boostMultiplier`（如 1.8→2.5） |
| 回合制也启用同格分散 | `SPREAD_CONTROL.simultaneousOnly = false` |
