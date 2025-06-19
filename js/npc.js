// js/npc.js
import { addChatMessage } from './ui.js'; // Assurez-vous que UI est bien importé si addChatMessage est utilisé directement
import { TILE_TYPES, CONFIG, ITEM_TYPES } from './config.js'; // ITEM_TYPES pour les coûts

function getTotalNpcResources(inventory) {
    return Object.values(inventory).reduce((sum, count) => sum + count, 0);
}

export function initNpcs(config, map) {
    const npcs = [];
    const npcColors = ['#ff6347', '#4682b4', '#32cd32', '#ee82ee']; // Tomate, Bleu Acier, Vert Citron, Orchidée
    for (let i = 0; i < config.NUM_NPCS; i++) {
        let x, y;
        do {
            x = Math.floor(Math.random() * config.MAP_WIDTH);
            y = Math.floor(Math.random() * config.MAP_HEIGHT);
        } while (!map[y][x].type.accessible || (x === Math.floor(config.MAP_WIDTH / 2) +1 && y === Math.floor(config.MAP_HEIGHT / 2))); // Éviter la case de départ du joueur
        
        npcs.push({
            id: `npc_${Date.now()}_${i}`,
            x, y,
            color: npcColors[i % npcColors.length],
            name: `Survivant ${i + 1}`,
            timeSinceLastMove: 0,
            inventory: {},
            capacity: 15, // Capacité d'inventaire du PNJ
            goal: 'harvesting', // 'harvesting', 'depositing', 'fighting', ou 'gathering_build_materials'
            targetResource: null, // Pour 'gathering_build_materials'
            health: CONFIG.NPC_BASE_HEALTH,
            maxHealth: CONFIG.NPC_BASE_HEALTH,
            damage: CONFIG.NPC_BASE_DAMAGE,
            targetEnemyId: null,
        });
    }
    return npcs;
}

// Fonction pour vérifier si une ressource est faible à l'abri
function isResourceLowAtShelter(shelterInventory, resourceName, threshold = 10) {
    return (!shelterInventory || !shelterInventory[resourceName] || shelterInventory[resourceName] < threshold);
}


