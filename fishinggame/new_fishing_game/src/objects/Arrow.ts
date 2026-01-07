import Phaser from 'phaser';

export class Arrow extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'arrow');
        
        // Create a placeholder texture if not exists
        if (!scene.textures.exists('arrow')) {
            const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0xffffff);
            graphics.fillRect(0, 0, 40, 5); // Long thin arrow
            graphics.generateTexture('arrow', 40, 5);
        }
        this.setTexture('arrow');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Physics properties
        const body = this.body as Phaser.Physics.Arcade.Body;
        body.setCollideWorldBounds(true);
        body.setBounce(0.5);
    }

    fire(angle: number, power: number) {
        this.setActive(true);
        this.setVisible(true);
        
        // Calculate velocity based on angle and power
        // Phaser angles are in degrees, 0 is right, 90 is down
        // We need to convert to radians
        const rad = Phaser.Math.DegToRad(angle);
        
        const speed = 300 + (power * 10); // Base speed + power multiplier
        
        this.scene.physics.velocityFromRotation(rad, speed, this.body!.velocity);
        
        this.setRotation(rad);
    }

    update() {
        if (this.y > this.scene.scale.height + 50) {
            this.destroy();
            return;
        }

        // Rotate arrow to match velocity
        if (this.body) {
            const velocity = this.body.velocity;
            if (velocity.length() > 10) {
                this.setRotation(velocity.angle());
            }
        }
    }
}


