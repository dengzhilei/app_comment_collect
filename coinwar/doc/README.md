# Coin Runner 3D

3D 网页棋盘游戏。玩家在环形棋盘上掷骰子前进，每走一步收集 1 枚金币，踩到特殊格子触发效果，将携带的金币存入银行（建造中央地标），率先达到目标金额的玩家获胜。

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React 19 + Vite | 前端框架与构建 |
| React Three Fiber + Drei | 3D 渲染（基于 Three.js） |
| Zustand | 全局状态管理 |
| Tailwind CSS 4 | 2D UI 样式 |
| TypeScript | 类型安全 |

---

## 文件结构

```
src/
├── main.tsx              # 入口，挂载 React 根节点
├── App.tsx               # 根组件，渲染 Game
├── index.css             # Tailwind 导入 + 倒计时动画
├── store.ts              # 游戏状态与逻辑（Zustand Store）
├── diceRules.ts          # 骰子调控系统（加权随机）
├── Game.tsx              # 3D 场景容器 + 摄像机控制器 + 飞行金币
└── components/
    ├── UI.tsx            # 2D 覆盖层（菜单 / HUD / GM面板）
    ├── Board.tsx         # 3D 棋盘渲染（格子 / 陷阱 / 掉落金币）
    ├── Player.tsx        # 3D 玩家渲染与移动插值
    ├── CenterLandmark.tsx# 棋盘中央地标建筑（GLB模型渐进显示）
    └── ClippedBuilding.tsx # GLB模型裁剪组件（clipping plane + stencil cap）

doc/
├── README.md             # 本文件
├── GAMEPLAY.md           # 游戏规则文档
├── CAMERA.md             # 镜头逻辑设计文档
└── DICE_RULES.md         # 骰子调控系统文档

public/
└── models/
    └── sculpture.glb     # 中央地标 GLB 模型（~4.6MB, ~8k 三角面）
```

---

## 各模块说明

### `store.ts` — 游戏核心（~730 行）

整个游戏的数据中心和逻辑引擎。

**类型定义：**

- `GameSettings` — 所有可配置参数：棋盘大小 (`boardSize`: 24/32/40)、玩家数 (`playerCount`: 2/3)、回合模式、获胜目标、各类格子数量、陷阱/偷窃比例、攻击伤害、携带上限等
- `Player` — 单个玩家的完整状态：位置、剩余步数、携带金币、已存金币、骰子结果、预设骰子、冷却时间、消息气泡等
- `TileType` — 格子类型：`bank` / `normal` / `bonus_10`(+5) / `bonus_x2`(x2) / `attack`(攻击)
- `GameMode` — `classic`（经过银行存钱）/ `strict_bank`（必须停在银行上）
- `TurnMode` — `simultaneous`（实时同步）/ `turn-based`（轮流回合）
- `FlyingCoin` — 飞行金币动画数据，支持自定义颜色和缩放（攻击时红色大金币）

**坐标系统：**

- `getTilePosition(index, boardSize)` — 将一维格子索引映射到 3D 坐标。棋盘是正方形环形路线，由 `boardSize` 推导出 `gridSize = (boardSize + 4) / 4`，格子沿四条边顺时针排列
- `getHalfGrid(boardSize)` — 计算网格半径，供其他组件缩放用

**地图生成：**

- `distributeEvenly(available, count)` — 在可用位置中均匀选取指定数量的位置
- `generateTiles(mode, settings)` — 生成格子数组：位置 0 固定为银行，其余银行/+5/x2/攻击格均匀分布
- `generateTraps(tiles, trapCount)` — 在普通格上均匀放置陷阱

**核心方法：**

