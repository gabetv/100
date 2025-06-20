// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, consumeItem as playerConsumeItemLogic, transferItems } from './player.js'; // Retiré hasResources et deductResources d'ici
import { initNpcs } from './npc.js'; // Assurez-vous que cet import est correct
import { initEnemies } from './enemy.js';
import { TILE_TYPES, CONFIG, ITEM_TYPES } from './config.js';

const gameState = {
    map: [],
    player: null, // Sera un objet joueur unique pour l'instant
    // Pour une future version multijoueur, players pourrait être un objet/Map: { 'playerId1': playerObject1, ... }
    npcs: [],
    enemies: [],
    day: 1,
    gameIntervals: [],
    activeEvent: { type: 'none', duration: 0, data: null },
    shelterLocation: null,
    isGameOver: false,
    combatState: null,
    config: null, // Sera initialisé avec CONFIG
    knownRecipes: {
        // 'Planche': true, // Retiré, les recettes sont apprises via parchemins
        // D'autres recettes initiales pourraient être ajoutées ici
    },
    mapTileGlobalVisitCounts: new Map(), // Pour le brouillard de guerre global: Map<"x,y", Set<playerId>>
    globallyRevealedTiles: new Set(),   // Pour le brouillard de guerre global: Set<"x,y">
};

// Exporte l'objet gameState lui-même pour un accès direct
export const state = gameState;

// Exporte la fonction initializeGameState
export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config);
    gameState.config = config;
    gameState.map = generateMap(config); // Génère la carte en premier

    // Initialisation du joueur (pour l'instant un seul)
    gameState.player = initPlayer(config, 'player1'); // Donne un ID au joueur

    // Trouver une position de départ unique sur une "Plage"
    let startX, startY, attempts = 0;
    const occupiedStarts = new Set(); // Pourrait être utilisé si plusieurs joueurs sont initialisés

    do {
        startX = Math.floor(Math.random() * config.MAP_WIDTH);
        startY = Math.floor(Math.random() * config.MAP_HEIGHT);
        attempts++;
        if (attempts > 200) { // Sécurité pour éviter boucle infinie
            console.error("Impossible de trouver une case de départ de type Plage libre !");
            // Fallback sur une case accessible par défaut, ou la première plage trouvée
            const fallbackBeach = gameState.map.flat().find(t => t.type.name === TILE_TYPES.PLAGE.name && t.type.accessible);
            if (fallbackBeach) {
                startX = fallbackBeach.x;
                startY = fallbackBeach.y;
            } else { // Si vraiment aucune plage, fallback sur le centre (ce qui ne devrait pas arriver)
                startX = Math.floor(config.MAP_WIDTH / 2);
                startY = Math.floor(config.MAP_HEIGHT / 2);
            }
            break;
        }
    } while (
        !gameState.map[startY] ||
        !gameState.map[startY][startX] ||
        gameState.map[startY][startX].type.name !== TILE_TYPES.PLAGE.name ||
        !gameState.map[startY][startX].type.accessible ||
        occupiedStarts.has(`${startX},${startY}`)
    );

    gameState.player.x = startX;
    gameState.player.y = startY;
    occupiedStarts.add(`${startX},${startY}`);

    // Marquer la tuile de départ comme visitée
    gameState.player.visitedTiles.add(`${startX},${startY}`);
    // Contribuer au compteur global de visites pour la tuile de départ
    const startTileKey = `${startX},${startY}`;
    if (!gameState.mapTileGlobalVisitCounts.has(startTileKey)) {
        gameState.mapTileGlobalVisitCounts.set(startTileKey, new Set());
    }
    gameState.mapTileGlobalVisitCounts.get(startTileKey).add(gameState.player.id);
    if (gameState.mapTileGlobalVisitCounts.get(startTileKey).size >= CONFIG.FOG_OF_WAR_REVEAL_THRESHOLD) {
        gameState.globallyRevealedTiles.add(startTileKey);
    }


    gameState.npcs = initNpcs(config, gameState.map);
    gameState.enemies = initEnemies(config, gameState.map);

    gameState.shelterLocation = null;
    const existingShelterTile = gameState.map.flat().find(tile =>
        tile.buildings && tile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE')
    );
    if (existingShelterTile) {
        gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
    }
    console.log("GameState initialisé:", gameState);
}


