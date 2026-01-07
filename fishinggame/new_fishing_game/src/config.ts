import Phaser from 'phaser';
import { Boot } from './scenes/Boot';
import { Preloader } from './scenes/Preloader';
import { Game } from './scenes/Game';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 720, // 9:16 aspect ratio base
    height: 1280,
    parent: 'app',
    backgroundColor: '#028af8', // Basic water color
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 300 }, // Default gravity
            debug: true // Enable debug to see hitboxes
        }
    },
    scene: [Boot, Preloader, Game]
};

export default config;


