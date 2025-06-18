// js/enemy.js
import { ENEMY_TYPES, CONFIG } from './config.js';
import * as State from './state.js';
import * as UI from './ui.js';

// MODIFIÉ: utilise maintenant INITIAL_ENEMIES
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

// NOUVEAU: Fonction pour faire apparaître un seul ennemi
export function spawnSingleEnemy(map) {
    const typeKeys = Object.keys(ENEMY_TYPES);
    const typeKey = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const type = ENEMY_TYPES[typeKey];
    
    let x, y, attempts = 0;
    do {
        x = Math.floor(Math.random() * CONFIG.MAP_WIDTH);
        y = Math.floor(Math.random() * CONFIG.MAP_HEIGHT);
        attempts++;
        // On arrête après 50 tentatives pour éviter une boucle infinie si la carte est pleine
        if (attempts > 50) return null; 
    } while (
        !map[y][x].type.accessible ||
        (State.state.player && Math.hypot(x - State.state.player.x, y - State.state.player.y) < 5) // N'apparaît pas trop près du joueur
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


export function updateEnemies(gameState, deltaTime) {
    const { enemies, player, map, combatState } = gameState;
    if (combatState) return; // Pas de mouvement pendant un combat

    enemies.forEach(enemy => {
        enemy.timeSinceLastMove += deltaTime;
        if (enemy.timeSinceLastMove < 2000) return; // Les ennemis se déplacent toutes les 2s
        enemy.timeSinceLastMove = 0;

        const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y);

        let moveX = 0;
        let moveY = 0;

        if (dist <= enemy.aggroRadius) { // Si le joueur est dans le rayon d'aggro
            moveX = Math.sign(player.x - enemy.x);
            moveY = Math.sign(player.y - enemy.y);
        } else { // Mouvement aléatoire
            moveX = Math.floor(Math.random() * 3) - 1;
            moveY = Math.floor(Math.random() * 3) - 1;
        }
        
        // Prévenir les déplacements en diagonale
        if (moveX !== 0 && moveY !== 0) {
            if (Math.random() < 0.5) moveX = 0; else moveY = 0;
        }

        const newX = enemy.x + moveX;
        const newY = enemy.y + moveY;

        if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
            enemy.x = newX;
            enemy.y = newY;
        }
        
        // Si un ennemi arrive sur la case du joueur, le combat commence
        if(enemy.x === player.x && enemy.y === player.y) {
            State.startCombat(player, enemy);
            UI.showCombatModal(State.state.combatState);
        }
    });
}

export function findEnemyOnTile(x, y, enemies) {
    return enemies.find(enemy => enemy.x === x && enemy.y === y);
}