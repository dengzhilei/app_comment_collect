class Boss {
    constructor(game) {
        this.game = game;
        this.state = 'entering'; 
        this.x = game.width / 2;
        this.y = -200;
        this.targetY = 150;
        this.wobble = 0;
        
        this.coreHp = CONFIG.BOSS_CORE_HP;
        this.maxCoreHp = CONFIG.BOSS_CORE_HP;
        this.coreScale = 1.0;
        
        this.tentacles = [];
        for (let i = 0; i < 4; i++) {
            this.tentacles.push({
                offsetX: (i - 1.5) * 70, 
                offsetY: 50 + Math.random() * 50,
                width: 50,
                height: 100,
                hp: CONFIG.BOSS_HP_PER_TENTACLE,
                maxHp: CONFIG.BOSS_HP_PER_TENTACLE,
                dead: false
            });
        }
    }

    update() {
        if (this.state === 'entering') {
            this.y += 2;
            if (this.y >= this.targetY) {
                this.state = 'fighting';
                this.game.shakeScreen(10); 
            }
        } else if (this.state === 'fighting') {
            const time = Date.now() * 0.003;
            this.wobble = Math.sin(time * 0.5) * 10; 
            
            this.tentacles.forEach((t, i) => {
                if (!t.dead) {
                    t.offsetY = 60 + Math.sin(time + i * 1.5) * 40;
                    t.offsetX = ((i - 1.5) * 70) + Math.cos(time * 2 + i) * 10;
                }
            });

            if (this.tentacles.every(t => t.dead)) {
                this.enterPhaseTwo();
            }
        } else if (this.state === 'core_exposed') {
            this.coreScale = 1.0 + Math.sin(Date.now() * 0.01) * 0.1;
            
            if (Math.random() < 0.05) this.game.shakeScreen(2);
        } else if (this.state === 'defeated') {
            this.y += 1; 
            this.game.globalAlpha -= 0.01; 
        }
    }

    enterPhaseTwo() {
        this.state = 'core_exposed';
        this.game.shakeScreen(20);
        this.game.addFloatingText(this.x, this.y, "CORE EXPOSED!", "#FF0000");
        this.game.enterFever(999); 
    }

    checkCollision(arrow) {
        if (this.state === 'defeated') return false;

        if (this.state === 'fighting') {
            for (let t of this.tentacles) {
                if (t.dead) continue;
                
                let tx = this.x + t.offsetX - t.width/2;
                let ty = this.y + t.offsetY;
                
                if (arrow.x > tx && arrow.x < tx + t.width &&
                    arrow.y > ty && arrow.y < ty + t.height) {
                    
                    const damage = arrow.type === 'laser' ? 5 : 1;
                    t.hp -= damage;
                    
                    if (t.hp <= 0) {
                        t.dead = true;
                        this.game.score += 500;
                        this.game.addFloatingText(tx, ty, "+500", "#FF851B");
                        this.game.addInkSplash(tx, ty);
                        this.game.shakeScreen(5);
                    }
                    return true; 
                }
            }
        }

        if (this.state === 'core_exposed') {
            const dx = arrow.x - this.x;
            const dy = arrow.y - this.y;
            if (dx*dx + dy*dy < 50*50) {
                const damage = arrow.type === 'laser' ? 2 : 1; 
                this.coreHp -= damage;
                
                // 击中核心：爆大量金色粒子
                this.game.createExplosion(arrow.x, arrow.y, '#FFD700'); 
                this.game.createExplosion(arrow.x, arrow.y, '#FF4500'); // 混一点红色
                
                // 触发 Game 的 Combo 缩放
                this.game.comboScale = 1.5; 
                
                if (this.coreHp <= 0) {
                    this.die();
                }
                return true;
            }
        }

        if (this.state === 'fighting') {
            const dx = arrow.x - this.x;
            const dy = arrow.y - this.y;
            if (dx*dx + dy*dy < 60*60) {
                 return true; 
            }
        }

        return false;
    }

    die() {
        this.state = 'defeated';
        this.game.score += 5000; 
        this.game.addFloatingText(this.x, this.y, "VICTORY! +5000", "#FFDC00");
        this.game.shakeScreen(30); 
        
        for(let i=0; i<10; i++) {
            setTimeout(() => {
                this.game.createExplosion(this.x + (Math.random()-0.5)*100, this.y + (Math.random()-0.5)*100, '#FF0000');
            }, i * 100);
        }
        
        setTimeout(() => {
            this.game.gameOver();
        }, 2000); 
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x + this.wobble, this.y);

        if (this.state === 'fighting') {
            this.tentacles.forEach(t => {
                if (!t.dead) {
                    ctx.fillStyle = `rgb(${255 * (t.hp/t.maxHp)}, 0, 0)`; 
                    ctx.fillRect(t.offsetX - t.width/2, t.offsetY, t.width, t.height);
                    
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath();
                    ctx.arc(t.offsetX, t.offsetY + 20, 10, 0, Math.PI*2);
                    ctx.arc(t.offsetX, t.offsetY + 60, 8, 0, Math.PI*2);
                    ctx.fill();
                }
            });
        }

        ctx.fillStyle = '#800080'; 
        if (this.state === 'core_exposed') ctx.fillStyle = '#400040'; 
        ctx.beginPath();
        ctx.arc(0, 0, 60, 0, Math.PI * 2);
        ctx.fill();

        if (this.state === 'core_exposed') {
            ctx.save();
            ctx.scale(this.coreScale, this.coreScale);
            
            ctx.shadowBlur = 20;
            ctx.shadowColor = "#FF0000";
            
            ctx.fillStyle = '#FF0000';
            ctx.beginPath();
            ctx.arc(0, 0, 30, 0, Math.PI*2);
            ctx.fill();
            
            ctx.fillStyle = '#FFDDDD';
            ctx.beginPath();
            ctx.arc(-10, -10, 5, 0, Math.PI*2);
            ctx.fill();
            
            ctx.restore();
        } else {
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(-25, -10, 15, 0, Math.PI*2);
            ctx.arc(25, -10, 15, 0, Math.PI*2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(-25, -10, 5, 0, Math.PI*2);
            ctx.arc(25, -10, 5, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class InkSplash {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.life = 1.0;
        this.scale = 0;
        this.targetScale = 1.0 + Math.random() * 1.0;
        this.rotation = Math.random() * Math.PI * 2;
    }

    update() {
        if (this.scale < this.targetScale) {
            this.scale += 0.1;
        }
        this.life -= 0.005; 
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);
        
        ctx.globalAlpha = this.life * 0.8;
        ctx.fillStyle = '#000';
        
        ctx.beginPath();
        ctx.arc(0, 0, 40, 0, Math.PI*2);
        ctx.arc(30, 10, 30, 0, Math.PI*2);
        ctx.arc(-20, 30, 25, 0, Math.PI*2);
        ctx.arc(10, -30, 35, 0, Math.PI*2);
        ctx.fill();
        
        ctx.restore();
    }
}

class Bow {
    constructor(game) {
        this.game = game;
        this.updatePosition();
        this.angle = -Math.PI / 2; 
        this.charge = 0;
        this.isCharging = false;
        
        this.powerUp = null; 
        this.powerUpTimer = 0;
    }

    updatePosition() {
        this.x = this.game.width / 2;
        this.y = this.game.height - 50;
    }

    activatePowerUp(type) {
        this.powerUp = type;
        this.powerUpTimer = CONFIG.POWERUP_DURATION * 60; 
        this.game.addFloatingText(this.x, this.y - 50, type.toUpperCase() + '!', '#FFFF00');
    }

    startCharging(x, y) {
        this.isCharging = true;
        this.charge = 0;
        this.aim(x, y);
    }
    
    instantShoot() {
        const speed = CONFIG.ARROW_SPEED_BASE + CONFIG.MAX_CHARGE * CONFIG.ARROW_SPEED_MULTIPLIER;
        this.fire(this.angle, speed, 2, 100); 
    }

    aim(x, y) {
        const dx = x - this.x;
        const dy = y - this.y;
        this.angle = Math.atan2(dy, dx);
        
        if (this.angle > 0) {
            this.angle = (this.angle > Math.PI / 2) ? Math.PI : 0;
        }
    }

    release() {
        if (this.isCharging) {
            this.isCharging = false;
            const speed = CONFIG.ARROW_SPEED_BASE + this.charge * CONFIG.ARROW_SPEED_MULTIPLIER;
            
            let pierce = this.charge > 80 ? 1 : 0;
            let damage = 1 + Math.floor(this.charge / 40); 

            this.fire(this.angle, speed, pierce, damage);
            this.charge = 0;
        }
    }

    fire(angle, speed, pierce, damage) {
        if (this.powerUp === 'split') {
            this.game.arrows.push(new Arrow(this.x, this.y, angle, speed, this.game, pierce, damage));
            this.game.arrows.push(new Arrow(this.x, this.y, angle - 0.2, speed, this.game, pierce, damage));
            this.game.arrows.push(new Arrow(this.x, this.y, angle + 0.2, speed, this.game, pierce, damage));
        } else if (this.powerUp === 'laser') {
            this.game.arrows.push(new Arrow(this.x, this.y, angle, speed * 3, this.game, 999, 10, 'laser')); 
        } else {
            this.game.arrows.push(new Arrow(this.x, this.y, angle, speed, this.game, pierce, damage));
        }
    }

    update() {
        if (this.isCharging) {
            if (this.charge < CONFIG.MAX_CHARGE) {
                this.charge += CONFIG.CHARGE_SPEED;
            }
        }
        if (this.powerUp) {
            this.powerUpTimer--;
            if (this.powerUpTimer <= 0) {
                this.powerUp = null;
            }
        }
    }

    drawTrajectory(ctx) {
        if (!this.isCharging) return;

        const speed = CONFIG.ARROW_SPEED_BASE + this.charge * CONFIG.ARROW_SPEED_MULTIPLIER;
        let vx = Math.cos(this.angle) * speed;
        let vy = Math.sin(this.angle) * speed;
        let x = this.x;
        let y = this.y;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y);
        
        for (let i = 0; i < 20; i++) {
            vy += CONFIG.GRAVITY;
            x += vx;
            y += vy;
            ctx.lineTo(x, y);
        }
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.setLineDash([5, 5]);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    draw(ctx) {
        this.drawTrajectory(ctx); 

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        if (this.powerUp === 'split') ctx.strokeStyle = '#0074D9'; 
        else if (this.powerUp === 'laser') ctx.strokeStyle = '#F012BE'; 
        else ctx.strokeStyle = this.game.feverMode ? '#FF4136' : '#85144b';
        
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 30, -Math.PI / 2, Math.PI / 2);
        ctx.stroke();

        ctx.strokeStyle = '#DDD';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const pull = this.isCharging ? (this.charge / CONFIG.MAX_CHARGE) * 20 : 0;
        ctx.moveTo(0, -30);
        ctx.lineTo(-pull, 0);
        ctx.lineTo(0, 30);
        ctx.stroke();

        if (this.isCharging) {
            ctx.fillStyle = `rgba(255, 255, 0, ${this.charge / 100})`;
            ctx.beginPath();
            ctx.arc(0, 0, 10 + (this.charge / 5), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Arrow {
    constructor(x, y, angle, speed, game, pierce = 0, damage = 1, type = 'normal') {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.game = game;
        this.pierce = pierce; 
        this.damage = damage; 
        this.type = type; 
        this.isDead = false;
        this.hasHit = false;
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.life = 30; 
    }

    update() {
        if (this.type === 'laser') {
            this.x += this.vx * 5; 
            this.y += this.vy * 5;
            this.life--;
            if (this.life <= 0) this.isDead = true;
        } else {
            this.vy += CONFIG.GRAVITY;
            this.x += this.vx;
            this.y += this.vy;
            this.angle = Math.atan2(this.vy, this.vx);
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        if (this.type === 'laser') {
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = '#F012BE';
            ctx.fillRect(-1000, -5, 2000, 10); 
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(-1000, -2, 2000, 4);  
            ctx.globalCompositeOperation = 'source-over';
        } else {
            const isPowerShot = this.pierce > 0 || this.damage > 1;
            ctx.fillStyle = this.game.feverMode || isPowerShot ? '#FFFF00' : '#FFF';
            ctx.fillRect(-10, -2, 20, 4);
            
            ctx.beginPath();
            ctx.moveTo(10, -4);
            ctx.lineTo(15, 0);
            ctx.lineTo(10, 4);
            ctx.fillStyle = isPowerShot ? '#FF851B' : '#FF4136';
            ctx.fill();
        }

        ctx.restore();
    }
}

class Bubble {
    constructor(game, typeInfo) {
        this.game = game;
        this.typeInfo = typeInfo; 
        this.x = Math.random() > 0.5 ? -30 : game.width + 30;
        this.y = Math.random() * (game.height * 0.5);
        this.vx = this.x < 0 ? 1.5 : -1.5;
        this.radius = 25;
        this.wobble = Math.random() * Math.PI * 2;
        this.isDead = false;
    }

    update() {
        this.x += this.vx;
        this.wobble += 0.05;
        this.y += Math.sin(this.wobble) * 0.5;

        if (this.x < -50 || this.x > this.game.width + 50) {
            this.isDead = true;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = this.typeInfo.color;
        ctx.stroke();

        ctx.fillStyle = '#FFF';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.typeInfo.symbol, 0, 0);

        ctx.restore();
    }
}

class Fish {
    constructor(game, type, speedMultiplier = 1.0) {
        this.game = game;
        this.type = type;
        this.color = type.color;
        this.radius = type.radius;
        this.score = type.score;
        this.hp = type.hp || 1; 
        this.isDead = false;

        const fromLeft = Math.random() > 0.5;
        this.y = Math.random() * (this.game.height * 0.6); 
        
        const baseSpeed = type.speed * speedMultiplier;

        if (fromLeft) {
            this.x = -this.radius;
            this.vx = baseSpeed * (0.8 + Math.random() * 0.4);
            this.scaleX = 1; 
        } else {
            this.x = this.game.width + this.radius;
            this.vx = -baseSpeed * (0.8 + Math.random() * 0.4);
            this.scaleX = -1; 
        }
        
        this.wobble = Math.random() * Math.PI * 2;
    }

    update() {
        this.x += this.vx;
        this.wobble += 0.1;
        this.y += Math.sin(this.wobble) * 0.5;

        if ((this.vx > 0 && this.x > this.game.width + 50) || 
            (this.vx < 0 && this.x < -50)) {
            this.isDead = true;
        }
    }

    hit(damage) {
        this.hp -= damage;
        if (this.hp <= 0) {
            this.isDead = true;
            return true; 
        } else {
            this.x += (this.vx > 0 ? -10 : 10); 
            return false; 
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(this.scaleX, 1);

        ctx.fillStyle = (this.hp < this.type.hp) ? '#FFFFFF' : this.color;
        
        if (this.type.effect === 'bomb') {
             ctx.beginPath();
             for(let i=0; i<8; i++) {
                 ctx.rotate(Math.PI/4);
                 ctx.moveTo(this.radius, 0);
                 ctx.lineTo(this.radius + 5, 5);
                 ctx.lineTo(this.radius, 10);
             }
             ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
             ctx.fill();
        } else {
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius * 1.5, this.radius, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(-this.radius * 1.5, 0);
            ctx.lineTo(-this.radius * 2.2, -this.radius * 0.6);
            ctx.lineTo(-this.radius * 2.2, this.radius * 0.6);
            ctx.fill();
        }

        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(this.radius * 0.8, -this.radius * 0.3, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.radius * 0.9, -this.radius * 0.3, this.radius * 0.1, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.life = 1.0;
        this.isDead = false;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.isDead = false;
        this.vy = -1; 
    }

    update() {
        this.y += this.vy;
        this.life -= 0.02;
        if (this.life <= 0) this.isDead = true;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.font = 'bold 20px Arial';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 2;
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}