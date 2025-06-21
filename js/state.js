// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, consumeItem as playerConsumeItemLogic, transferItems } from './player.js';
import { initNpcs } from './npc.js';
import { initEnemies } from './enemy.js';
import { TILE_TYPES, CONFIG, ITEM_TYPES } from './config.js';

const gameState = {
    map: [],
    player: null,
    npcs: [],
    enemies: [],
    day: 1,
    gameIntervals: [],
    activeEvent: { type: 'none', duration: 0, data: null },
    shelterLocation: null,
    isGameOver: false,
    combatState: null,
    config: null,
    knownRecipes: {},
    mapTileGlobalVisitCounts: new Map(), 
    globallyRevealedTiles: new Set(),   
};

export const state = gameState;

export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config);
    gameState.config = config;
    gameState.map = generateMap(config); 

    gameState.player = initPlayer(config, 'player1'); 

    let startX, startY, attempts = 0;
    const occupiedStarts = new Set(); 

    do {
        startX = Math.floor(Math.random() * config.MAP_WIDTH);
        startY = Math.floor(Math.random() * config.MAP_HEIGHT);
        attempts++;
        if (attempts > 200) { 
            console.error("Impossible de trouver une case de départ de type Plage libre !");
            const fallbackBeach = gameState.map.flat().find(t => t.type.name === TILE_TYPES.PLAGE.name && t.type.accessible);
            if (fallbackBeach) {
                startX = fallbackBeach.x;
                startY = fallbackBeach.y;
            } else { 
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

    gameState.player.visitedTiles.add(`${startX},${startY}`);
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

    gameState.player.visitedTiles.add(`${newX},${newY}`);
    const tileKey = `${newX},${newY}`;
    if (!gameState.mapTileGlobalVisitCounts.has(tileKey)) {
        gameState.mapTileGlobalVisitCounts.set(tileKey, new Set());
    }
    gameState.mapTileGlobalVisitCounts.get(tileKey).add(gameState.player.id); 

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
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(tile.type.inventory)); 
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
    console.log("Combat started with:", enemy.name, enemy.isSearchEncounter ? "(Search Encounter)" : "(Regular Enemy)");
}

export function endCombat(victory) {
    const { combatState, player } = gameState;
    if (!combatState) return;

    const enemyDefeated = combatState.enemy; 

    if (victory) {
        if (!enemyDefeated.isSearchEncounter) {
            gameState.enemies = gameState.enemies.filter(e => e.id !== enemyDefeated.id);
            console.log(`Regular enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) removed from global list.`);
        } else {
            console.log(`Search encounter enemy ${enemyDefeated.name} (ID: ${enemyDefeated.id}) was defeated.`);
        }
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
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || !player.inventory[itemName]) return { success: false, message: "Objet introuvable." };
    const slot = itemDef.slot;
    if (!slot || !player.equipment.hasOwnProperty(slot)) return { success: false, message: "Vous ne pouvez pas équiper ceci." };
    if (player.equipment[slot]) {
        const unequipResult = unequipItem(slot);
        if (!unequipResult.success) return unequipResult;
    }
    player.inventory[itemName]--;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
    const newEquip = { name: itemName, ...itemDef };
    if (newEquip.hasOwnProperty('durability')) newEquip.currentDurability = newEquip.durability;
    player.equipment[slot] = newEquip;
    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) player[stat] += itemDef.stats[stat];
            else if (player.hasOwnProperty(stat)) player[stat] += itemDef.stats[stat];
        }
    }
    return { success: true, message: `${itemName} équipé.` };
}

export function unequipItem(slot) {
    const player = gameState.player;
    const item = player.equipment[slot];
    if (!item) return { success: false, message: "Aucun objet dans cet emplacement." };
    if (getTotalResources(player.inventory) >= player.maxInventory) return { success: false, message: "Inventaire plein." };
    addResourceToPlayer(item.name, 1);
    player.equipment[slot] = null;
    if (item.stats) {
        for (const stat in item.stats) {
            if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
                const currentStatName = stat.substring(3).toLowerCase(); 
                if (player.hasOwnProperty(currentStatName)) player[currentStatName] = Math.min(player[currentStatName], player[stat]);
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
    if (!tile || !buildingType || !buildingType.isBuilding) return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };
    if (!tile.type.buildable) return { success: false, message: "Vous ne pouvez pas construire ici." };
    
    // MODIFIÉ (Point 3) - Permettre PETIT_PUIT sur autre chose que Plaine si besoin, sinon la condition reste
    if (tile.type.name !== TILE_TYPES.PLAINS.name && 
        buildingKey !== 'MINE' && 
        buildingKey !== 'CAMPFIRE' &&
        buildingKey !== 'PETIT_PUIT' // Ajouté ici, ou à retirer si PETIT_PUIT doit être QUE sur Plaine
    ) {
         return { success: false, message: "Ce bâtiment ne peut être construit que sur une Plaine."};
    }
    
    tile.buildings.push({ key: buildingKey, durability: buildingType.durability, maxDurability: buildingType.durability });
    if (buildingType.inventory && !tile.inventory) tile.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    if (buildingKey === 'SHELTER_COLLECTIVE') gameState.shelterLocation = { x, y };

    // Point 12: Si on voulait marquer la recette du *bâtiment* comme connue lors de la construction
    // if (buildingType.name && ITEM_TYPES[`Parchemin Atelier ${buildingType.name}`]?.isBuildingRecipe) {
    //     gameState.knownRecipes[buildingType.name] = 'built_or_learned'; // Marquer comme appris/construit
    // }

    return { success: true, message: `${buildingType.name} construit.` };
}

export function damageBuilding(tileX, tileY, buildingIndexInTileArray, damageAmount = 1) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndexInTileArray]) return { destroyed: false };
    const building = tile.buildings[buildingIndexInTileArray];
    building.durability -= damageAmount;
    if (building.durability <= 0) {
        const buildingName = TILE_TYPES[building.key].name;
        const buildingKeyDestroyed = building.key;
        tile.buildings.splice(buildingIndexInTileArray, 1);
        if (TILE_TYPES[buildingKeyDestroyed]?.inventory && !tile.buildings.some(b => TILE_TYPES[b.key]?.inventory)) {
            // tile.inventory = {}; 
        }
        if (buildingKeyDestroyed === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
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
    
    // MODIFIÉ (Point 8) - Rendre la tuile forêt inconstructible si elle vient d'être plantée
    if (newTerrainTypeKey === 'FOREST') {
        tile.type.buildable = false; // Assumant que TILE_TYPES.FOREST.buildable est false par défaut.
                                     // Sinon, il faudrait copier type et modifier: tile.type = {...newTerrainType, buildable: false};
    }
}

export function hasResources(costs) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];
    const groundItems = tile.groundItems || {};
    for (const resource in costs) {
        const playerAmount = player.inventory[resource] || 0;
        const groundAmount = groundItems[resource] || 0;
        if (playerAmount + groundAmount < costs[resource]) return { success: false, missing: resource };
    }
    return { success: true };
}

