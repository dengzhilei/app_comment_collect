// 游戏状态管理
class GameState {
    constructor() {
        this.money = 100;
        this.diceCount = 5;
        this.playerPosition = 0;
        this.fishInventory = {};
        this.buildings = {};
        this.diceResult = 0;
        this.canFish = false;
        this.boardSize = 20; // 棋盘总格子数
        this.fishingSpots = new Set([3, 7, 11, 15, 19]); // 可以钓鱼的格子
        
        // 潮汐系统
        this.TIDE_STATES = {
            NORMAL: 'normal',
            HIGH: 'high-tide',
            LOW: 'low-tide'
        };
        this.currentTide = this.TIDE_STATES.NORMAL;
        this.turnCount = 0;
        this.turnsToNextTide = 10;
        this.autoSell = false;
        
        // 格子属性系统
        this.tileProperties = {};
        for (let i = 0; i < this.boardSize; i++) {
            if (this.fishingSpots.has(i)) {
                this.tileProperties[i] = {
                    level: 1, // 等级
                    baseRate: 0.2, // 基础概率
                    bonusRate: 0, // 额外概率（打窝获得）
                    multiplier: 1 // 倍率
                };
            }
        }
    }

    // 升级格子（打窝）
    upgradeTile(index) {
        if (!this.fishingSpots.has(index)) return false;
        
        const tile = this.tileProperties[index];
        const cost = tile.level * 100; // 升级费用：等级 * 100
        
        if (this.money >= cost) {
            this.money -= cost;
            tile.level++;
            tile.bonusRate += 0.1; // 每级增加10%概率
            this.addLog(`✨ 成功在位置${index + 1}打窝！等级提升至${tile.level}`);
            return true;
        } else {
            this.addLog('❌ 金钱不足，无法打窝！');
            return false;
        }
    }

    // 更新UI显示
    updateUI() {
        document.getElementById('money').textContent = this.money;
        document.getElementById('dice-count').textContent = this.diceCount;
        document.getElementById('player-position').textContent = this.playerPosition;
        
        // 更新潮汐状态显示
        this.updateTideUI();
        
        // 更新GM面板输入框
        const gmMoneyInput = document.getElementById('gm-money-input');
        const gmDiceInput = document.getElementById('gm-dice-input');
        const gmPositionInput = document.getElementById('gm-position-input');
        if (gmMoneyInput) gmMoneyInput.value = this.money;
        if (gmDiceInput) gmDiceInput.value = this.diceCount;
        if (gmPositionInput) gmPositionInput.value = this.playerPosition;
        
        // 更新鱼获库存显示
        this.updateFishInventory();
        
        // 更新按钮状态
        this.updateButtonStates();
        
        // 更新建造列表
        this.updateBuildList();
    }

    updateTideUI() {
        const tideEl = document.getElementById('tide-status');
        const nameEl = document.getElementById('tide-name');
        const counterEl = document.getElementById('tide-counter');
        
        // 移除旧类名
        tideEl.classList.remove('normal', 'high-tide', 'low-tide');
        tideEl.classList.add(this.currentTide);
        
        let tideName = '平潮';
        let tideIcon = '🌊';
        
        if (this.currentTide === this.TIDE_STATES.HIGH) {
            tideName = '涨潮 (量大)';
            tideIcon = '🔥';
        } else if (this.currentTide === this.TIDE_STATES.LOW) {
            tideName = '退潮 (质优)';
            tideIcon = '💎';
        }
        
        nameEl.textContent = tideName;
        document.querySelector('.tide-icon').textContent = tideIcon;
        counterEl.textContent = `${this.turnsToNextTide}回合后变化`;
    }

    updateFishInventory() {
        const inventoryEl = document.getElementById('fish-inventory');
        inventoryEl.innerHTML = '';
        
        if (Object.keys(this.fishInventory).length === 0) {
            inventoryEl.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无鱼获</div>';
            return;
        }

        for (const [fishType, count] of Object.entries(this.fishInventory)) {
            const item = document.createElement('div');
            item.className = 'inventory-item';
            item.innerHTML = `
                <span>${fishType}</span>
                <span style="font-weight: bold; color: #667eea;">x${count}</span>
            `;
            inventoryEl.appendChild(item);
        }
    }

