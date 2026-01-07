class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.state = 'START'; 
        this.score = 0;
        this.timeLeft = CONFIG.GAME_DURATION;
        this.frames = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboScale = 1.0; // 初始化 Combo 缩放
        this.spawnRate = CONFIG.SPAWN_RATE_INITIAL;
        this.feverMode = false;
        this.feverTimer = 0;
        this.bossMode = false;
        this.boss = null;
        
        // 视觉效果
        this.shake = 0;
        this.globalAlpha = 1.0;

        this.bow = new Bow(this);
        this.arrows = [];
        this.fishes = [];
        this.particles = [];
        this.texts = []; 
        this.bubbles = []; 
        this.inks = []; // 墨汁

        window.addEventListener('resize', () => this.resize());
        this.bindInput();
        this.bindUI();

        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        if (this.bow) this.bow.updatePosition();
    }

    shakeScreen(intensity) {
        this.shake = intensity;
    }

    addInkSplash(x, y) {
        this.inks.push(new InkSplash(x, y));
    }

    bindUI() {
        const startBtn = document.getElementById('start-btn');
        const restartBtn = document.getElementById('restart-btn');
        
        if (startBtn) {
            startBtn.onclick = () => this.start();
        }
        if (restartBtn) {
            restartBtn.onclick = () => this.start();
        }
    }

    start() {
        this.state = 'PLAYING';
        this.score = 0;
        this.timeLeft = CONFIG.GAME_DURATION;
        this.combo = 0;
        this.maxCombo = 0;
        this.comboScale = 1.0;
        this.spawnRate = CONFIG.SPAWN_RATE_INITIAL;
        this.feverMode = false;
        this.bossMode = false;
        this.boss = null;
        this.arrows = [];
        this.fishes = [];
        this.particles = [];
        this.texts = [];
        this.bubbles = [];
        this.inks = [];
        this.frames = 0;
        this.globalAlpha = 1.0;
        this.shake = 0;

        // 关键修复：重置尺寸和弓箭状态
        this.resize(); 
        this.bow = new Bow(this);

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        this.updateUI();

        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (this.state === 'PLAYING') {
                if (!this.bossMode || (this.bossMode && this.boss.state !== 'defeated')) {
                    this.timeLeft--;
                }

                if (this.feverMode) {
                    this.feverTimer--;
                    if (this.feverTimer <= 0) {
                        this.exitFever();
                    }
                }

                if (this.timeLeft <= CONFIG.BOSS_SPAWN_TIME && !this.bossMode && !this.feverMode) {
                    this.spawnBoss();
                }
                
                if (!this.bossMode) {
                    if (this.timeLeft < 20 && this.timeLeft > 10) { 
                        this.spawnRate = 45;
                    } else if (this.timeLeft <= 10) {
                        this.spawnRate = 30;
                    }
                }

                if (this.timeLeft <= 0) {
                    this.gameOver();
                }
                this.updateUI();
            }
        }, 1000);
    }

    gameOver() {
        this.state = 'GAME_OVER';
        clearInterval(this.timerInterval);
        document.getElementById('final-score').textContent = `${this.score} (Max Combo: ${this.maxCombo})`;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('time').textContent = this.timeLeft;
    }

    enterFever(duration) {
        // 关键修改：Boss 战 Phase 1 (fighting) 阶段禁止 Fever
        // 只有在 'core_exposed' (Phase 2) 或者 !bossMode (平时) 才能进
        if (this.bossMode && this.boss.state === 'fighting') {
            // 可以加一个视觉反馈，比如 "Fever Blocked" 或者仅仅是重置 Combo
            this.combo = 0; // 如果满了但被锁住，可以重置鼓励继续打
            return; 
        }
        
        // Boss 二阶段进入 Fever 时重置时间
        if (this.bossMode && this.boss.state === 'core_exposed') {
             this.timeLeft = 10; // 给予 10 秒爽快时间
             this.updateUI();
        }

        this.feverMode = true;
        this.feverTimer = duration || CONFIG.FEVER_DURATION;
        this.spawnRate = 10;
        this.addFloatingText(this.width / 2, this.height / 2, 'FEVER MODE!', '#FF4136');
    }

    exitFever() {
        this.feverMode = false;
        this.spawnRate = CONFIG.SPAWN_RATE_INITIAL;
        this.combo = 0; 
    }

    spawnBoss() {
        this.bossMode = true;
        this.fishes = []; 
        this.bubbles = []; 
        this.boss = new Boss(this);
        this.addFloatingText(this.width / 2, this.height / 3, 'WARNING: KRAKEN!', '#FF0000');
        
        // 移除：Boss 登场福利
    }

    bindInput() {
        const handleStart = (e) => {
            if (this.state !== 'PLAYING') return;
            e.preventDefault();
            const { x, y } = this.getPos(e);
            
            if (this.feverMode) {
                this.bow.aim(x, y);
                this.bow.instantShoot();
            } else {
                this.bow.startCharging(x, y);
            }
        };

        const handleMove = (e) => {
            if (this.state !== 'PLAYING') return;
            e.preventDefault();
            const { x, y } = this.getPos(e);
            this.bow.aim(x, y);
        };

        const handleEnd = (e) => {
            if (this.state !== 'PLAYING') return;
            e.preventDefault();
            if (!this.feverMode) {
                this.bow.release();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);

        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
    }

    getPos(e) {
        if (e.touches) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
    }

    spawnFish() {
        if (this.bossMode) return; 

        if (this.frames % CONFIG.BUBBLE_SPAWN_RATE === 0) {
            if (Math.random() < CONFIG.BUBBLE_CHANCE) {
                const type = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
                this.bubbles.push(new Bubble(this, type));
            }
        }

        if (this.frames % this.spawnRate === 0) {
            const rand = Math.random();
            let type = FISH_TYPES[0];
            let accumWeight = 0;
            
            for (let t of FISH_TYPES) {
                accumWeight += t.spawnWeight;
                if (rand <= accumWeight) {
                    type = t;
                    break;
                }
            }
            
            let speedMultiplier = 1.0;
            if (this.timeLeft < 20) speedMultiplier = 1.3;
            if (this.feverMode) speedMultiplier = 0.8; 

            this.fishes.push(new Fish(this, type, speedMultiplier));
        }
    }

    loop() {
        // 应用震动
        let shakeX = 0, shakeY = 0;
        if (this.shake > 0) {
            shakeX = (Math.random() - 0.5) * this.shake;
            shakeY = (Math.random() - 0.5) * this.shake;
            this.shake *= 0.9; // 震动衰减
            if (this.shake < 0.5) this.shake = 0;
        }
        
        // Combo 弹性恢复
        if (this.comboScale > 1.0) {
            this.comboScale -= 0.05;
            if (this.comboScale < 1.0) this.comboScale = 1.0;
        }

        if (this.feverMode) {
            this.ctx.fillStyle = '#330000';
            this.ctx.fillRect(0, 0, this.width, this.height);
        } else {
            this.ctx.clearRect(0, 0, this.width, this.height);
        }

        this.ctx.save();
        this.ctx.translate(shakeX, shakeY); // 整个世界震动
        this.ctx.globalAlpha = this.globalAlpha;

        if (this.state === 'PLAYING') {
            this.frames++;
            this.spawnFish();

            this.bow.update();
            if (this.boss) this.boss.update();
            
            this.arrows.forEach((arrow, index) => {
                arrow.update();
                if (arrow.isDead) {
                    this.arrows.splice(index, 1);
                }
            });

            this.fishes.forEach((fish, index) => {
                fish.update();
                if (fish.isDead) this.fishes.splice(index, 1);
            });

            this.bubbles.forEach((b, index) => {
                b.update();
                if (b.isDead) this.bubbles.splice(index, 1);
            });

            this.particles.forEach((p, index) => {
                p.update();
                if (p.isDead) this.particles.splice(index, 1);
            });

            this.inks.forEach((i, index) => {
                i.update();
                if (i.life <= 0) this.inks.splice(index, 1);
            });

            this.texts.forEach((t, index) => {
                t.update();
                if (t.isDead) this.texts.splice(index, 1);
            });

            this.checkCollisions();
        }

        if (this.boss) this.boss.draw(this.ctx);
        this.fishes.forEach(f => f.draw(this.ctx));
        this.bubbles.forEach(b => b.draw(this.ctx));
        this.arrows.forEach(a => a.draw(this.ctx));
        this.particles.forEach(p => p.draw(this.ctx));
        this.bow.draw(this.ctx);
        
        // 墨汁层在 UI 下，物体上
        this.inks.forEach(i => i.draw(this.ctx));

        this.texts.forEach(t => t.draw(this.ctx));
        this.drawCombo(this.ctx);
        this.drawFeverBar(this.ctx); 

        this.ctx.restore(); // 恢复震动偏移

        requestAnimationFrame(this.loop);
    }

    drawCombo(ctx) {
        if (this.combo > 1 || this.feverMode) {
            ctx.save();
            ctx.fillStyle = this.feverMode ? '#FF4136' : `rgba(255, 220, 0, ${Math.min(1, this.combo * 0.2)})`;
            
            // 应用 comboScale
            let size = 40 + Math.min(40, this.combo * 5);
            size *= this.comboScale; 
            
            ctx.font = `bold ${size}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'black';
            ctx.shadowBlur = 10;
            let text = this.feverMode ? `FEVER!` : `Combo x${this.combo}`;
            ctx.fillText(text, this.width / 2, this.height / 2);
            ctx.restore();
        }
    }

    drawFeverBar(ctx) {
        if (this.bossMode && this.boss.state === 'fighting') return; // Phase 1 不显示 Fever 条，减少干扰

        const barWidth = this.width * 0.8;
        const barHeight = 10;
        const x = (this.width - barWidth) / 2;
        const y = this.height - 30;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, y, barWidth, barHeight);

        let progress = 0;
        let color = '#FFDC00';

        if (this.bow.powerUp) {
            progress = this.bow.powerUpTimer / (CONFIG.POWERUP_DURATION * 60);
            color = this.bow.powerUp === 'split' ? '#0074D9' : '#F012BE';
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth * progress, barHeight);
            
            ctx.fillStyle = '#FFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            let name = this.bow.powerUp === 'split' ? 'SCATTER' : 'LASER';
            ctx.fillText(`${name} MODE`, this.width / 2, y - 5);
        } else if (this.feverMode) {
            progress = 1.0; 
            color = '#FF4136';
            if (Math.floor(Date.now() / 100) % 2 === 0) {
                ctx.fillStyle = color;
                ctx.fillRect(x, y, barWidth * progress, barHeight);
            }
            ctx.fillStyle = '#FFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText("FEVER TIME!", this.width / 2, y - 5);
        } else {
            progress = Math.min(1, this.combo / CONFIG.FEVER_THRESHOLD);
            color = '#FFDC00';
            ctx.fillStyle = color;
            ctx.fillRect(x, y, barWidth * progress, barHeight);
            ctx.fillStyle = '#FFF';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(`FEVER: ${this.combo}/${CONFIG.FEVER_THRESHOLD}`, this.width / 2, y - 5);
        }

        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        ctx.restore();
    }

    checkCollisions() {
        for (let i = this.arrows.length - 1; i >= 0; i--) {
            let arrow = this.arrows[i];
            if (arrow.isDead) continue;

            // Boss 碰撞
            if (this.bossMode && this.boss && this.boss.state !== 'defeated') {
                if (this.boss.checkCollision(arrow)) {
                    arrow.hasHit = true;
                    if (arrow.type !== 'laser') arrow.isDead = true; 
                    this.createExplosion(arrow.x, arrow.y, '#FF0000');
                    continue;
                }
            }

            // 气泡碰撞 (道具)
            for (let k = this.bubbles.length - 1; k >= 0; k--) {
                let bubble = this.bubbles[k];
                if (bubble.isDead) continue;

                let hit = false;
                if (arrow.type === 'laser') {
                    // 激光判定算法：点到直线距离
                    // 向量 (bubble - arrow)
                    let dx = bubble.x - arrow.x;
                    let dy = bubble.y - arrow.y;
                    
                    // 旋转到局部坐标系 (相当于把箭头转正)
                    // 顺时针旋转 -angle
                    let localX = dx * Math.cos(-arrow.angle) - dy * Math.sin(-arrow.angle);
                    let localY = dx * Math.sin(-arrow.angle) + dy * Math.cos(-arrow.angle);
                    
                    // localX 是前方距离，localY 是侧向偏离距离
                    // 1. 必须在前方 (localX > 0)
                    // 2. 侧向距离小于气泡半径 (abs(localY) < radius)
                    if (localX > 0 && Math.abs(localY) < bubble.radius + 10) {
                        hit = true;
                    }
                } else {
                    const dx = arrow.x - bubble.x;
                    const dy = arrow.y - bubble.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < bubble.radius + 10) {
                        hit = true;
                    }
                }

                if (hit) {
                    this.bow.activatePowerUp(bubble.typeInfo.type);
                    bubble.isDead = true;
                    arrow.hasHit = true;
                    if (arrow.type !== 'laser') arrow.isDead = true;
                    this.createExplosion(bubble.x, bubble.y, bubble.typeInfo.color);
                    if (arrow.isDead) break; 
                }
            }
            if (arrow.isDead) continue;

            if (arrow.x < 0 || arrow.x > this.width || arrow.y > this.height) {
                if (!arrow.hasHit && arrow.type !== 'laser') {
                    this.combo = 0; 
                }
                arrow.isDead = true;
                continue;
            }

            for (let j = this.fishes.length - 1; j >= 0; j--) {
                let fish = this.fishes[j];
                if (fish.isDead) continue;

                let hit = false;
                if (arrow.type === 'laser') {
                    // 激光判定：同气泡逻辑
                    let dx = fish.x - arrow.x;
                    let dy = fish.y - arrow.y;
                    let localX = dx * Math.cos(-arrow.angle) - dy * Math.sin(-arrow.angle);
                    let localY = dx * Math.sin(-arrow.angle) + dy * Math.cos(-arrow.angle);
                    
                    // 激光判定宽容度：鱼半径 + 激光宽度(5)
                    if (localX > 0 && Math.abs(localY) < fish.radius + 5) {
                        hit = true;
                    }
                } else {
                    const dx = arrow.x - fish.x;
                    const dy = arrow.y - fish.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < fish.radius + 5) {
                        hit = true;
                    }
                }

                if (hit) {
                    arrow.hasHit = true;
                    
                    let isKill = fish.hit(arrow.damage);
                    this.createExplosion(fish.x, fish.y, fish.color);

                    if (isKill) {
                        this.handleHit(fish);
                    } else {
                        this.addFloatingText(fish.x, fish.y, `-${arrow.damage}`, '#FFF');
                    }

                    if (arrow.type === 'laser') {
                    } else if (arrow.pierce > 0) {
                        arrow.pierce--; 
                    } else {
                        arrow.isDead = true;
                        break;
                    }
                }
            }
        }
    }

    handleHit(fish) {
        if (fish.type.effect === 'bomb') {
            this.score += fish.score;
            this.combo = 0;
            this.addFloatingText(fish.x, fish.y, `${fish.score}`, '#FF4136');
            this.explodeBomb(fish.x, fish.y);
        } else {
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;

            if (!this.feverMode && this.combo >= CONFIG.FEVER_THRESHOLD) {
                this.enterFever();
            }

            let finalScore = Math.floor(fish.score * (1 + (this.combo - 1) * 0.1));
            this.score += finalScore;

            let text = `+${finalScore}`;
            let color = '#FFFFFF';

            if (fish.type.effect === 'time') {
                this.timeLeft += 5;
                text = '+5s';
                color = '#2ECC40';
                this.addFloatingText(fish.x, fish.y - 20, `+${finalScore}`, '#FFFFFF');
            } else if (this.combo > 1) {
                color = '#FFDC00';
            }

            this.addFloatingText(fish.x, fish.y, text, color);
        }
        this.updateUI();
    }

    explodeBomb(x, y) {
        const blastRadius = 200;
        this.fishes.forEach(f => {
            const dist = Math.sqrt((f.x - x)**2 + (f.y - y)**2);
            if (dist < blastRadius && !f.isDead) {
                f.isDead = true;
                this.score += Math.floor(f.score / 2);
                this.createExplosion(f.x, f.y, f.color);
                this.addFloatingText(f.x, f.y, `+${Math.floor(f.score/2)}`, '#AAAAAA');
            }
        });
    }

    createExplosion(x, y, color) {
        for (let i = 0; i < 15; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    addFloatingText(x, y, text, color) {
        this.texts.push(new FloatingText(x, y, text, color));
    }
}