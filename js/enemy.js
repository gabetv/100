// js/enemy.js
import { ENEMY_TYPES, CONFIG } from './config.js';
import * as State from './state.js';
import * as UI from './ui.js';

export function initEnemies(config, map) {
    const enemies = [];
    for (let i = 0; i < config.INITIAL_ENEMIES; i++) {
        const newEnemy = spawnSingleEnemy(map);
        if (newEnemy) {
            enemies.push(newEnemy);
        }
    }
    return enemies;
}

export function spawnSingleEnemy(map) {
    const typeKeys = Object.keys(ENEMY_TYPES);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const type = ENEMY_TYPES[typeKey];
    
    let x, y, attempts = 0;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        attempts++;
        if (attempts > 50) return null; 
    } while (
        !map[y][x].type.accessible ||
        (State.state.player && Math.hypot(x - State.state.player.x, y - State.state.player.y) < 5)
    );

    return {
        id: `enemy_${Date.now()}_${Math.random()}`,
        ...JSON.parse(JSON.stringify(type)),
        x,
        y,
        currentHealth: type.health,
        timeSinceLastMove: 0,
    };
}

/**
 * Les monstres sont maintenant statiques. Cette fonction est désactivée.
 */
export function updateEnemies(gameState, deltaTime) {
    // Les monstres ne se déplacent plus d'eux-mêmes.
    return;
}

export function findEnemyOnTile(x, y, enemies) {
    return enemies.find(enemy => enemy.x === x && enemy.y === y);
}