export function updateNpcs(gameState, deltaTime) {
    const { npcs, map, shelterLocation, enemies } = gameState;
    // Si pas d'abri collectif, les PNJ ne peuvent pas déposer/vérifier les ressources pour construction.
    // Ils continueront de récolter pour eux-mêmes ou combattre.
    const shelterTile = shelterLocation ? map[shelterLocation.y][shelterLocation.x] : null;
    const shelterInventory = shelterTile ? shelterTile.inventory : null;


    for (let i = npcs.length - 1; i >= 0; i--) {
        const npc = npcs[i];

        npc.timeSinceLastMove += deltaTime;
        if (npc.timeSinceLastMove < CONFIG.NPC_ACTION_INTERVAL_MS) continue;
        npc.timeSinceLastMove = 0;

        if (npc.health <= 0) {
            addChatMessage(`${npc.name} a été vaincu...`, 'system_warning');
            npcs.splice(i, 1); 
            continue; 
        }

        const currentTile = map[npc.y][npc.x];
        const totalResourcesInNpcInventory = getTotalNpcResources(npc.inventory);

        // --- Logique de Décision de l'Objectif (Goal) ---
        let closestEnemy = null;
        let minDistanceToEnemy = Infinity;
        enemies.forEach(enemy => {
            const dist = Math.hypot(npc.x - enemy.x, npc.y - enemy.y);
            if (dist < minDistanceToEnemy && dist <= CONFIG.NPC_AGGRO_RADIUS) {
                minDistanceToEnemy = dist;
                closestEnemy = enemy;
            }
        });
        
        if (closestEnemy) {
            npc.goal = 'fighting';
            npc.targetEnemyId = closestEnemy.id;
        } else {
            if(npc.goal === 'fighting') npc.targetEnemyId = null; // Oublier la cible si plus d'ennemi

            if (totalResourcesInNpcInventory >= npc.capacity) {
                npc.goal = 'depositing';
                npc.targetResource = null; // Annuler la recherche de ressource spécifique
            } else if (shelterInventory) { // Seulement si l'abri existe et a un inventaire
                // Prioriser les matériaux de construction si bas à l'abri
                if (isResourceLowAtShelter(shelterInventory, 'Bois', 50)) { // Seuil plus élevé pour le bois
                    npc.goal = 'gathering_build_materials';
                    npc.targetResource = 'Bois';
                } else if (isResourceLowAtShelter(shelterInventory, 'Pierre', 30)) {
                    npc.goal = 'gathering_build_materials';
                    npc.targetResource = 'Pierre';
                } else {
                    npc.goal = 'harvesting'; // Récolte générique
                    npc.targetResource = null;
                }
            } else { // Pas d'abri ou d'inventaire d'abri, récolte générique
                npc.goal = 'harvesting';
                npc.targetResource = null;
            }
        }
        
        // --- Agir en fonction de l'Objectif ---
        if (npc.goal === 'fighting') {
            // ... (logique de combat existante, inchangée pour l'instant) ...
            const target = enemies.find(e => e.id === npc.targetEnemyId);
            if (!target || target.currentHealth <= 0) {
                npc.goal = 'harvesting'; // Retour à la récolte si la cible disparaît
                npc.targetEnemyId = null;
                continue;
            }

            if (npc.x === target.x && npc.y === target.y) {
                target.currentHealth -= npc.damage;
                npc.health -= target.damage; // Les PNJ peuvent aussi prendre des dégâts
                // addChatMessage(`${npc.name} attaque ${target.name} ! (${target.currentHealth}/${target.health} PV de l'ennemi)`, 'npc_combat');

                if (target.currentHealth <= 0) {
                    addChatMessage(`${npc.name} a vaincu ${target.name} !`, 'gain');
                    gameState.enemies = gameState.enemies.filter(e => e.id !== target.id); 
                    // Le PNJ pourrait ramasser le butin, mais c'est plus complexe. Pour l'instant, il retourne à ses occupations.
                }
                if (npc.health <= 0) continue; // Vérifier si le PNJ est mort après l'échange

            } else { // Se déplacer vers l'ennemi
                let moveX = Math.sign(target.x - npc.x);
                let moveY = Math.sign(target.y - npc.y);
                if (moveX !== 0 && moveY !== 0) { // Mouvement diagonal simple
                    if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                }
                const newX = npc.x + moveX;
                const newY = npc.y + moveY;
                if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                    npc.x = newX; npc.y = newY;
                }
            }

        } else if (npc.goal === 'depositing') {
            if (!shelterLocation) { // Si l'abri a été détruit ou n'existe pas
                npc.goal = 'harvesting'; // Retourner à la récolte, ne peut pas déposer
                continue;
            }
            if (npc.x === shelterLocation.x && npc.y === shelterLocation.y) {
                if (shelterInventory) { // S'assurer que l'inventaire de l'abri existe
                    let depositedCount = 0;
                    for (const itemName in npc.inventory) {
                        const count = npc.inventory[itemName];
                        shelterInventory[itemName] = (shelterInventory[itemName] || 0) + count;
                        depositedCount += count;
                    }
                    if (depositedCount > 0) {
                         addChatMessage(`${npc.name} a déposé ${depositedCount} ressource(s) à la base.`, 'npc');
                    }
                    npc.inventory = {};
                }
                // Après dépôt, redécider du but (pourrait être de chercher des matériaux de construction)
                // La logique de décision au début de la boucle s'en chargera au prochain tick.
                // Pour forcer une redécision immédiate, on pourrait mettre npc.goal = null;
                // mais laissons la boucle principale gérer pour l'instant.

            } else { // Se déplacer vers l'abri
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
        } else if (npc.goal === 'harvesting' || npc.goal === 'gathering_build_materials') {
            // Si sur une tuile avec la ressource ciblée (ou n'importe quelle ressource si 'harvesting')
            let canHarvestHere = false;
            if (currentTile.type.resource && currentTile.harvestsLeft > 0) {
                if (npc.goal === 'harvesting' || (npc.goal === 'gathering_build_materials' && currentTile.type.resource.type === npc.targetResource)) {
                    canHarvestHere = true;
                }
            }

            if (canHarvestHere) {
                const resourceType = currentTile.type.resource.type;
                const yieldAmount = currentTile.type.resource.yield || 1; // Assurer un yield par défaut
                
                npc.inventory[resourceType] = (npc.inventory[resourceType] || 0) + yieldAmount;
                if(currentTile.harvestsLeft !== Infinity) currentTile.harvestsLeft--;
                
                // Si la tuile est épuisée, la transformer en Friche
                if (currentTile.harvestsLeft <= 0 && currentTile.type.harvests !== Infinity) {
                    //gameState.map[npc.y][npc.x].type = TILE_TYPES.WASTELAND; // Modifie la définition partagée, pas bon
                    //gameState.map[npc.y][npc.x].backgroundKey = TILE_TYPES.WASTELAND.background[Math.floor(Math.random() * TILE_TYPES.WASTELAND.background.length)];
                    // Il faudrait une fonction State.updateTileType(x, y, newTypeKey) pour gérer ça proprement
                    // Pour l'instant, on va juste marquer que la tuile est vide pour ce PNJ
                    // La logique de transformation de la tuile devrait être gérée par le joueur ou un système global
                }
            } else { // Se déplacer pour trouver la ressource ciblée ou une ressource quelconque
                let bestTile = null;
                let minPathDistance = Infinity;

                // Chercher la ressource ciblée ou la plus proche si générique
                for (let y_scan = 0; y_scan < CONFIG.MAP_HEIGHT; y_scan++) {
                    for (let x_scan = 0; x_scan < CONFIG.MAP_WIDTH; x_scan++) {
                        const scanTile = map[y_scan][x_scan];
                        if (scanTile.type.accessible && scanTile.type.resource && scanTile.harvestsLeft > 0) {
                            if (npc.goal === 'harvesting' || (npc.goal === 'gathering_build_materials' && scanTile.type.resource.type === npc.targetResource)) {
                                const pathDist = Math.abs(npc.x - x_scan) + Math.abs(npc.y - y_scan); // Distance de Manhattan
                                if (pathDist < minPathDistance) {
                                    minPathDistance = pathDist;
                                    bestTile = { x: x_scan, y: y_scan };
                                }
                            }
                        }
                    }
                }
                
                if (bestTile) { // Se déplacer vers la meilleure tuile trouvée
                    let moveX = Math.sign(bestTile.x - npc.x);
                    let moveY = Math.sign(bestTile.y - npc.y);
                    if (moveX !== 0 && moveY !== 0) {
                        if (Math.random() < 0.5) moveX = 0; else moveY = 0;
                    }
                    const newX = npc.x + moveX;
                    const newY = npc.y + moveY;
                    if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                        npc.x = newX; npc.y = newY;
                    }
                } else { // Pas de ressource cible trouvée, mouvement aléatoire
                    const moveX = Math.floor(Math.random() * 3) - 1; 
                    const moveY = Math.floor(Math.random() * 3) - 1;
                    const newX = Math.max(0, Math.min(CONFIG.MAP_WIDTH - 1, npc.x + moveX));
                    const newY = Math.max(0, Math.min(CONFIG.MAP_HEIGHT - 1, npc.y + moveY));

                    if (map[newY] && map[newY][newX] && map[newY][newX].type.accessible) {
                        npc.x = newX; npc.y = newY;
                    }
                }
            }
        }
    }
}