export function applyPlayerMove(direction) {
    const { x, y } = gameState.player;
    let newX = x, newY = y;
    if (direction === 'north') newY--;
    else if (direction === 'south') newY++;
    else if (direction === 'west') newX--;
    else if (direction === 'east') newX++;

    gameState.player.x = newX;
    gameState.player.y = newY;

    // Mise à jour du brouillard de guerre
    gameState.player.visitedTiles.add(`${newX},${newY}`);
    const tileKey = `${newX},${newY}`;
    if (!gameState.mapTileGlobalVisitCounts.has(tileKey)) {
        gameState.mapTileGlobalVisitCounts.set(tileKey, new Set());
    }
    gameState.mapTileGlobalVisitCounts.get(tileKey).add(gameState.player.id); // Utilise l'ID du joueur

    if (gameState.mapTileGlobalVisitCounts.get(tileKey).size >= CONFIG.FOG_OF_WAR_REVEAL_THRESHOLD) {
        gameState.globallyRevealedTiles.add(tileKey);
    }
}

export function applyBulkInventoryTransfer(itemName, amount, transferType) {
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;

    let targetInventory;
    let targetCapacity = Infinity;

    const buildingWithInventory = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory);

    if (buildingWithInventory) {
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(TILE_TYPES[buildingWithInventory.key].inventory));
        targetInventory = tile.inventory;
        targetCapacity = TILE_TYPES[buildingWithInventory.key].maxInventory || Infinity;
    } else if (tile.type.inventory) {
        targetInventory = tile.inventory;
        targetCapacity = tile.type.maxInventory || Infinity;
    } else {
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }


    let from, to, success;

    if (transferType === 'deposit') {
        from = player.inventory;
        to = targetInventory;
        success = transferItems(itemName, amount, from, to, targetCapacity);
        if (success) return { success: true, message: `Vous avez déposé ${amount} ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Quantité invalide ou stockage plein ?" };
    }

    if (transferType === 'withdraw') {
        from = targetInventory;
        to = player.inventory;
        const playerCapacity = player.maxInventory;
        success = transferItems(itemName, amount, from, to, playerCapacity);
        if (success) return { success: true, message: `Vous avez pris ${amount} ${itemName}.` };
        return { success: false, message: "Le retrait a échoué. Inventaire plein ou stock insuffisant ?" };
    }

    return { success: false, message: "Type de transfert inconnu." };
}

export function startCombat(player, enemy) {
    if (gameState.combatState) return;
    player.isBusy = true;
    gameState.combatState = {
        enemy: enemy,
        isPlayerTurn: true,
        log: [`Un ${enemy.name} vous attaque !`],
    };
    console.log("Combat started with:", enemy.name);
}

export function endCombat(victory) {
    const { combatState, player } = gameState;
    if (!combatState) return;

    if (victory) {
        const enemy = combatState.enemy;
        Object.keys(enemy.loot).forEach(resource => {
            addResourceToPlayer(resource, enemy.loot[resource]);
        });

        gameState.enemies = gameState.enemies.filter(e => e.id !== enemy.id);
    }

    player.isBusy = false;
    gameState.combatState = null;
    console.log("Combat ended.");
}

export function addEnemy(enemy) {
    if (enemy) {
        gameState.enemies.push(enemy);
    }
}

export function equipItem(itemName) {
    console.log(`[State.equipItem] Appelée avec l'objet : '${itemName}'`);
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];

    if (!itemDef || !player.inventory[itemName]) {
        console.error(`[State.equipItem] ÉCHEC : L'objet '${itemName}' est introuvable ou n'est plus dans l'inventaire.`);
        return { success: false, message: "Objet introuvable." };
    }

    const slot = itemDef.slot;
    console.log(`[State.equipItem] L'objet a le slot : '${slot}'.`);

    if (!slot || !player.equipment.hasOwnProperty(slot)) {
        console.error(`[State.equipItem] ÉCHEC : L'objet n'a pas de slot valide ou le joueur n'a pas cet emplacement d'équipement. Slot de l'objet : ${slot}`);
        return { success: false, message: "Vous ne pouvez pas équiper ceci." };
    }

    if (player.equipment[slot]) {
        console.log(`[State.equipItem] Le slot '${slot}' est déjà occupé par '${player.equipment[slot].name}'. Tentative de déséquipement.`);
        const unequipResult = unequipItem(slot);
        if (!unequipResult.success) {
            console.error(`[State.equipItem] ÉCHEC : Le déséquipement de l'objet précédent a échoué. Message: ${unequipResult.message}`);
            return unequipResult;
        }
    }

    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];

    const newEquip = { name: itemName, ...itemDef };
    // Si l'objet a une durabilité définie dans ITEM_TYPES, initialiser currentDurability
    if (newEquip.hasOwnProperty('durability')) { // Vérifier si la propriété 'durability' existe (pas 'uses')
      newEquip.currentDurability = newEquip.durability;
    }
    player.equipment[slot] = newEquip;


    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            // Gérer les stats de type maxHealth, maxThirst, etc.
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] += itemDef.stats[stat];
            }
            // Gérer les stats directes comme damage, defense, etc.
            // Celles-ci ne sont généralement pas des propriétés directes du joueur mais utilisées au calcul.
            // Pour `maxInventory` sur les sacs, ou d'autres stats d'équipement.
            else if (player.hasOwnProperty(stat)) {
                 player[stat] += itemDef.stats[stat];
            }
        }
    }


    console.log(`[State.equipItem] SUCCÈS : '${itemName}' a été équipé dans le slot '${slot}'.`);
    return { success: true, message: `${itemName} équipé.` };
}