    updateButtonStates() {
        const rollBtn = document.getElementById('roll-dice-btn');
        // const fishBtn = document.getElementById('fish-btn');
        const sellBtn = document.getElementById('sell-fish-btn');

        rollBtn.disabled = this.diceCount <= 0;
        // fishBtn.disabled = !this.canFish;
        sellBtn.disabled = Object.keys(this.fishInventory).length === 0;
    }

    updateBuildList() {
        const buildListEl = document.getElementById('build-list');
        buildListEl.innerHTML = '';

        const buildings = [
            { id: 'dock', name: '码头', cost: 200, desc: '增加钓鱼成功率', owned: this.buildings.dock || false },
            { id: 'shop', name: '渔具店', cost: 150, desc: '降低骰子价格', owned: this.buildings.shop || false },
            { id: 'market', name: '市场', cost: 300, desc: '提高鱼获售价', owned: this.buildings.market || false },
            { id: 'factory', name: '加工厂', cost: 500, desc: '自动加工鱼获', owned: this.buildings.factory || false }
        ];

        buildings.forEach(building => {
            const item = document.createElement('div');
            item.className = 'build-item';
            item.innerHTML = `
                <div class="build-item-header">
                    <span class="build-item-name">${building.name}</span>
                    <span class="build-item-cost">💰 ${building.cost}</span>
                </div>
                <div class="build-item-desc">${building.desc}</div>
                <button class="build-item-btn" 
                        data-building="${building.id}" 
                        data-cost="${building.cost}"
                        ${building.owned ? 'disabled' : ''}
                        ${this.money < building.cost ? 'disabled' : ''}>
                    ${building.owned ? '已拥有' : '建造'}
                </button>
            `;
            buildListEl.appendChild(item);
        });
    }

    addLog(message) {
        const logContent = document.getElementById('log-content');
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContent.insertBefore(entry, logContent.firstChild);
        
        // 限制日志数量
        while (logContent.children.length > 20) {
            logContent.removeChild(logContent.lastChild);
        }
    }
}

// 棋盘渲染
class BoardRenderer {
    constructor(canvas, gameState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameState = gameState;
        this.cellSize = 80;
        this.padding = 50;
        
        // 特效系统
        this.effects = [];
        this.isAnimating = false;
    }

    // 添加飘字特效
    addFloatingText(x, y, text, color = '#ff9800', size = 20) {
        this.effects.push({
            type: 'text',
            x: x,
            y: y,
            text: text,
            color: color,
            size: size,
            alpha: 1,
            velocity: { x: (Math.random() - 0.5) * 1, y: -2 }, // 向上飘
            life: 60 // 持续60帧（约1秒）
        });
        
        if (!this.isAnimating) {
            this.startAnimationLoop();
        }
    }

    // 添加连线特效
    addChainEffect(startPos, endPos) {
        this.effects.push({
            type: 'chain',
            startX: startPos.x + this.cellSize / 2,
            startY: startPos.y + this.cellSize / 2,
            endX: endPos.x + this.cellSize / 2,
            endY: endPos.y + this.cellSize / 2,
            life: 20,
            color: '#00e5ff'
        });

        if (!this.isAnimating) {
            this.startAnimationLoop();
        }
    }

