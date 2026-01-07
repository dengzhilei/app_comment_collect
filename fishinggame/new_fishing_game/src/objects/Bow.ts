import Phaser from 'phaser';

export class Bow extends Phaser.GameObjects.Container {
    private bowGraphics: Phaser.GameObjects.Graphics;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        this.bowGraphics = scene.add.graphics();
        this.bowGraphics.lineStyle(4, 0xffffff);
        // Draw a simple arc for the bow
        this.bowGraphics.beginPath();
        this.bowGraphics.arc(0, 0, 30, Phaser.Math.DegToRad(135), Phaser.Math.DegToRad(45), false);
        this.bowGraphics.strokePath();
        
        this.add(this.bowGraphics);
        
        scene.add.existing(this);
    }

    setAngle(angle: number) {
        this.rotation = Phaser.Math.DegToRad(angle);
    }
}