export function unequipItem(slot) {
    const player = gameState.player;
    const item = player.equipment[slot];
    if (!item) return { success: false, message: "Aucun objet dans cet emplacement." };

    if (getTotalResources(player.inventory) >= player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    // Lors du déséquipement, on remet l'objet dans l'inventaire avec son nom.
    // La durabilité actuelle (currentDurability) est une propriété de l'instance d'équipement,
    // pas de l'item type. Pour simplifier, on assume que l'objet remis dans l'inventaire
    // est "comme neuf" ou que la durabilité n'est pas suivie pour les objets non équipés.
    // Si on voulait suivre la durabilité des objets en inventaire, il faudrait un système plus complexe.
    addResourceToPlayer(item.name, 1);
    player.equipment[slot] = null;

    if (item.stats) {
        for (const stat in item.stats) {
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
                // S'assurer que la stat actuelle ne dépasse pas le nouveau max
                const currentStatName = stat.substring(3).toLowerCase(); // ex: health de maxHealth
                if (player.hasOwnProperty(currentStatName)) {
                    player[currentStatName] = Math.min(player[currentStatName], player[stat]);
                }
            } else if (player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
            }
        }
    }

    return { success: true, message: `${item.name} déséquipé.` };
}

export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

export function addBuildingToTile(x, y, buildingKey) {
    const tile = gameState.map[y][x];
    const buildingType = TILE_TYPES[buildingKey];

    if (!tile || !buildingType || !buildingType.isBuilding) {
        return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    }
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) {
        return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };
    }
    if (!tile.type.buildable) {
         return { success: false, message: "Vous ne pouvez pas construire ici." };
    }
     if (tile.type.name !== TILE_TYPES.PLAINS.name && buildingKey !== 'MINE' && buildingKey !== 'CAMPFIRE') {
        if (Object.values(TILE_TYPES).find(t => t === tile.type)?.name !== TILE_TYPES.PLAINS.name) {
             return { success: false, message: "Ce bâtiment ne peut être construit que sur une Plaine."};
        }
    }


    tile.buildings.push({
        key: buildingKey,
        durability: buildingType.durability,
        maxDurability: buildingType.durability,
    });

    if (buildingType.inventory && !tile.inventory) {
        tile.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    }

    if (buildingKey === 'SHELTER_COLLECTIVE') {
        gameState.shelterLocation = { x, y };
    }

    // Si c'est un bâtiment appris par parchemin, on le marque comme construit pour la logique de recette
    const buildingRecipeParchemin = Object.values(ITEM_TYPES).find(item => item.teachesRecipe === buildingType.name && item.isBuildingRecipe);
    if (buildingRecipeParchemin) {
        // Optionnel : marquer la recette comme "utilisée" si on ne veut pas reconstruire le même bâtiment via parchemin
        // gameState.knownRecipes[buildingType.name] = 'built'; // Ou une autre logique
    }


    return { success: true, message: `${buildingType.name} construit.` };
}

