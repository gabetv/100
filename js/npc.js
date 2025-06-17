// js/npc.js
import { addChatMessage } from './ui.js';
// MODIFICATION ICI : On importe également CONFIG
import { TILE_TYPES, CONFIG } from './config.js';

// Fonction utilitaire pour calculer le total des ressources d'un PNJ
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
            x, y,
            color: npcColors[i % npcColors.length],
            name: `Survivant ${i + 1}`,
            timeSinceLastMove: 0,
            // NOUVEAU : Propriétés pour l'IA
            inventory: {},
            capacity: 15, // Capacité de l'inventaire du PNJ
            goal: 'harvesting', // 'harvesting' ou 'depositing'
        });
    }
    return npcs;
}

export function updateNpcs(gameState, deltaTime) {
    const { npcs, map, shelterLocation } = gameState; // On retire 'config' d'ici, on utilisera CONFIG importé directement
    if (!shelterLocation) return; // Pas de base, pas d'IA de dépôt

    npcs.forEach(npc => {
        npc.timeSinceLastMove += deltaTime;
        // L'erreur se produisait ici car CONFIG n'était pas défini
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) return;
        
        npc.timeSinceLastMove = 0;
        const currentTile = map[npc.y][npc.x];
        const totalResources = getTotalNpcResources(npc.inventory);

        // Déterminer l'objectif actuel
        if (totalResources >= npc.capacity) {
            npc.goal = 'depositing';
        }

        if (npc.goal === 'depositing') {
            // Est-ce qu'on est à la base ?
            if (npc.x === shelterLocation.x && npc.y === shelterLocation.y) {
                const shelterTile = map[shelterLocation.y][shelterLocation.x];
                let depositedCount = 0;
                // Transférer les ressources
                for (const itemName in npc.inventory) {
                    const count = npc.inventory[itemName];
                    shelterTile.inventory[itemName] = (shelterTile.inventory[itemName] || 0) + count;
                    depositedCount += count;
                }
                if (depositedCount > 0) {
                     addChatMessage(`${npc.name} a déposé ${depositedCount} ressource(s) à la base.`, 'npc');
                }
                npc.inventory = {}; // Vider l'inventaire
                npc.goal = 'harvesting'; // Nouvel objectif
            } else {
                // Se déplacer vers la base
                let moveX = Math.sign(shelterLocation.x - npc.x);
                let moveY = Math.sign(shelterLocation.y - npc.y);
                
                // Prévenir les déplacements en diagonale pour simplifier
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
            // Récolter si possible sur la case actuelle
            if (currentTile.type.resource && currentTile.harvestsLeft > 0) {
                const resourceType = currentTile.type.resource.type;
                const yieldAmount = currentTile.type.resource.yield;
                
                npc.inventory[resourceType] = (npc.inventory[resourceType] || 0) + yieldAmount;
                currentTile.harvestsLeft--;
                
                // Si la ressource est épuisée, la tuile change
                if (currentTile.harvestsLeft <= 0 && currentTile.type.harvests !== Infinity) {
                    currentTile.type = TILE_TYPES.WASTELAND;
                    currentTile.backgroundKey = TILE_TYPES.WASTELAND.background[Math.floor(Math.random() * TILE_TYPES.WASTELAND.background.length)];
                }
            } else {
                // Sinon, se déplacer aléatoirement
                const moveX = Math.floor(Math.random() * 3) - 1;
                const moveY = Math.floor(Math.random() * 3) - 1;
                // Et ici aussi CONFIG était nécessaire
                const newX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, npc.x + moveX));
                const newY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, npc.y + moveY));

                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX;
                    npc.y = newY;
                }
            }
        }
    });
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