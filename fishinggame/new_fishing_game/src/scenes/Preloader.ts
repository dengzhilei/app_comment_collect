import Phaser from 'phaser';

export class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        // Load assets here
        // this.load.image('fish', 'assets/fish.png');
        // this.load.image('bow', 'assets/bow.png');
    }

    create() {
        this.scene.start('Game');
    }
}