export function npcChatter(npcs) {
    if (npcs.length === 0) return;
    const npc = npcs[Math.floor(Math.random() * npcs.length)];
    let messages = [
        "Quelqu'un a vu de la nourriture ?",
        "Je rapporte du bois à la base.",
        "Faites attention, les ressources s'épuisent vite.",
        "On tiendra le coup, tous ensemble.",
        "Je vais chercher de quoi construire."
    ];

    // Messages contextuels basés sur le but du PNJ
    if (npc.goal === 'depositing') {
        messages.push("Je vais déposer ces trouvailles à l'abri.");
    } else if (npc.goal === 'fighting' && npc.targetEnemyId) {
        messages.push("Un ennemi en vue ! À l'attaque !");
    } else if (npc.goal === 'gathering_build_materials' && npc.targetResource) {
        messages.push(`L'abri a besoin de ${npc.targetResource.toLowerCase()}, j'en cherche.`);
    } else if (npc.goal === 'harvesting') {
        const currentTile = gameState.map[npc.y][npc.x]; // Nécessite gameState accessible ou passé en paramètre
        if (currentTile && currentTile.type.resource) {
             messages.push(`Je crois qu'il y a du ${currentTile.type.resource.type.toLowerCase()} par ici.`);
        } else {
            messages.push("En quête de ressources utiles...");
        }
    }


    // Ajout de messages liés à la construction si l'abri collectif manque de ressources clés
    if (gameState.shelterLocation && gameState.map[gameState.shelterLocation.y][gameState.shelterLocation.x].inventory) {
        const shelterInv = gameState.map[gameState.shelterLocation.y][gameState.shelterLocation.x].inventory;
        if (isResourceLowAtShelter(shelterInv, 'Bois', 50)) {
            messages.push("Il nous faudrait plus de bois pour les constructions !");
        }
        if (isResourceLowAtShelter(shelterInv, 'Pierre', 30)) {
            messages.push("Quelqu'un a vu des pierres ? On en a besoin.");
        }
    } else if (!gameState.shelterLocation) {
         messages.push("On devrait vraiment construire un abri collectif solide !");
    }


    addChatMessage(messages[Math.floor(Math.random() * messages.length)], 'npc', npc.name);
}