    startAnimationLoop() {
        this.isAnimating = true;
        const animate = () => {
            if (this.effects.length === 0) {
                this.isAnimating = false;
                this.render(); // 最后一帧清除
                return;
            }
            
            this.render();
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 潮汐背景滤镜
        if (this.gameState.currentTide === this.gameState.TIDE_STATES.HIGH) {
            this.ctx.fillStyle = 'rgba(255, 154, 158, 0.1)'; // 暖色
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.gameState.currentTide === this.gameState.TIDE_STATES.LOW) {
            this.ctx.fillStyle = 'rgba(102, 126, 234, 0.1)'; // 冷色
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        const boardSize = this.gameState.boardSize;
        const positions = this.calculatePositions(boardSize);
        
        // 绘制格子
        positions.forEach((pos, index) => {
            this.drawCell(pos.x, pos.y, pos.rotation, index);
        });

        // 绘制玩家
        this.drawPlayer(positions[this.gameState.playerPosition]);

        // 绘制特效
        this.drawEffects();
    }

    drawEffects() {
        // 更新并绘制所有特效
        for (let i = this.effects.length - 1; i >= 0; i--) {
            const effect = this.effects[i];
            
            if (effect.type === 'text') {
                this.ctx.save();
                this.ctx.globalAlpha = effect.alpha;
                this.ctx.fillStyle = effect.color;
                this.ctx.font = `bold ${effect.size}px Arial`;
                this.ctx.textAlign = 'center';
                // 文字描边
                this.ctx.strokeStyle = 'white';
                this.ctx.lineWidth = 3;
                this.ctx.strokeText(effect.text, effect.x, effect.y);
                this.ctx.fillText(effect.text, effect.x, effect.y);
                this.ctx.restore();
                
                // 更新状态
                effect.x += effect.velocity.x;
                effect.y += effect.velocity.y;
                effect.alpha -= 0.015;
                effect.life--;
            } else if (effect.type === 'chain') {
                this.ctx.save();
                this.ctx.strokeStyle = effect.color;
                this.ctx.lineWidth = 4;
                this.ctx.globalAlpha = effect.life / 20;
                this.ctx.beginPath();
                this.ctx.moveTo(effect.startX, effect.startY);
                this.ctx.lineTo(effect.endX, effect.endY);
                this.ctx.stroke();
                this.ctx.restore();
                
                effect.life--;
            }
            
            if (effect.life <= 0) {
                this.effects.splice(i, 1);
            }
        }
    }

    getPosition(index) {
        const positions = this.calculatePositions(this.gameState.boardSize);
        return positions[index];
    }

    calculatePositions(size) {
        const positions = [];
        // 将棋盘分为4条边，每条边的格子数
        const cellsPerSide = size / 4; // 20 / 4 = 5
        
        // 计算棋盘尺寸（每条边的总长度）
        const sideLength = cellsPerSide * this.cellSize;
        const startX = this.padding;
        const startY = this.padding;
        
        for (let i = 0; i < size; i++) {
            let x, y, rotation = 0;
            
            if (i < cellsPerSide) {
                // 底部边：从左到右 (0 到 cellsPerSide-1)
                // 起点在左下角
                x = startX + i * this.cellSize;
                y = startY + sideLength;
                rotation = 0; // 正常方向（向上）
            } else if (i < cellsPerSide * 2) {
                // 右边：从下到上 (cellsPerSide 到 cellsPerSide*2-1)
                const index = i - cellsPerSide;
                x = startX + sideLength;
                y = startY + sideLength - index * this.cellSize;
                rotation = 90; // 顺时针旋转90度（向左）
            } else if (i < cellsPerSide * 3) {
                // 顶部边：从右到左 (cellsPerSide*2 到 cellsPerSide*3-1)
                const index = i - cellsPerSide * 2;
                x = startX + sideLength - index * this.cellSize;
                y = startY;
                rotation = 180; // 旋转180度（向下）
            } else {
                // 左边：从上到下 (cellsPerSide*3 到 size-1)
                const index = i - cellsPerSide * 3;
                x = startX;
                y = startY + index * this.cellSize;
                rotation = 270; // 旋转270度（向右）
            }
            
            positions.push({ x, y, rotation, index: i });
        }
        
        return positions;
    }

    drawCell(x, y, rotation, index) {
        const isFishingSpot = this.gameState.fishingSpots.has(index);
        const isPlayerHere = index === this.gameState.playerPosition;
        const cellWidth = this.cellSize - 5;
        const cellHeight = this.cellSize - 5;
        
        // 格子背景
        this.ctx.fillStyle = isFishingSpot ? '#e8f5e9' : '#fff';
        this.ctx.fillRect(x, y, cellWidth, cellHeight);
        
        // 格子边框
        this.ctx.strokeStyle = isFishingSpot ? '#4caf50' : '#ccc';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, cellWidth, cellHeight);
        
        // 保存当前画布状态用于旋转文字
        this.ctx.save();
        
        // 移动到格子中心并旋转
        const centerX = x + cellWidth / 2;
        const centerY = y + cellHeight / 2;
        this.ctx.translate(centerX, centerY);
        this.ctx.rotate((rotation * Math.PI) / 180);
        
        // 格子编号
        this.ctx.fillStyle = '#666';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText((index + 1).toString(), 0, -cellHeight / 2 + 15);
        
        // 钓鱼标记
        if (isFishingSpot) {
            const tile = this.gameState.tileProperties[index];
            this.ctx.font = '28px Arial';
            this.ctx.fillText('🎣', 0, cellHeight / 2 - 15);
            
            // 显示等级
            if (tile && tile.level > 1) {
                this.ctx.font = 'bold 12px Arial';
                this.ctx.fillStyle = '#ff9800';
                this.ctx.fillText(`Lv.${tile.level}`, 0, cellHeight / 2 + 10);
            }
        }
        
        // 恢复画布状态
        this.ctx.restore();
        
        // 玩家位置高亮（不需要旋转）
        if (isPlayerHere) {
            this.ctx.strokeStyle = '#667eea';
            this.ctx.lineWidth = 4;
            this.ctx.strokeRect(x - 3, y - 3, cellWidth + 6, cellHeight + 6);
        }
    }

    drawPlayer(position) {
        const centerX = position.x + this.cellSize / 2;
        const centerY = position.y + this.cellSize / 2;
        
        // 玩家圆圈
        this.ctx.fillStyle = '#667eea';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, 15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 玩家图标
        this.ctx.fillStyle = 'white';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('👤', centerX, centerY + 7);
        this.ctx.textAlign = 'left';
    }
}

// 游戏主逻辑
class Game {
    constructor() {
        this.gameState = new GameState();
        this.boardRenderer = new BoardRenderer(
            document.getElementById('game-board'),
            this.gameState
        );
        
        this.initEventListeners();
        this.gameState.updateUI();
        this.boardRenderer.render();
    }

