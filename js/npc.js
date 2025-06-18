// js/npc.js
import { addChatMessage } from './ui.js';
import { TILE_TYPES, CONFIG } from './config.js';

function getTotalNpcResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initNpcs(config, map) {
    const npcs = [];
    const npcColors = ['#ff6347', '#4682b4', '#32cd32', '#ee82ee'];
    for (let i = 0; i < config.NUM_NPCS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * config.MAP_WIDTH);
            y = Math.floor(Math.random() * config.MAP_HEIGHT);
        } while (!map[y][x].type.accessible || (x === Math.floor(config.MAP_WIDTH / 2) + 1 && y === Math.floor(config.MAP_HEIGHT / 2)));
        
        npcs.push({
            id: `npc_${Date.now()}_${i}`,
            x, y,
            color: npcColors[i % npcColors.length],
            name: `Survivant ${i + 1}`,
            timeSinceLastMove: 0,
            inventory: {},
            capacity: 15,
            goal: 'harvesting', // 'harvesting', 'depositing', ou 'fighting'
            // NOUVEAU: Propriétés pour le combat
            health: CONFIG.NPC_BASE_HEALTH,
            maxHealth: CONFIG.NPC_BASE_HEALTH,
            damage: CONFIG.NPC_BASE_DAMAGE,
            targetEnemyId: null,
        });
    }
    return npcs;
}

export function updateNpcs(gameState, deltaTime) {
    const { npcs, map, shelterLocation, enemies } = gameState;
    if (!shelterLocation) return;

    // Itérer en sens inverse pour pouvoir supprimer des PNJ morts sans problème d'index
    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        // NOUVEAU : Gérer la mort du PNJ
        if (npc.health <= 0) {
            addChatMessage(`${npc.name} a été vaincu...`, 'system');
            npcs.splice(i, 1); // Supprimer le PNJ de la liste
            continue; // Passer au PNJ suivant
        }

        const currentTile = map[npc.y][npc.x];
        const totalResources = getTotalNpcResources(npc.inventory);

        // --- NOUVELLE LOGIQUE DE DÉCISION ---
        // 1. Détecter les ennemis proches (priorité absolue)
        let closestEnemy = null;
        let minDistance = Infinity;

        enemies.forEach(enemy => {
            const dist = Math.hypot(npc.x - enemy.x, npc.y - enemy.y);
            if (dist < minDistance && dist <= CONFIG.NPC_AGGRO_RADIUS) {
                minDistance = dist;
                closestEnemy = enemy;
            }
        });
        
        // 2. Définir l'objectif actuel
        if (closestEnemy) {
            npc.goal = 'fighting';
            npc.targetEnemyId = closestEnemy.id;
        } else {
            // Si le PNJ n'a plus de cible, il oublie son objectif de combat
            if(npc.goal === 'fighting') {
                npc.targetEnemyId = null;
            }
            // Logique habituelle si pas d'ennemi en vue
            if (totalResources >= npc.capacity) {
                npc.goal = 'depositing';
            } else {
                npc.goal = 'harvesting';
            }
        }
        
        // 3. Agir en fonction de l'objectif
        if (npc.goal === 'fighting') {
            const target = enemies.find(e => e.id === npc.targetEnemyId);
            if (!target) {
                // La cible n'existe plus, on retourne au travail
                npc.goal = 'harvesting';
                continue;
            }

            // Si le PNJ est sur la même case que l'ennemi, il combat
            if (npc.x === target.x && npc.y === target.y) {
                // Échange de coups
                target.currentHealth -= npc.damage;
                npc.health -= target.damage;
                addChatMessage(`${npc.name} attaque ${target.name} ! (${target.currentHealth}/${target.health} PV)`, 'npc');

                if (target.currentHealth <= 0) {
                    addChatMessage(`${npc.name} a vaincu ${target.name} !`, 'gain');
                    gameState.enemies = gameState.enemies.filter(e => e.id !== target.id); // Supprimer l'ennemi
                    npc.goal = 'harvesting'; // Le combat est fini
                    npc.targetEnemyId = null;
                }
            } else {
                // Sinon, se déplacer vers l'ennemi
                let moveX = Math.sign(target.x - npc.x);
                let moveY = Math.sign(target.y - npc.y);
                if (moveX !== 0 && moveY !== 0) {
                    if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                }
                const newX = npc.x + moveX;
                const newY = npc.y + moveY;
                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX; npc.y = newY;
                }
            }

        } else if (npc.goal === 'depositing') {
            if (npc.x === shelterLocation.x && npc.y === shelterLocation.y) {
                const shelterTile = map[shelterLocation.y][shelterLocation.x];
                let depositedCount = 0;
                for (const itemName in npc.inventory) {
                    const count = npc.inventory[itemName];
                    shelterTile.inventory[itemName] = (shelterTile.inventory[itemName] || 0) + count;
                    depositedCount += count;
                }
                if (depositedCount > 0) {
                     addChatMessage(`${npc.name} a déposé ${depositedCount} ressource(s) à la base.`, 'npc');
                }
                npc.inventory = {};
                npc.goal = 'harvesting';
            } else {
                let moveX = Math.sign(shelterLocation.x - npc.x);
                let moveY = Math.sign(shelterLocation.y - npc.y);
                if (moveX !== 0 && moveY !== 0) {
                    if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                }
                const newX = npc.x + moveX;
                const newY = npc.y + moveY;
                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX; npc.y = newY;
                }
            }
        } else if (npc.goal === 'harvesting') {
            if (currentTile.type.resource && currentTile.harvestsLeft > 0) {
                const resourceType = currentTile.type.resource.type;
                const yieldAmount = currentTile.type.resource.yield;
                
                npc.inventory[resourceType] = (npc.inventory[resourceType] || 0) + yieldAmount;
                currentTile.harvestsLeft--;
                
                if (currentTile.harvestsLeft <= 0 && currentTile.type.harvests !== Infinity) {
                    currentTile.type = TILE_TYPES.WASTELAND;
                    currentTile.backgroundKey = TILE_TYPES.WASTELAND.background[Math.floor(Math.random() * TILE_TYPES.WASTELAND.background.length)];
                }
            } else {
                const moveX = Math.floor(Math.random() * 3) - 1;
                const moveY = Math.floor(Math.random() * 3) - 1;
                const newX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, npc.x + moveX));
                const newY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, npc.y + moveY));

                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX;
                    npc.y = newY;
                }
            }
        }
    }
}


export function npcChatter(npcs) {
    if (npcs.length === 0) return;
    const npc = npcs[Math.floor(Math.random() * npcs.length)];
    const messages = [
        "Quelqu'un a vu de la nourriture ?",
        "Je rapporte du bois à la base.",
        "Faites attention, les ressources s'épuisent vite.",
        "On tiendra le coup, tous ensemble.",
        "Je vais chercher de quoi construire."
    ];
    addChatMessage(messages[Math.floor(Math.random() * messages.length)], 'npc', npc.name);
}