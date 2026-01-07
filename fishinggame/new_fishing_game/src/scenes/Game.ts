import Phaser from 'phaser';
import { Bow } from '../objects/Bow';
import { Arrow } from '../objects/Arrow';
import { Fish, FishType } from '../objects/Fish';

export class Game extends Phaser.Scene {
    private bow!: Bow;
    private isCharging: boolean = false;
    private power: number = 0;
    private powerText!: Phaser.GameObjects.Text;
    private scoreText!: Phaser.GameObjects.Text;
    private score: number = 0;
    
    // Groups
    private arrows!: Phaser.Physics.Arcade.Group;
    private fishes!: Phaser.Physics.Arcade.Group;

    constructor() {
        super('Game');
    }

    create() {
        const { width, height } = this.scale;

        // Background (Water)
        this.add.rectangle(0, 0, width, height, 0x028af8).setOrigin(0);

        // Groups
        this.arrows = this.physics.add.group({
            classType: Arrow,
            runChildUpdate: true
        });
        this.fishes = this.physics.add.group({
            classType: Fish,
            runChildUpdate: true
        });

        // Bow position (bottom center)
        this.bow = new Bow(this, width / 2, height - 100);

        // Input
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            const angle = Phaser.Math.Angle.Between(
                this.bow.x, this.bow.y,
                pointer.x, pointer.y
            );
            this.bow.rotation = angle;
        });

        this.input.on('pointerdown', () => {
            this.isCharging = true;
            this.power = 0;
        });

        this.input.on('pointerup', () => {
            if (this.isCharging) {
                this.fireArrow();
                this.isCharging = false;
                this.power = 0;
            }
        });

        // UI
        this.powerText = this.add.text(width / 2, height - 50, 'Power: 0', {
            fontFamily: 'Arial',
            fontSize: '24px',
            color: '#fff'
        }).setOrigin(0.5);

        this.scoreText = this.add.text(20, 20, 'Score: 0', {
            fontFamily: 'Arial',
            fontSize: '32px',
            color: '#fff',
            fontStyle: 'bold'
        });
        
        // Physics Bounds
        this.physics.world.setBounds(0, -1000, width, height + 1000);

        // Fish Spawning Timer
        this.time.addEvent({
            delay: 1500, // Spawn every 1.5 seconds
            callback: this.spawnFish,
            callbackScope: this,
            loop: true
        });

        // Collision
        this.physics.add.overlap(this.arrows, this.fishes, this.handleHit, undefined, this);
    }

    update(time: number, delta: number) {
        if (this.isCharging) {
            this.power += delta * 0.05; // Charge rate
            if (this.power > 100) this.power = 100;
            this.powerText.setText(`Power: ${Math.floor(this.power)}%`);
        } else {
            this.powerText.setText('Hold to Charge, Release to Fire');
        }

        // DEBUG: Log fish count every 60 frames (approx 1 sec)
        if (this.game.loop.frame % 60 === 0) {
            console.log(`Fish count: ${this.fishes.getLength()}`);
            this.fishes.children.each((f: any) => {
                console.log(`Fish pos: ${Math.floor(f.x)}, ${Math.floor(f.y)}`);
                return true;
            });
        }

        // Manually update fishes to ensure movement
        this.fishes.children.each((fish: any) => {
            fish.update(time, delta);
            return true;
        });
    }

    private fireArrow() {
        const arrow = new Arrow(this, this.bow.x, this.bow.y);
        this.arrows.add(arrow); // Add to group for collision
        
        const angleDeg = Phaser.Math.RadToDeg(this.bow.rotation);
        arrow.fire(angleDeg, this.power);
    }

    private spawnFish() {
        const { width, height } = this.scale;
        
        // Randomize side
        const fromLeft = Math.random() > 0.5;
        const x = fromLeft ? -80 : width + 80; // Spawn just outside screen
        const direction = fromLeft ? 1 : -1;

        // Randomize Y (Top 60% of screen)
        const y = Phaser.Math.Between(100, height * 0.6);

        // Randomize Type (Weighted)
        const rand = Math.random();
        let type = FishType.SMALL;
        if (rand > 0.9) type = FishType.BIG;      // 10% chance
        else if (rand > 0.6) type = FishType.MEDIUM; // 30% chance

        // Revert: Spawn outside screen
        const fish = new Fish(this, x, y, type, direction);
        this.fishes.add(fish);
        
        // Ensure gravity is disabled AFTER adding to group (Group might override it)
        const body = fish.body as Phaser.Physics.Arcade.Body;
        body.setAllowGravity(false);
        
        // Re-apply velocity (Group might override it)
        const config = FISH_CONFIGS[type];
        body.setVelocityX(config.speed * direction);
    }

    private handleHit(obj1: Phaser.GameObjects.GameObject, obj2: Phaser.GameObjects.GameObject) {
        const arrow = obj1 as Arrow;
        const fish = obj2 as Fish;

        // Score
        this.score += fish.scoreValue;
        this.scoreText.setText(`Score: ${this.score}`);

        // Effects (simple text popup)
        const popup = this.add.text(fish.x, fish.y, `+${fish.scoreValue}`, {
            fontSize: '32px',
            color: '#ffff00',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        
        this.tweens.add({
            targets: popup,
            y: popup.y - 50,
            alpha: 0,
            duration: 800,
            onComplete: () => popup.destroy()
        });

        // Destroy both
        arrow.destroy();
        fish.destroy();
    }
}