    initEventListeners() {
        // 掷骰子
        document.getElementById('roll-dice-btn').addEventListener('click', () => {
            this.rollDice();
        });

        // 卖鱼
        document.getElementById('sell-fish-btn').addEventListener('click', () => {
            this.sellFish();
        });

        // 建造
        document.getElementById('build-list').addEventListener('click', (e) => {
            if (e.target.classList.contains('build-item-btn')) {
                const buildingId = e.target.dataset.building;
                const cost = parseInt(e.target.dataset.cost);
                this.build(buildingId, cost);
            }
        });

        // GM面板
        this.initGMPanel();

        // 自动卖鱼开关
        document.getElementById('auto-sell-check').addEventListener('change', (e) => {
            this.gameState.autoSell = e.target.checked;
            if (this.gameState.autoSell) {
                this.sellFish(); // 开启时立即卖出当前库存
            }
        });

        // 监听Canvas点击（打窝）
        const canvas = document.getElementById('game-board');
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.handleBoardClick(x, y);
        });
    }

    handleBoardClick(x, y) {
        // 简单的点击检测，基于BoardRenderer的计算逻辑
        // 由于没有反向映射，我们需要重新遍历所有格子的位置来检测点击
        // 这里的逻辑有点耦合，理想情况是BoardRenderer提供 hitTest 方法
        const boardSize = this.gameState.boardSize;
        const positions = this.boardRenderer.calculatePositions(boardSize);
        const cellSize = this.boardRenderer.cellSize;

        for (const pos of positions) {
            if (x >= pos.x && x <= pos.x + cellSize &&
                y >= pos.y && y <= pos.y + cellSize) {
                
                // 点击了格子 pos.index
                if (this.gameState.fishingSpots.has(pos.index)) {
                    this.showTileUpgradeMenu(pos.index);
                }
                break;
            }
        }
    }

    showTileUpgradeMenu(index) {
        const tile = this.gameState.tileProperties[index];
        const cost = tile.level * 100;
        
        if (confirm(`【位置${index + 1}】\n当前等级：${tile.level}\n中鱼率加成：+${Math.round(tile.bonusRate * 100)}%\n\n是否花费 ${cost} 金币进行打窝升级？`)) {
            if (this.gameState.upgradeTile(index)) {
                this.gameState.updateUI();
                this.boardRenderer.render();
            }
        }
    }

    initGMPanel() {
        const gmPanel = document.getElementById('gm-panel');
        const gmToggleBtn = document.getElementById('gm-toggle-btn');
        const gmCloseBtn = document.getElementById('gm-close-btn');

        // 切换GM面板显示
        const togglePanel = () => {
            gmPanel.classList.toggle('hidden');
        };

        gmToggleBtn.addEventListener('click', togglePanel);
        gmCloseBtn.addEventListener('click', togglePanel);

        // 快捷键G打开/关闭GM面板
        document.addEventListener('keydown', (e) => {
            if (e.key === 'g' || e.key === 'G') {
                if (!e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    togglePanel();
                }
            }
        });

        // GM面板按钮事件
        document.querySelectorAll('.gm-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleGMAction(action);
            });
        });

        // 输入框直接设置功能
        document.getElementById('gm-money-input').addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value >= 0) {
                this.gameState.money = value;
                this.gameState.addLog(`🎮 GM: 设置金钱为${value}`);
                this.gameState.updateUI();
            }
        });

        document.getElementById('gm-dice-input').addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 0;
            if (value >= 0) {
                this.gameState.diceCount = value;
                this.gameState.addLog(`🎮 GM: 设置骰子为${value}`);
                this.gameState.updateUI();
            }
        });
    }

    handleGMAction(action) {
        switch(action) {
            case 'add-money':
                this.gameState.money += 100;
                this.gameState.addLog('🎮 GM: 添加100金币');
                break;
            case 'add-money-500':
                this.gameState.money += 500;
                this.gameState.addLog('🎮 GM: 添加500金币');
                break;
            case 'add-money-1000':
                this.gameState.money += 1000;
                this.gameState.addLog('🎮 GM: 添加1000金币');
                break;
            case 'add-dice':
                this.gameState.diceCount += 5;
                this.gameState.addLog('🎮 GM: 添加5个骰子');
                break;
            case 'add-dice-10':
                this.gameState.diceCount += 10;
                this.gameState.addLog('🎮 GM: 添加10个骰子');
                break;
            case 'add-dice-20':
                this.gameState.diceCount += 20;
                this.gameState.addLog('🎮 GM: 添加20个骰子');
                break;
            case 'add-fish':
                const fishType = document.getElementById('gm-fish-select').value;
                const fishCount = parseInt(document.getElementById('gm-fish-count').value) || 1;
                this.gameState.fishInventory[fishType] = (this.gameState.fishInventory[fishType] || 0) + fishCount;
                this.gameState.addLog(`🎮 GM: 添加${fishCount}条${fishType}`);
                break;
            case 'set-position':
                const position = parseInt(document.getElementById('gm-position-input').value) || 0;
                if (position >= 0 && position < this.gameState.boardSize) {
                    this.gameState.playerPosition = position;
                    this.gameState.canFish = this.gameState.fishingSpots.has(position);
                    this.gameState.addLog(`🎮 GM: 传送到位置${position + 1}`);
                    this.boardRenderer.render();
                }
                break;
            case 'build-all':
                const buildings = ['dock', 'shop', 'market', 'factory'];
                buildings.forEach(buildingId => {
                    if (!this.gameState.buildings[buildingId]) {
                        this.gameState.buildings[buildingId] = true;
                    }
                });
                this.gameState.addLog('🎮 GM: 建造所有设施');
                break;
            case 'clear-buildings':
                this.gameState.buildings = {};
                this.gameState.addLog('🎮 GM: 清除所有设施');
                break;
            case 'max-resources':
                this.gameState.money = 999999;
                this.gameState.diceCount = 999;
                this.gameState.addLog('🎮 GM: 资源拉满！');
                break;
            case 'reset-game':
                if (confirm('确定要重置游戏吗？所有进度将丢失！')) {
                    this.gameState.money = 100;
                    this.gameState.diceCount = 5;
                    this.gameState.playerPosition = 0;
                    this.gameState.fishInventory = {};
                    this.gameState.buildings = {};
                    this.gameState.canFish = false;
                    this.gameState.addLog('🎮 GM: 游戏已重置');
                    this.boardRenderer.render();
                }
                break;
        }
        this.gameState.updateUI();
    }

    async rollDice() {
        if (this.gameState.diceCount <= 0) {
            this.gameState.addLog('❌ 骰子不足！');
            return;
        }

        const rollBtn = document.getElementById('roll-dice-btn');
        rollBtn.disabled = true;

        // 消耗骰子
        this.gameState.diceCount--;
        
        // 掷骰子（1-6）
        this.gameState.diceResult = Math.floor(Math.random() * 6) + 1;
        
        // 更新回合和潮汐
        this.updateTurn();
        
        // 更新显示
        document.getElementById('dice-result').textContent = `🎲 掷出: ${this.gameState.diceResult}`;
        this.gameState.addLog(`🎲 掷出 ${this.gameState.diceResult}，开始移动...`);
        this.gameState.updateUI();

        // 逐格移动
        for (let i = 0; i < this.gameState.diceResult; i++) {
            this.gameState.playerPosition = (this.gameState.playerPosition + 1) % this.gameState.boardSize;
            this.boardRenderer.render();
            
            // 触发格子效果
            await this.checkTileTrigger(this.gameState.playerPosition);
            
            // 简单的移动延迟效果
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        this.gameState.addLog(`📍 移动结束，停在位置 ${this.gameState.playerPosition + 1}`);
        rollBtn.disabled = false;
        this.gameState.updateUI();
    }

    updateTurn() {
        this.gameState.turnsToNextTide--;
        
        if (this.gameState.turnsToNextTide <= 0) {
            this.gameState.turnsToNextTide = 10; // 重置计数
            this.changeTide();
        }
    }

    changeTide() {
        // 简单的循环切换：平潮 -> 涨潮 -> 平潮 -> 退潮
        const states = [
            this.gameState.TIDE_STATES.NORMAL,
            this.gameState.TIDE_STATES.HIGH,
            this.gameState.TIDE_STATES.NORMAL,
            this.gameState.TIDE_STATES.LOW
        ];
        
        // 找到当前状态的索引，移动到下一个
        let currentIndex = states.indexOf(this.gameState.currentTide);
        let nextIndex = (currentIndex + 1) % states.length;
        
        this.gameState.currentTide = states[nextIndex];
        
        let msg = '';
        if (this.gameState.currentTide === this.gameState.TIDE_STATES.HIGH) {
            msg = '🔥 涨潮时刻！鱼群涌入，所有格子中鱼率翻倍！';
        } else if (this.gameState.currentTide === this.gameState.TIDE_STATES.LOW) {
            msg = '💎 退潮时刻！深水区显露，必出稀有鱼！';
        } else {
            msg = '🌊 潮汐恢复平稳。';
        }
        
        this.gameState.addLog(msg);
        this.gameState.updateUI();
    }

    async checkTileTrigger(position) {
        // 钓鱼判定
        if (this.gameState.fishingSpots.has(position)) {
            await this.tryAutoFish(position);
        }
    }

    async tryAutoFish(position, isChainReaction = false) {
        const tile = this.gameState.tileProperties[position];
        if (!tile) return;

        let successRate = tile.baseRate + tile.bonusRate;
        if (this.gameState.buildings.dock) successRate += 0.2;
        
        // 潮汐影响概率
        if (this.gameState.currentTide === this.gameState.TIDE_STATES.HIGH) {
            successRate *= 2; // 涨潮翻倍
        } else if (this.gameState.currentTide === this.gameState.TIDE_STATES.LOW) {
            // 退潮时，只有高级格子（深水区）能钓鱼
            if (tile.level < 2) successRate = 0; 
            else successRate = 1.0; // 深水区必中
        }
        
        successRate = Math.min(0.95, successRate);

        if (Math.random() < successRate) {
            // 成功钓鱼
            const fishTypes = ['小黄鱼', '带鱼', '鲈鱼', '金枪鱼', '三文鱼'];
            let weights = [0.4, 0.3, 0.2, 0.08, 0.02]; 
            
            // 调整稀有度
            if (this.gameState.currentTide === this.gameState.TIDE_STATES.HIGH) {
                // 涨潮：全是普通鱼
                weights = [0.6, 0.3, 0.1, 0, 0];
            } else if (this.gameState.currentTide === this.gameState.TIDE_STATES.LOW) {
                // 退潮：必出稀有鱼
                weights = [0, 0, 0.2, 0.5, 0.3];
            } else if (tile.level > 1) {
                const shift = (tile.level - 1) * 0.05;
                weights[0] = Math.max(0.1, weights[0] - shift);
                weights[4] = Math.min(0.3, weights[4] + shift);
            }
            
            let random = Math.random();
            let fishType = fishTypes[0];
            let cumulative = 0;
            
            for (let i = 0; i < fishTypes.length; i++) {
                cumulative += weights[i];
                if (random <= cumulative) {
                    fishType = fishTypes[i];
                    break;
                }
            }

            // 添加到库存
            this.gameState.fishInventory[fishType] = (this.gameState.fishInventory[fishType] || 0) + 1;
            
            const chainText = isChainReaction ? '⚡连锁触发！' : '';
            this.gameState.addLog(`${chainText}✨ 在位置${position + 1} 钓到了 ${fishType}！`);
            this.gameState.updateUI();

            // 飘字特效
            const pos = this.boardRenderer.getPosition(position);
            const centerX = pos.x + this.boardRenderer.cellSize / 2;
            const centerY = pos.y + this.boardRenderer.cellSize / 2;
            
            let color = '#ff9800'; // 默认橙色
            let size = 20;
            if (fishType === '金枪鱼' || fishType === '三文鱼') {
                color = '#e91e63'; // 稀有鱼粉色
                size = 30;
            }
            
            this.boardRenderer.addFloatingText(centerX, centerY - 20, `+${fishType}`, color, size);
            if (isChainReaction) {
                this.boardRenderer.addFloatingText(centerX, centerY - 50, '⚡连锁!', '#00e5ff', 24);
            }

            // 自动卖鱼逻辑
            if (this.gameState.autoSell) {
                // 简单的自动卖鱼实现：调用 sellFish
                // 但为了不频繁刷新日志，我们可以做一个简单的静默卖出，或者仅仅卖出这一条
                this.sellSingleFish(fishType, centerX, centerY);
            }

            // 触发连锁反应（仅在非连锁触发时）
            if (!isChainReaction) {
                await this.triggerChainReaction(position);
            }
        }
    }

    sellSingleFish(fishType, x, y) {
        const fishPrices = {
            '小黄鱼': 10, '带鱼': 20, '鲈鱼': 30, '金枪鱼': 50, '三文鱼': 80
        };
        const priceMultiplier = this.gameState.buildings.market ? 1.5 : 1;
        const price = Math.floor(fishPrices[fishType] * priceMultiplier);
        
        this.gameState.money += price;
        this.gameState.fishInventory[fishType]--;
        if (this.gameState.fishInventory[fishType] <= 0) {
            delete this.gameState.fishInventory[fishType];
        }
        
        // 飘金币字
        this.boardRenderer.addFloatingText(x, y - 40, `+${price}💰`, '#ffd700', 20);
        this.gameState.updateUI();
    }

    async triggerChainReaction(position) {
        // 检查前后相邻格子
        const neighbors = [
            (position - 1 + this.gameState.boardSize) % this.gameState.boardSize,
            (position + 1) % this.gameState.boardSize
        ];

        for (const neighborPos of neighbors) {
            const neighborTile = this.gameState.tileProperties[neighborPos];
            // 连锁条件：相邻也是钓鱼点，且等级>=2
            if (neighborTile && neighborTile.level >= 2) {
                // 连线特效
                const startPos = this.boardRenderer.getPosition(position);
                const endPos = this.boardRenderer.getPosition(neighborPos);
                this.boardRenderer.addChainEffect(startPos, endPos);
                
                await new Promise(resolve => setTimeout(resolve, 200)); // 连锁延迟
                await this.tryAutoFish(neighborPos, true);
            }
        }
    }

    sellFish() {
        if (Object.keys(this.gameState.fishInventory).length === 0) {
            this.gameState.addLog('❌ 没有鱼可以卖！');
            return;
        }

        // 鱼的价格
        const fishPrices = {
            '小黄鱼': 10,
            '带鱼': 20,
            '鲈鱼': 30,
            '金枪鱼': 50,
            '三文鱼': 80
        };

        // 如果有市场，提高价格
        const priceMultiplier = this.gameState.buildings.market ? 1.5 : 1;

        let totalEarned = 0;
        for (const [fishType, count] of Object.entries(this.gameState.fishInventory)) {
            const price = Math.floor(fishPrices[fishType] * priceMultiplier);
            totalEarned += price * count;
        }

        this.gameState.money += totalEarned;
        this.gameState.addLog(`💰 卖出所有鱼获，获得 ${totalEarned} 金币！`);
        
        // 清空库存
        this.gameState.fishInventory = {};
        
        this.gameState.updateUI();
    }

    build(buildingId, cost) {
        if (this.gameState.buildings[buildingId]) {
            this.gameState.addLog('❌ 该设施已建造！');
            return;
        }

        if (this.gameState.money < cost) {
            this.gameState.addLog('❌ 金钱不足！');
            return;
        }

        this.gameState.money -= cost;
        this.gameState.buildings[buildingId] = true;
        
        const buildingNames = {
            'dock': '码头',
            'shop': '渔具店',
            'market': '市场',
            'factory': '加工厂'
        };
        
        this.gameState.addLog(`🏗️ 成功建造 ${buildingNames[buildingId]}！`);
        this.gameState.updateUI();
    }
}

// 初始化游戏
window.addEventListener('DOMContentLoaded', () => {
    new Game();
});