- `initGame(mode, settings)` — 初始化游戏：生成地图、放置陷阱、按 `playerCount` 创建玩家、启动 3-2-1-GO 倒计时
- `rollDice(playerId)` — 手动掷骰子，附带回合/冷却校验和防重复机制
- `setNextDice(playerId, dice)` — GM 功能：预设指定玩家下一次骰子结果
- `tick()` — 游戏主循环（每 200ms 调用一次），职责包括：
  - 回合切换（轮流模式下检测当前玩家是否行动完毕）
  - 预计算骰子结果 + 自动掷骰倒计时（AI 即时或延迟，人类 5s 倒计时）
  - 逐格移动（每次 position +1）+ 每步收集 1 金币
  - 携带上限检查（超过 `carryLimit` 的金币直接消失）
  - 拾取掉落金币、偷窃同格玩家
  - 经过/停在银行时存钱（区分 classic/strict_bank）
  - 落地效果：+5 格、x2 格、攻击格（攻击对手建筑最高者）、陷阱
  - 轮流模式碰撞闪避（最后一步落点有人则多走一步）
  - 飞行金币动画数据管理与清理
  - 胜利判定

---

### `diceRules.ts` — 骰子调控系统（~435 行）

独立的骰子操纵引擎，采用**加权随机选择**架构。详见 `doc/DICE_RULES.md`，要点：

- 列出 2\~12 共 11 个候选总点数，赋予 2D6 自然概率权重
- 按规则管线逐条修改权重：橡皮筋 → 银行格调控 → 陷阱磁吸 → +5 吸引 → x2 调控 → 攻击格调控 → 落点防重叠 → 同格分散
- 根据最终权重做加权随机，选出总点数后随机拆为骰子对
- 任何异常自动回退到纯随机 2D6

---

### `Game.tsx` — 3D 场景与摄像机（~376 行）

**`Game` 组件：**

顶层容器。挂载 R3F `<Canvas>`（启用 `localClippingEnabled` 和 `stencil`），配置光照（环境光 + 方向光 + 阴影）、`<Environment>` 反射、`<ContactShadows>` 接触阴影。通过 `setInterval(tick, 200)` 驱动游戏主循环。

**`CameraController` 组件：**

无渲染输出的纯逻辑组件，在 `useFrame` 中每帧计算摄像机位置。详细逻辑见 `doc/CAMERA.md`，要点：

- **回合制 - 人类回合：** 带 ±2 格死区的平滑跟随；回合切换到远处时硬切 + 0.5s 暂停
- **回合制 - AI 回合：** 掷骰子瞬间一次性计算静态机位（如果视野范围 ±12 格够用就不切），移动过程中镜头绝对静止
- **实时模式：** 始终平滑跟随人类玩家
- 三种视角可切换：follow（第三人称跟随）、isometric（等距俯视）、top-down（正上方）
- 支持 `cameraZoom`（远近缩放 0.5\~2.0x）和 `cameraHeight`（俯仰角 -1.0\~1.0）

**`FlyingCoins` / `FlyingCoinMesh` 组件：**

渲染金币飞行动画（存钱、拾取、偷窃、陷阱掉落、攻击建筑时触发）。每个金币沿抛物线弧形轨迹移动，带旋转和淡出效果。支持自定义颜色（攻击时红色）和缩放。

---

### `components/Player.tsx` — 玩家渲染（~170 行）

**`getInterpolatedPosition(vPos, boardSize)`：**

核心插值函数。接收浮点数格子索引（如 `3.7`），在相邻两格的 3D 坐标之间线性插值，返回精确的空间位置。供 PlayerComponent 和 CameraController 共用。

**`PlayerComponent`：**

- 在 `useFrame` 中维护 `visualPosRef`（浮点数），每帧向逻辑 `position`（整数）平滑追赶（5 格/秒），处理环形棋盘跨越边界的情况
- 根据移动方向计算朝向角度；多个玩家在同一位置时按垂直于行进方向的偏移避免重叠
- 移动中有正弦波跳跃动画
- 渲染：圆柱体身体 + 面罩（指示朝向） + 人类玩家头顶 "ME" 标识 + 背后金币堆（最多 100 个 mesh）+ 消息气泡（攻击伤害消息特殊加大加橙红色）

---

### `components/Board.tsx` — 棋盘渲染（~137 行）

遍历 `tiles` 数组，对每个格子调用 `getTilePosition` 获取 3D 坐标，渲染对应颜色的方块：