export function damageBuilding(tileX, tileY, buildingIndexInTileArray, damageAmount = 1) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndexInTileArray]) return { destroyed: false };

    const building = tile.buildings[buildingIndexInTileArray];
    building.durability -= damageAmount;

    if (building.durability <= 0) {
        const buildingName = TILE_TYPES[building.key].name;
        tile.buildings.splice(buildingIndexInTileArray, 1);
        if (building.key === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
            const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
            gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
        }
        return { destroyed: true, name: buildingName };
    }
    return { destroyed: false };
}

export function updateTileType(x, y, newTerrainTypeKey) {
    const tile = gameState.map[y][x];
    const newTerrainType = TILE_TYPES[newTerrainTypeKey];

    if (!tile || !newTerrainType) return;

    tile.type = newTerrainType;
    if (newTerrainType.background && newTerrainType.background.length > 0) {
        tile.backgroundKey = newTerrainType.background[Math.floor(Math.random() * newTerrainType.background.length)];
    }
    tile.harvestsLeft = (newTerrainType.harvests === Infinity) ? Infinity : (newTerrainType.harvests || 0);
    tile.resources = newTerrainType.resource ? { ...newTerrainType.resource } : null;
}


/**
 * Vérifie si le joueur ET les objets au sol sur la tuile actuelle ont les ressources nécessaires.
 * @param {object} costs - Objet de coûts { 'item': amount }.
 * @returns {object} - { success: true } ou { success: false, missing: 'item' }.
 */
export function hasResources(costs) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];
    const groundItems = tile.groundItems || {};

    for (const resource in costs) {
        const playerAmount = player.inventory[resource] || 0;
        const groundAmount = groundItems[resource] || 0;
        if (playerAmount + groundAmount < costs[resource]) {
            return { success: false, missing: resource };
        }
    }
    return { success: true };
}

/**
 * Déduit les ressources de l'inventaire du joueur ET/OU des objets au sol.
 * Priorise l'inventaire du joueur.
 * @param {object} costs - Objet de coûts { 'item': amount }.
 */
export function applyResourceDeduction(costs) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];
    const groundItems = tile.groundItems || {};

    for (const resource in costs) {
        let needed = costs[resource];

        // D'abord depuis l'inventaire du joueur
        if (player.inventory[resource] > 0) {
            const takeFromPlayer = Math.min(needed, player.inventory[resource]);
            player.inventory[resource] -= takeFromPlayer;
            if (player.inventory[resource] <= 0) {
                delete player.inventory[resource];
            }
            needed -= takeFromPlayer;
        }

        // Puis depuis le sol si encore besoin
        if (needed > 0 && groundItems[resource] > 0) {
            const takeFromGround = Math.min(needed, groundItems[resource]);
            groundItems[resource] -= takeFromGround;
            if (groundItems[resource] <= 0) {
                delete groundItems[resource];
            }
            needed -= takeFromGround;
        }

        if (needed > 0) {
            // Cela ne devrait pas arriver si hasResources a été appelé avant
            console.warn(`[applyResourceDeduction] Manque de ${resource} après tentative de déduction.`);
        }
    }
}

