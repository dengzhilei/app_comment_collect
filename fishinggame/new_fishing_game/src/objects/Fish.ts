import Phaser from 'phaser';

export enum FishType {
    SMALL = 1,
    MEDIUM = 2,
    BIG = 3
}

export interface FishConfig {
    speed: number;
    score: number;
    color: number;
    scale: number;
    width: number;
    height: number;
}

export const FISH_CONFIGS: Record<FishType, FishConfig> = {
    [FishType.SMALL]: { speed: 200, score: 10, color: 0xffa500, scale: 0.6, width: 60, height: 30 }, // Orange
    [FishType.MEDIUM]: { speed: 120, score: 30, color: 0xffff00, scale: 1.0, width: 100, height: 50 }, // Yellow
    [FishType.BIG]: { speed: 60, score: 100, color: 0xff0000, scale: 1.5, width: 160, height: 80 } // Red
};

export class Fish extends Phaser.Physics.Arcade.Sprite {
    public fishType: FishType;
    public scoreValue: number;
    private moveDirection: number; // 1 for right, -1 for left
    private speed: number;

    constructor(scene: Phaser.Scene, x: number, y: number, type: FishType, direction: number) {
        super(scene, x, y, 'fish');
        
        this.fishType = type;
        this.moveDirection = direction;
        const config = FISH_CONFIGS[type];
        this.scoreValue = config.score;
        this.speed = config.speed;

        // Draw placeholder texture if not exists (lazy loading logic similar to Arrow)
        const textureKey = `fish_${type}`;
        if (!scene.textures.exists(textureKey)) {
            const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(config.color);
            // Draw a simple fish shape (ellipse body + triangle tail)
            graphics.fillEllipse(config.width/2, config.height/2, config.width, config.height);
            graphics.fillStyle(config.color, 0.8);
            graphics.fillTriangle(
                0, 0, 
                0, config.height, 
                config.width * 0.3, config.height / 2
            );
            graphics.generateTexture(textureKey, config.width, config.height);
        }
        this.setTexture(textureKey);

        scene.add.existing(this);
        scene.physics.add.existing(this);

        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false); // Fish don't fall
        body.setImmovable(true);     // Fish won't be pushed by arrows
        // We don't rely on body.velocity anymore, we move manually in update()
        
        // Flip sprite if moving left
        if (direction === -1) {
            this.setFlipX(true);
        }
    }

    update(time: number, delta: number) {
        // Manual movement logic
        const dt = delta / 1000; // Convert to seconds
        this.x += this.speed * this.moveDirection * dt * 60; // *60 to match rough frame speed

        // Sync physics body with sprite
        if (this.body) {
            this.body.x = this.x - this.body.width / 2;
            this.body.y = this.y - this.body.height / 2;
        }

        // Destroy if out of bounds
        const buffer = 200;
        if (this.moveDirection === 1 && this.x > this.scene.scale.width + buffer) {
            this.destroy();
        } else if (this.moveDirection === -1 && this.x < -buffer) {
            this.destroy();
        }
    }
}