export function applyResourceDeduction(costs) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];
    const groundItems = tile.groundItems || {};
    for (const resource in costs) {
        let needed = costs[resource];
        if (player.inventory[resource] > 0) {
            const takeFromPlayer = Math.min(needed, player.inventory[resource]);
            player.inventory[resource] -= takeFromPlayer;
            if (player.inventory[resource] <= 0) delete player.inventory[resource];
            needed -= takeFromPlayer;
        }
        if (needed > 0 && groundItems[resource] > 0) {
            const takeFromGround = Math.min(needed, groundItems[resource]);
            groundItems[resource] -= takeFromGround;
            if (groundItems[resource] <= 0) delete groundItems[resource];
            needed -= takeFromGround;
        }
        if (needed > 0) console.warn(`[applyResourceDeduction] Manque de ${resource} après tentative de déduction.`);
    }
}

export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result = playerConsumeItemLogic(itemName, player); // Renvoie success, message, floatingTexts

    if (!result.success && !itemDef?.teachesRecipe && !(itemName === 'Carte' && itemDef?.uses)) return result;
    if (itemName === 'Carte' && itemDef?.uses) return { success: true, message: "Vous consultez la carte.", floatingTexts: [] };

    if (itemDef?.teachesRecipe) {
        if (gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) { 
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
            if (itemDef.type !== 'consumable') { 
                 if (player.inventory[itemName] > 0) { 
                    player.inventory[itemName]--;
                    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
                 } else { return { success: false, message: "Erreur: Parchemin non trouvé pour apprendre la recette."}; }
            }
        }
        result.success = true; 
    } else if (itemDef?.effects?.custom) {
        if (itemDef.effects.custom === 'porteBonheur') { /* ... (garder la logique existante) ... */ }
        else if (itemDef.effects.custom === 'eauSaleeEffect') { // MODIFIÉ (Point 6)
            if (player.status === 'Malade') {
                if(player.health > 0) player.health = Math.max(0, player.health - 1);
                if (!result.floatingTexts) result.floatingTexts = [];
                // result.floatingTexts.push('-1❤️ (Maladie aggravée)'); // Point 23
            } else {
                if (Math.random() < 0.5) { 
                    player.status = 'Malade';
                    if (!result.floatingTexts) result.floatingTexts = [];
                    result.floatingTexts.push('Statut: Malade');
                }
            }
        } else if (itemDef.effects.custom === 'poissonCruEffect') { // MODIFIÉ (Point 18)
            if (player.status === 'Malade') {
                if(player.health > 0) player.health = Math.max(0, player.health - 2);
                if (!result.floatingTexts) result.floatingTexts = [];
                // result.floatingTexts.push('-2❤️ (Maladie aggravée)'); // Point 23
            } else {
                if (Math.random() < 0.5) { 
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


export function dropItemOnGround(itemName, quantity) { // MODIFIÉ (Point 4)
    const player = gameState.player;
    if (!player.inventory[itemName] || player.inventory[itemName] < quantity) {
        return { success: false, message: "Quantité insuffisante dans l'inventaire." };
    }
    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems) tile.groundItems = {};

    player.inventory[itemName] -= quantity;
    if (player.inventory[itemName] <= 0) delete player.inventory[itemName];

    tile.groundItems[itemName] = (tile.groundItems[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez déposé ${quantity} ${itemName} au sol.` };
}

export function pickUpItemFromGround(itemName, quantity) { // MODIFIÉ (Point 4)
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
    if (tile.groundItems[itemName] <= 0) delete tile.groundItems[itemName];

    player.inventory[itemName] = (player.inventory[itemName] || 0) + quantity;
    return { success: true, message: `Vous avez ramassé ${quantity} ${itemName}.` };
}