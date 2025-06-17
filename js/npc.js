// js/npc.js
import { addChatMessage } from './ui.js';

/**
 * CORRIGÉ : Le mot-clé 'export' a été rajouté.
 */
export function initNpcs(config, map) {
    const npcs = [],
        npcColors = ['#ff6347', '#4682b4', '#32cd32', '#ee82ee'];
    for (let i = 0; i < config.NUM_NPCS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * config.MAP_WIDTH);
            y = Math.floor(Math.random() * config.MAP_HEIGHT);
        } while (!map[y][x].type.accessible);
        npcs.push({
            x,
            y,
            color: npcColors[i % npcColors.length],
            name: `Survivant ${i + 1}`,
            timeSinceLastMove: 0, // Timer individuel
        });
    }
    return npcs;
}

/**
 * CORRIGÉ : Le mot-clé 'export' a été rajouté.
 */
export function updateNpcs(npcs, map, config, deltaTime) {
    npcs.forEach(npc => {
        npc.timeSinceLastMove += deltaTime;

        if (npc.timeSinceLastMove >= config.NPC_ACTION_INTERVAL_MS) {
            npc.timeSinceLastMove = 0; // Réinitialiser le timer

            const moveX = Math.floor(Math.random() * 3) - 1;
            const moveY = Math.floor(Math.random() * 3) - 1;
            const newX = Math.max(0, Math.min(config.MAP_WIDTH - 1, npc.x + moveX));
            const newY = Math.max(0, Math.min(config.MAP_HEIGHT - 1, npc.y + moveY));

            if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                npc.x = newX;
                npc.y = newY;
            }
        }
    });
}

/**
 * CORRIGÉ : Le mot-clé 'export' a été rajouté.
 */
export function npcChatter(npcs) {
    if (npcs.length === 0) return;
    const npc = npcs[Math.floor(Math.random() * npcs.length)];
    const messages = [
        "Quelqu'un a vu de la nourriture ?",
        "J'ai trouvé une source d'eau vers le nord.",
        "Faites attention, les ressources s'épuisent vite.",
        "On tiendra le coup, tous ensemble.",
        "Il faut construire un abri avant la nuit."
    ];
    addChatMessage(messages[Math.floor(Math.random() * messages.length)], 'npc', npc.name);
}