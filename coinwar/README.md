# 🎲 3D 贪吃蛇大富翁 (3D Snake Monopoly)

这是一个结合了“大富翁”掷骰子走格子机制和“贪吃蛇”金币收集机制的 3D 网页游戏。玩家需要通过掷骰子在环形棋盘上移动，收集金币，避开陷阱，并将金币安全存入银行，率先达到 300 金币的玩家获胜。

## 🏗️ 架构总览

本项目使用 **React 18** + **Vite** 构建，核心 3D 渲染采用 **React Three Fiber (R3F)** 和 **Drei**，状态管理使用 **Zustand**，样式使用 **Tailwind CSS**。

程序采用了**逻辑与视觉分离**的架构：
- **逻辑层 (`store.ts`)**：以离散的“格子”为单位，每 200ms 执行一次 `tick` 计算玩家的绝对位置、金币数量、陷阱触发等。
- **视觉层 (`Player.tsx`, `Game.tsx`)**：以 60FPS 运行，通过 `useFrame` 钩子将玩家的 3D 模型平滑插值（Interpolation）到逻辑位置，实现顺滑的动画效果。

---

## 📂 核心模块说明

### 1. 状态管理 (`src/store.ts`)
整个游戏的大脑，使用 Zustand 管理全局状态。
- **`GameState`**: 定义了所有玩家数据、棋盘格子类型、陷阱、掉落的金币等。
- **`initGame`**: 初始化游戏，生成地图（经典模式/严格模式）并放置固定陷阱。
- **`rollDice`**: 处理玩家掷骰子的逻辑，计算前进步数并设置冷却时间。
- **`tick`**: 游戏的主循环（Game Loop）。每 200ms 执行一次，负责：
  - 处理 AI 玩家的自动掷骰子。
  - 扣减玩家的 `stepsRemaining` 并更新逻辑 `position`。
  - 触发格子事件（收集金币、踩中陷阱掉落金币、到达银行存钱）。
  - 判断胜负条件。

### 2. 渲染引擎与主场景 (`src/Game.tsx`)
负责搭建 3D 场景和游戏主循环的挂载。
- **`Game` 组件**: 挂载 `Canvas`，设置光照（`ambientLight`, `directionalLight`）和环境反射（`Environment`）。
- **`useEffect` 定时器**: 启动 `setInterval`，以 5步/秒 的速度调用 `store.tick`。
- **`CameraController` (摄像机控制器)**: 
  - 核心的第三人称跟随视角逻辑。
  - 获取人类玩家的当前视觉位置，计算出其在 3D 空间中的坐标和朝向。
  - 使用 `THREE.Vector3.lerp` 平滑地将摄像机移动到玩家后上方，并始终看向玩家前方。

### 3. 实体组件 (`src/components/Player.tsx`)
负责渲染 3D 玩家模型及跟随动画。
- **`getInterpolatedPosition`**: 将一维的格子索引（如 `1.5`）转换为 3D 空间中的 `[x, y, z]` 坐标。
- **`PlayerComponent`**:
  - 使用 `useFrame` 在每一帧计算视觉位置（`visualPosRef`）与逻辑位置（`player.position`）的差值，并进行平滑追赶。
  - 根据移动方向计算 `rotation.y`，让角色始终面朝前进方向。
  - 渲染玩家的圆柱体身体、方向指示器（Visor）、头顶的 "ME" 标识，以及背后的金币堆（根据 `carriedCoins` 动态生成网格）。

### 4. 棋盘与环境 (`src/components/Board.tsx` & `CenterLandmark.tsx`)
- **`Board.tsx`**: 
  - 定义了 `BOARD_SIZE` (40格) 和 `GRID_SIZE` (11x11)。
  - `getTilePosition` 函数将 0-39 的一维索引映射到 11x11 网格的边缘，形成一个环形路线。
  - 渲染普通格子、银行（绿色）、奖励点（金色），以及场上的陷阱（红色尖刺）和掉落的金币。
- **`CenterLandmark.tsx`**: 渲染场地中央的装饰性建筑（大银行模型）。

### 5. 用户界面 (`src/components/UI.tsx`)
2D 覆盖层，使用 Tailwind CSS 进行绝对定位。
- **状态栏**: 显示所有玩家的当前存款、携带金币和进度条。
- **操作区**: 提供“掷骰子 (Roll Dice)”和“自动掷骰 (Auto Spin)”按钮。
- **提示信息**: 显示玩家掷出的点数、游戏结束的结算画面等。

---

## ⚙️ 核心机制：逻辑与视觉分离 (Logical vs Visual)

在回合制或走格子的游戏中，如果直接将 3D 模型绑定到逻辑位置，角色的移动会是“瞬移”的（一格一格闪烁）。

为了解决这个问题，本项目采用了以下机制：
1. **逻辑位置 (`player.position`)**: 整数，由 `store.ts` 中的 `tick` 函数控制，每次加 1。
2. **视觉位置 (`visualPosRef`)**: 浮点数，存在于 `Player.tsx` 的组件内部。
3. **追赶逻辑**: 在 `useFrame` (60FPS) 中，组件会检查视觉位置和逻辑位置的差距。如果有差距，视觉位置就会以设定的速度（`moveSpeed`）向逻辑位置平滑增加。
4. **环形处理**: 由于棋盘是环形的（0 到 39），代码中特别处理了跨越起点时的差值计算（例如从 39 走到 0 时，差值会被修正，确保角色向前走而不是倒退一整圈）。
