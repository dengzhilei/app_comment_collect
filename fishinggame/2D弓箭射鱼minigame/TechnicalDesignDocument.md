# 技术实现文档 (TDD) - 深海猎手

**最后更新**: v2.2 (模块化重构)
**用途**: 记录工程结构、类定义、核心算法及配置。修改代码时请同步更新此文件。

---

## 1. 工程结构 (ES6 Modules)
本项目采用 ES6 模块化结构，无需构建工具，现代浏览器直接运行。

```text
/
├── index.html       # 入口 HTML (引入 main.js 作为 module)
├── style.css        # 全局样式
├── main.js          # 启动脚本 (Bootstrap)
└── js/
    ├── Config.js    # 游戏常量配置 (CONFIG, FISH_TYPES)
    ├── Entities.js  # 实体类定义 (Bow, Arrow, Fish, Particle, FloatingText, Boss)
    └── Game.js      # 核心游戏循环与状态管理 (Game 类)
```

## 2. 核心配置 (js/Config.js)
```javascript
export const CONFIG = {
    GAME_DURATION: 45,      // 45秒一局
    FEVER_THRESHOLD: 5,     // 5连击触发 Fever
    BOSS_SPAWN_TIME: 15,    // 倒计时 15s 刷 Boss
    // ... 其他物理参数
};
```

## 3. 核心类 (js/Game.js & js/Entities.js)

### 3.1 `Game` (主控)
*   **职责**：初始化 Canvas，管理 Loop，分发输入事件。
*   **模块依赖**：导入 `Config.js` 和 `Entities.js`。

### 3.2 `Entities` (实体集合)
为减少文件数量，将所有游戏内对象集中在此文件：
*   `Bow`: 玩家控制器。
*   `Arrow`: 投射物。
*   `Fish`: 敌人/目标。
*   `Boss`: 关卡 Boss (含触手逻辑)。
*   `Particle` / `FloatingText`: 视觉特效。

## 4. 关键算法逻辑

### 4.1 模块通信
*   `main.js` -> `new Game()`。
*   `Game` 实例持有所有 Entity 实例。
*   Entity 构造函数接收 `game` 实例引用 (`constructor(game)`)，以便访问全局状态（如 `game.width`, `game.score`）。

### 4.2 Fever 系统
*   状态维护在 `Game` 类 (`feverMode`, `feverTimer`)。
*   UI 渲染在 `Game.drawFeverBar()`。
*   输入行为改变在 `Bow.instantShoot()`。

## 5. 待实现技术点
*   [x] **代码拆分**: 已完成模块化。
*   [ ] **音频管理**: 后续可新建 `js/Audio.js`。