| 格子类型 | 颜色 | 标签 |
|----------|------|------|
| bank | 黄色 `#fcd34d` | BANK |
| bonus_10 | 翠绿 `#6ee7b7` | +5 |
| bonus_x2 | 紫色 `#c084fc` | x2 |
| attack | 橙色 `#fb923c` | ATK |
| normal | 灰色 `#e5e7eb` | 无 |

另外渲染陷阱（红色方块）和掉落金币堆（带数量标签，最多 50 个金币 mesh）。

---

### `components/CenterLandmark.tsx` — 中央地标建筑（~62 行）

棋盘中央的核心视觉组件。每个玩家对应一座 GLB 雕塑模型，通过 Three.js clipping plane 按存款进度（`bankedCoins / winTarget`）从底部向上渐进显示，模拟"建造"过程。

- 使用 `ClippedBuilding` 组件加载和裁剪 GLB 模型
- 模型底部有玩家颜色标识环
- 模型上方有 Billboard 显示当前存款数字
- 所有尺寸按 `halfGrid / 5` 缩放以适配不同棋盘大小
- 每个玩家使用不同的 `renderOrderBase` 隔离 stencil buffer

### `components/ClippedBuilding.tsx` — GLB 模型裁剪（~191 行）

底层 3D 渲染组件，实现 GLB 模型的渐进显示效果：

- 加载 GLB 模型并自动归一化（缩放到统一大小、居中对齐）
- 使用 `THREE.Plane` 裁剪面实现水平切割
- 使用 **stencil buffer 技术** 填充截面（参照 Three.js 官方 `webgl_clipping_stencil` 示例）：
  - 背面 mesh 递增 stencil 值，正面 mesh 递减
  - cap plane 在 stencil ≠ 0 处绘制实心截面
  - 每个实例的 `onAfterRender` 清除 stencil buffer
- stencilGroup 和 capPlaneMesh 挂到 scene 根节点（避免嵌套 group 变换干扰）
- 支持 `progress`（0\~1）平滑动画和多实例 `renderOrderBase` 隔离

---

### `components/UI.tsx` — 2D 界面（~670 行）

管理多个界面状态：

**1. 开始菜单（游戏未开始时）：**

所有游戏参数的配置面板，分为：
- 基础设置：陷阱掉落比例、偷窃比例、回合模式
- 棋盘设置：棋盘大小（24/32/40 格）、玩家数（2/3 人），切换时联动更新默认参数
- 地图布局：银行/陷阱/+5/x2/攻击格数量滑块（范围上限随棋盘大小调整）
- 攻击伤害、携带上限
- 胜利目标、游戏模式（Pass Bank / Land On Bank）、AI 延迟

**2. 游戏中 HUD：**

- 顶部：玩家状态卡片（存款进度条、携带金币、骰子结果、思考倒计时）
- 底部：掷骰子按钮（含状态文字：ROLL DICE / RUN / CD / OPPONENT'S TURN）+ Auto Spin 开关
- 右上：摄像机视角切换 + 返回菜单 + Zoom/Pitch 调节滑块
- 左下：格子类型图例
- 右下：GM 面板（可折叠，设置下一次骰子步数）

**3. 倒计时画面：**

开局 3-2-1-GO 倒计时覆盖层，带缩放动画，确保公平起步。

**4. 胜利画面：**

显示胜者、Play Again / Menu 按钮。

---

## 核心架构：逻辑与视觉分离

| 层 | 更新频率 | 数据 | 位置 |
|----|---------|------|------|
| 逻辑层 | 5 次/秒 (200ms) | `player.position`（整数） | `store.ts` 的 `tick()` |
| 视觉层 | 60 FPS | `visualPosRef`（浮点数） | `Player.tsx` / `Game.tsx` 的 `useFrame` |

逻辑层以离散格为单位推进游戏状态，视觉层在每一帧将 3D 模型平滑插值到逻辑位置。环形棋盘的跨越边界（如从最后一格走到第 0 格）通过差值修正保证角色始终向前移动。