export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result;

    result = playerConsumeItemLogic(itemName, player);

    if (!result.success && !itemDef?.teachesRecipe && !(itemName === 'Carte' && itemDef?.uses)) {
        return result;
    }

    if (itemName === 'Carte' && itemDef?.uses) {
        // La décrémentation de la carte est gérée par l'action d'ouverture de la carte dans main.js
        // Si on arrive ici, c'est que l'action a déjà été validée.
        // On ne fait que retourner un message de succès.
        return { success: true, message: "Vous consultez la carte.", floatingTexts: [] };
    }


    if (itemDef?.teachesRecipe) {
        if (!player.inventory[itemName] && (result.success ? player.inventory[itemName] !== 0 : true)) {
            // Correction : playerConsumeItemLogic décrémente déjà si itemDef.type = consumable.
            // Si teachesRecipe est sur un item non "consumable", il n'est pas décrémenté.
            // On s'assure qu'on en a encore un pour l'apprendre.
            // La condition est complexe ici, s'assurer que si result.success est vrai (donc consommé), l'inventaire est à 0.
            // Si result.success est faux (non consommé par playerConsumeItemLogic), alors il faut vérifier qu'on a l'item.
            // Simplifions : si on a appris la recette et que l'item était un parchemin, il est consommé.
            // On vérifie donc si la recette est déjà connue *avant* de décrémenter à nouveau
        }
        if (gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) { // Ne pas re-consommer si déjà connu (sauf bâtiment)
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
            // Ne pas décrémenter à nouveau si c'est un consommable de base qui a déjà été décrémenté.
            // Et ne pas décrémenter si on relit une recette déjà connue (sauf si c'est la première lecture d'un consommable)
            if (itemDef.type !== 'consumable' && result.success !== true) { // Si ce n'est PAS un consommable, ou si playerConsumeItemLogic ne l'a pas décrémenté
                // On ne décrémente pas, car on relit juste.
            }

        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
            // Assurer la décrémentation si ce n'est pas un 'consumable' de base mais qu'il enseigne une recette
            // et que ce n'est pas le cas où playerConsumeItemLogic l'a déjà fait.
            if (itemDef.type !== 'consumable') {
                 if (player.inventory[itemName] > 0) { // S'assurer qu'on en a encore un
                    player.inventory[itemName]--;
                    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
                 } else {
                     // Cas où le parchemin aurait dû être là mais ne l'est plus. Devrait être rare.
                     return { success: false, message: "Erreur: Parchemin non trouvé pour apprendre la recette."};
                 }
            }
        }
        result.success = true; // L'apprentissage est toujours un succès si on a le parchemin.
    } else if (itemDef?.effects?.custom) {
        if (itemDef.effects.custom === 'porteBonheur') {
            if (Math.random() < 0.5) {
                player.health = player.maxHealth;
                player.thirst = player.maxThirst;
                player.hunger = player.maxHunger;
                player.sleep = player.maxSleep;
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push("Stats restaurées !");
            }
            if (Math.random() < 0.5) {
                const parcheminOfftableKey = Object.keys(ITEM_TYPES).find(key =>
                    key.startsWith('Parchemin Atelier') && ITEM_TYPES[key].rarity === 'offtable'
                );
                if (parcheminOfftableKey) {
                    addResourceToPlayer(parcheminOfftableKey, 1);
                    if (!result.floatingTexts) result.floatingTexts = [];
                    result.floatingTexts.push(`+1 ${parcheminOfftableKey}`);
                }
            }
        } else if (itemDef.effects.custom === 'eauSaleeEffect') {
            if (player.status === 'Malade') {
                if(player.health > 0) player.health = Math.max(0, player.health - 1);
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push('-1❤️ (Maladie aggravée)');
            } else {
                if (Math.random() < 0.5) { // 50% chance to become Malade
                    player.status = 'Malade';
                    if (!result.floatingTexts) result.floatingTexts = [];
                    result.floatingTexts.push('Statut: Malade');
                }
            }
        }
        result.success = true;
        if (!result.message) result.message = `Vous utilisez: ${itemName}.`;
    }

    return result;
}


// --- Fonctions spécifiques aux ressources au sol ---

export function dropItemOnGround(itemName, quantity) {
    const player = gameState.player;
    if (!player.inventory[itemName] || player.inventory[itemName] < quantity) {
        return { success: false, message: "Quantité insuffisante dans l'inventaire." };
    }

    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems) {
        tile.groundItems = {}; // S'assurer que l'objet existe
    }

    player.inventory[itemName] -= quantity;
    if (player.inventory[itemName] <= 0) {
        delete player.inventory[itemName];
    }

    tile.groundItems[itemName] = (tile.groundItems[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez déposé ${quantity} ${itemName} au sol.` };
}

export function pickUpItemFromGround(itemName, quantity) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];

    if (!tile.groundItems || !tile.groundItems[itemName] || tile.groundItems[itemName] < quantity) {
        return { success: false, message: "Quantité insuffisante au sol." };
    }

    const currentTotalResources = getTotalResources(player.inventory);
    if (currentTotalResources + quantity > player.maxInventory) {
        return { success: false, message: "Inventaire plein." };
    }

    tile.groundItems[itemName] -= quantity;
    if (tile.groundItems[itemName] <= 0) {
        delete tile.groundItems[itemName];
    }

    player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez ramassé ${quantity} ${itemName}.` };
}