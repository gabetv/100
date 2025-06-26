//js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, consumeItem as playerConsumeItemLogic, transferItems, movePlayer as playerMoveLogic } from './player.js';
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
    config: { ...CONFIG },
    knownRecipes: {},
    mapTileGlobalVisitCounts: new Map(),
    globallyRevealedTiles: new Set(),
    foundUniqueParchemins: new Set(),
    tutorialState: {
        step: 0,
        active: false,
        completed: false,
        welcomeMessageShown: false,
        isTemporarilyHidden: false, // AJOUTÉ/MODIFIÉ
    },
};

export const state = gameState;

export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config);
    gameState.config = { ...config };
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

    for (const itemName in gameState.player.inventory) {
        if (ITEM_TYPES[itemName]?.teachesRecipe && ITEM_TYPES[itemName]?.unique) {
            gameState.foundUniqueParchemins.add(itemName);
            gameState.knownRecipes[ITEM_TYPES[itemName].teachesRecipe] = true;
        }
    }


    gameState.shelterLocation = null;
    const existingShelterTile = gameState.map.flat().find(tile =>
        tile.buildings && tile.buildings.some(b => b.key === 'SHELTER_COLLECTIVE')
    );
    if (existingShelterTile) {
        gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
    }

    gameState.map.flat().forEach(tile => {
        if (tile.type.name === TILE_TYPES.WATER_LAGOON.name) {
            gameState.globallyRevealedTiles.add(`${tile.x},${tile.y}`);
        }
    });

    gameState.tutorialState = {
        step: 0,
        active: false,
        completed: localStorage.getItem('tutorialCompleted') === 'true',
        welcomeMessageShown: false,
        isTemporarilyHidden: false,
    };

    console.log("GameState initialisé DANS initializeGameState (fin):", JSON.parse(JSON.stringify(gameState)));
    console.log("tutorialState DANS initializeGameState (fin):", gameState.tutorialState);
}

export function applyPlayerMove(direction) {
    const { x, y } = gameState.player;
    const moveResult = playerMoveLogic(direction, { x, y });

    if (!moveResult) return;

    const newX = moveResult.newX;
    const newY = moveResult.newY;

    if (newX < 0 || newX >= gameState.config.MAP_WIDTH || newY < 0 || newY >= gameState.config.MAP_HEIGHT ||
        !gameState.map[newY] || !gameState.map[newY][newX] || !gameState.map[newY][newX].type.accessible) {
        console.warn("Invalid move attempted in applyPlayerMove - should be caught earlier.");
        return;
    }

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
    let buildingWithInventory = null;

    let targetInventory;
    let targetCapacity = Infinity;

    if (tile.buildings && tile.buildings.length > 0) {
        buildingWithInventory = tile.buildings.find(b =>
            (TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory) &&
            (b.key === 'SHELTER_INDIVIDUAL' || b.key === 'SHELTER_COLLECTIVE' || TILE_TYPES[b.key]?.name.toLowerCase().includes("coffre"))
        );
    }

    if (buildingWithInventory) {
        if (!buildingWithInventory.inventory) buildingWithInventory.inventory = {};
        targetInventory = buildingWithInventory.inventory;
        targetCapacity = TILE_TYPES[buildingWithInventory.key].maxInventory || Infinity;
    } else if (tile.type.inventory && !buildingWithInventory) {
        const buildingDef = tile.type;
        if (!tile.inventory) tile.inventory = JSON.parse(JSON.stringify(buildingDef.inventory || {}));
        targetInventory = tile.inventory;
        targetCapacity = buildingDef.maxInventory || Infinity;
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

export function equipItem(itemKey) {
    const player = gameState.player;
    const itemInstance = player.inventory[itemKey];

    if (!itemInstance) {
        // Si la clé n'est pas trouvée, c'est peut-être un objet empilable.
        // On cherche la première clé correspondant au nom de l'objet.
        const foundKey = Object.keys(player.inventory).find(key => player.inventory[key].name === itemKey);
        if (foundKey) {
            return equipItem(foundKey); // On relance la fonction avec la bonne clé.
        }
        return { success: false, message: "Objet introuvable dans l'inventaire." };
    }

    const itemName = typeof itemInstance === 'object' ? itemInstance.name : itemKey;
    const itemDef = JSON.parse(JSON.stringify(ITEM_TYPES[itemName]));

    if (!itemDef) return { success: false, message: "Définition de l'objet introuvable." };

    const slot = itemDef.slot;
    if (!slot || !player.equipment.hasOwnProperty(slot)) return { success: false, message: "Vous ne pouvez pas équiper ceci." };

    if (player.equipment[slot]) {
        const unequipResult = unequipItem(slot);
        if (!unequipResult.success) return unequipResult;
    }

    player.equipment[slot] = itemInstance;

    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            if (stat === 'maxInventory') {
                player.maxInventory += itemDef.stats[stat];
            } else if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] += itemDef.stats[stat];
                const currentStatName = stat.substring(3).toLowerCase();
                if (player.hasOwnProperty(currentStatName)) {
                    player[currentStatName] = Math.min(player[currentStatName], player[stat]);
                }
            } else if (player.hasOwnProperty(stat)) {
                player[stat] += itemDef.stats[stat];
            }
        }
    }

    delete player.inventory[itemKey];

    return { success: true, message: `${itemName} équipé.` };
}

export function unequipItem(slot) {
    const player = gameState.player;
    const itemInstance = player.equipment[slot];
    if (!itemInstance) return { success: false, message: "Aucun objet dans cet emplacement." };
    
    const hasState = itemInstance.hasOwnProperty('currentDurability') || itemInstance.hasOwnProperty('currentUses');
    
    // Vérifier l'espace dans l'inventaire avant de déséquiper
    if (getTotalResources(player.inventory) >= player.maxInventory) {
        // Si l'inventaire est plein, on ne peut pas déséquiper un nouvel objet
        if (!player.inventory[itemInstance.name] || player.inventory[itemInstance.name] === 0) {
            return { success: false, message: "Inventaire plein." };
        }
        // Si c'est un objet avec état et qu'on n'a pas de pile de cet objet, on ne peut pas non plus
        if (hasState && !player.inventory[itemInstance.name]) {
             return { success: false, message: "Inventaire plein." };
        }
    }

    player.equipment[slot] = null;
    
    if (itemInstance.stats) {
        for (const stat in itemInstance.stats) {
            if (stat === 'maxInventory') {
                player.maxInventory -= itemInstance.stats[stat];
            } else if (stat.startsWith('max') && player.hasOwnProperty(stat)) {
                player[stat] -= itemInstance.stats[stat];
                const currentStatName = stat.substring(3).toLowerCase();
                if (player.hasOwnProperty(currentStatName)) {
                    player[currentStatName] = Math.min(player[currentStatName], player[stat]);
                }
            } else if (player.hasOwnProperty(stat)) {
                player[stat] -= itemInstance.stats[stat];
            }
        }
    }

    // Remettre l'objet dans l'inventaire en préservant son état
    addResourceToPlayer(itemInstance, 1);
    
    return { success: true, message: `${itemInstance.name} déséquipé.` };
}


export function addResourceToPlayer(resource, amount) {
    const player = gameState.player;
    const resourceName = typeof resource === 'string' ? resource : resource.name;

    if (typeof player.inventory !== 'object' || player.inventory === null) {
        console.error("L'inventaire du joueur n'est pas un objet valide. Réinitialisation.", player.inventory);
        player.inventory = {};
    }

    if (typeof resource === 'object') {
        const uniqueKey = `${resourceName}_${Date.now()}`;
        player.inventory[uniqueKey] = resource;
    } else {
        const currentAmount = player.inventory[resourceName] || 0;
        if (typeof currentAmount !== 'number') {
            console.warn(`Le type de ressource '${resourceName}' dans l'inventaire n'est pas un nombre, il sera écrasé.`, currentAmount);
            player.inventory[resourceName] = amount;
        } else {
            player.inventory[resourceName] = currentAmount + amount;
        }
    }
}

export function addBuildingToTile(x, y, buildingKey) {
    const tile = gameState.map[y][x];
    const buildingType = TILE_TYPES[buildingKey];
    if (!tile || !buildingType || !buildingType.isBuilding) return { success: false, message: "Type de bâtiment invalide ou tuile introuvable." };
    if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) return { success: false, message: "Nombre maximum de bâtiments atteint sur cette tuile." };

    if (!tile.type.buildable && buildingKey !== 'MINE' && buildingKey !== 'CAMPFIRE' && buildingKey !== 'PETIT_PUIT') {
        return { success: false, message: "Vous ne pouvez pas construire sur ce type de terrain." };
    }

    const buildingData = {
        key: buildingKey,
        durability: buildingType.durability,
        maxDurability: buildingType.durability
    };
    if (buildingType.maxHarvestsPerCycle) {
        buildingData.maxHarvestsPerCycle = buildingType.maxHarvestsPerCycle;
        buildingData.harvestsAvailable = buildingType.maxHarvestsPerCycle;
    }
    if (buildingKey === 'SHELTER_INDIVIDUAL' || buildingKey === 'SHELTER_COLLECTIVE') {
        buildingData.isLocked = false;
        buildingData.lockCode = null;
        if (!buildingType.inventory) buildingData.inventory = {};
        else buildingData.inventory = JSON.parse(JSON.stringify(buildingType.inventory));
    }

    tile.buildings.push(buildingData);

    if (buildingKey === 'SHELTER_COLLECTIVE') gameState.shelterLocation = { x, y };

    return { success: true, message: `${buildingType.name} construit.` };
}

export function dismantleBuildingOnTile(tileX, tileY, buildingIndex) {
    const tile = gameState.map[tileY][tileX];
    if (!tile || !tile.buildings[buildingIndex]) return { success: false, message: "Bâtiment introuvable." };

    const buildingInstance = tile.buildings[buildingIndex];
    const buildingDef = TILE_TYPES[buildingInstance.key];
    if (!buildingDef || !buildingDef.cost) return { success: false, message: "Définition du bâtiment ou coûts introuvables." };

    let recoveredResourcesMessage = "Ressources récupérées: ";
    let anythingRecovered = false;

    const costsToConsider = { ...buildingDef.cost };
    delete costsToConsider.toolRequired;

    for (const resourceName in costsToConsider) {
        const costAmount = costsToConsider[resourceName];
        const recoveredAmount = Math.floor(costAmount * 0.25);
        if (recoveredAmount > 0) {
            addResourceToPlayer(resourceName, recoveredAmount);
            recoveredResourcesMessage += `${recoveredAmount} ${resourceName}, `;
            anythingRecovered = true;
        }
    }
    if (!anythingRecovered) recoveredResourcesMessage = "Aucune ressource substantielle n'a pu être récupérée.";
    else recoveredResourcesMessage = recoveredResourcesMessage.slice(0, -2) + ".";


    tile.buildings.splice(buildingIndex, 1);
    if (buildingInstance.key === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
        const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
        gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
    }
    if (buildingDef.inventory || buildingDef.maxInventory) {
        const buildingInventory = buildingInstance.inventory;
        if (buildingInventory) {
            for (const item in buildingInventory) {
                if (buildingInventory[item] > 0) dropItemOnGround(item, buildingInventory[item]);
            }
        }
    }

    return { success: true, message: `${buildingDef.name} démantelé. ${recoveredResourcesMessage}` };
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
        if (buildingKeyDestroyed === 'SHELTER_COLLECTIVE' && gameState.shelterLocation && gameState.shelterLocation.x === tileX && gameState.shelterLocation.y === tileY) {
            const anotherShelter = gameState.map.flat().find(t => t.buildings.some(b => b.key === 'SHELTER_COLLECTIVE'));
            gameState.shelterLocation = anotherShelter ? { x: anotherShelter.x, y: anotherShelter.y } : null;
        }
        if (TILE_TYPES[buildingKeyDestroyed]?.inventory || TILE_TYPES[buildingKeyDestroyed]?.maxInventory) {
            const buildingInventory = building.inventory;
            if (buildingInventory) {
                for (const item in buildingInventory) {
                    if (buildingInventory[item] > 0) dropItemOnGround(item, buildingInventory[item]);
                }
            }
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

    if (newTerrainTypeKey === 'FOREST') {
        tile.type.buildable = false;
        tile.woodActionsLeft = newTerrainType.woodActionsLeft;
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'PLAINS') {
        tile.huntActionsLeft = newTerrainType.huntActionsLeft;
        tile.searchActionsLeft = newTerrainType.searchActionsLeft;
    } else if (newTerrainTypeKey === 'MINE_TERRAIN') {
        tile.harvestsLeft = newTerrainType.harvests;
    }
    if (newTerrainTypeKey === 'PLAGE') {
        tile.actionsLeft = { ...TILE_TYPES.PLAGE.actionsAvailable };
    } else {
        delete tile.actionsLeft;
    }
}

export function hasResources(costs) {
    const player = gameState.player;
    for (const resource in costs) {
        const playerAmount = player.inventory[resource] || 0;
        if (playerAmount < costs[resource]) return { success: false, missing: resource };
    }
    return { success: true };
}

export function applyResourceDeduction(costs) {
    const player = gameState.player;
    for (const resource in costs) {
        let needed = costs[resource];
        if (player.inventory[resource] > 0) {
            const takeFromPlayer = Math.min(needed, player.inventory[resource]);
            player.inventory[resource] -= takeFromPlayer;
            if (player.inventory[resource] <= 0) delete player.inventory[resource];
            needed -= takeFromPlayer;
        }
        if (needed > 0) console.warn(`[applyResourceDeduction] Manque de ${resource} après tentative de déduction de l'inventaire joueur.`);
    }
}

export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result = playerConsumeItemLogic(itemName, player);

    if (!result.success && !itemDef?.teachesRecipe && !(itemName === 'Carte' && itemDef?.uses) && !(itemName === 'Batterie chargée')) {
        return result;
    }

    if (itemName === 'Carte' && itemDef?.uses) {
        if (player.inventory[itemName] > 0) {
            const carteItem = ITEM_TYPES[itemName];
            if (!player.inventoryUses) player.inventoryUses = {};
            if (!player.inventoryUses[itemName]) player.inventoryUses[itemName] = carteItem.uses;

            player.inventoryUses[itemName]--;
            result.message = `Vous consultez la carte (${player.inventoryUses[itemName]} utilisations restantes).`;
            if (player.inventoryUses[itemName] <= 0) {
                delete player.inventory[itemName];
                delete player.inventoryUses[itemName];
                result.message = "La carte s'est désintégrée après sa dernière utilisation.";
            }
        }
        return { success: true, message: result.message, floatingTexts: result.floatingTexts || [] };
    }

    if (itemDef?.teachesRecipe) {
        if (gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.isBuildingRecipe) {
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            if (itemDef.unique) gameState.foundUniqueParchemins.add(itemName);
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
            if (player.inventory[itemName] > 0) {
                player.inventory[itemName]--;
                if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
            } else { return { success: false, message: "Erreur: Parchemin non trouvé pour apprendre la recette."}; }
        }
        result.success = true;
    } else if (itemDef?.effects?.custom) {
        if (itemDef.effects.custom === 'porteBonheur') { /* ... */ }
        else if (itemDef.effects.custom === 'breuvageEtrangeEffect') {
            if (player.inventory[itemName] > 0) {
                player.inventory[itemName]--;
                if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
            } else { return { success: false, message: "Vous n'avez plus de Breuvage étrange."}; }

            if (!result.floatingTexts) result.floatingTexts = [];

            const randEffect = Math.random() * 100;
            let cumulative = 0;

            const effects = [
                { chance: 6, action: () => { player.inventory = {}; result.message = "Breuvage étrange: Votre inventaire s'est volatilisé !"; result.floatingTexts.push({text:"Inventaire Vide!", type:'cost'}); }},
                { chance: 6, action: () => {
                    const toolAndWeaponSlots = ['weapon', 'shield'];
                    toolAndWeaponSlots.forEach(slot => { if(player.equipment[slot]) unequipItem(slot); });
                    for (const item in player.inventory) {
                        if (ITEM_TYPES[item]?.type === 'tool' || ITEM_TYPES[item]?.type === 'weapon') delete player.inventory[item];
                    }
                    result.message = "Breuvage étrange: Vos armes et outils ont disparu !"; result.floatingTexts.push({text:"Équipement perdu!", type:'cost'});
                }},
                { chance: 6, action: () => { player.health = 0; result.message = "Breuvage étrange: Vous sentez une douleur atroce et sombrez..."; result.floatingTexts.push({text:"Mort Subite!", type:'cost'}); }},
                { chance: 6, action: () => { player.hunger = Math.max(0, player.hunger - 5); player.sleep = Math.max(0, player.sleep - 5); result.message = "Breuvage étrange: Une vague de fatigue et de faim vous submerge."; result.floatingTexts.push({text:"-5 Faim, -5 Sommeil", type:'cost'}); }},
                { chance: 6, action: () => { player.health = Math.min(player.maxHealth, player.health + 10); player.hunger = Math.min(player.maxHunger, player.hunger + 10); player.thirst = Math.min(player.maxThirst, player.thirst + 10); player.sleep = Math.min(player.maxSleep, player.sleep + 10); result.message = "Breuvage étrange: Vous vous sentez incroyablement revigoré !"; result.floatingTexts.push({text:"+10 All Stats", type:'gain'}); }},
                { chance: 5, action: () => { const plan = getRandomPlanByRarity('offTable'); if(plan) { addResourceToPlayer(plan, 1); result.message = `Breuvage étrange: Une idée lumineuse ! (+1 ${plan})`; result.floatingTexts.push({text:`+1 ${plan}`, type:'gain'});} else result.message = "Breuvage étrange: Effet... étrange."; }},
                { chance: 6, action: () => { const plan = getRandomPlanByRarity('rare'); if(plan) { addResourceToPlayer(plan, 1); result.message = `Breuvage étrange: Une illumination ! (+1 ${plan})`; result.floatingTexts.push({text:`+1 ${plan}`, type:'gain'});} else result.message = "Breuvage étrange: Effet... étrange."; }},
                { chance: 6, action: () => { const plan = getRandomPlanByRarity('veryRare'); if(plan) { addResourceToPlayer(plan, 1); result.message = `Breuvage étrange: Une révélation ! (+1 ${plan})`; result.floatingTexts.push({text:`+1 ${plan}`, type:'gain'});} else result.message = "Breuvage étrange: Effet... étrange."; }},
                { chance: 6, action: () => { const plans = [getRandomPlanByRarity('common'), getRandomPlanByRarity('common')].filter(p=>p); plans.forEach(p => addResourceToPlayer(p,1)); result.message = `Breuvage étrange: Des bribes de savoir... (+${plans.length} plans communs)`; result.floatingTexts.push({text:`+${plans.length} Plans Communs`, type:'gain'}); }},
                { chance: 6, action: () => { const plans = [getRandomPlanByRarity('uncommon'), getRandomPlanByRarity('uncommon'), getRandomPlanByRarity('uncommon')].filter(p=>p); plans.forEach(p => addResourceToPlayer(p,1)); result.message = `Breuvage étrange: Des connaissances utiles... (+${plans.length} plans peu communs)`; result.floatingTexts.push({text:`+${plans.length} Plans Peu Communs`, type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Fiole anti-poison', 1); result.message = "Breuvage étrange: Vous trouvez un antidote !"; result.floatingTexts.push({text:"+1 Fiole Anti-Poison", type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Or', Math.floor(Math.random()*3)+1); result.message = "Breuvage étrange: De l'or !"; result.floatingTexts.push({text:"+ Or", type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Recette médicinale', 1); result.message = "Breuvage étrange: Une recette médicinale !"; result.floatingTexts.push({text:"+1 Recette Médicinale", type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Barre Énergétique', 3); result.message = "Breuvage étrange: Des barres énergétiques !"; result.floatingTexts.push({text:"+3 Barres Énergétiques", type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Kit de Secours', 1); result.message = "Breuvage étrange: Un kit de secours !"; result.floatingTexts.push({text:"+1 Kit de Secours", type:'gain'}); }},
                { chance: 5, action: () => { addResourceToPlayer('Porte bonheur', 1); result.message = "Breuvage étrange: Un porte-bonheur !"; result.floatingTexts.push({text:"+1 Porte Bonheur", type:'gain'}); }},
                { chance: 6, action: () => { addResourceToPlayer('Drogue', 1); result.message = "Breuvage étrange: Une drogue puissante !"; result.floatingTexts.push({text:"+1 Drogue", type:'gain'}); }},
            ];

            let effectTriggered = false;
            for (const effect of effects) {
                cumulative += effect.chance;
                if (randEffect < cumulative) {
                    effect.action();
                    effectTriggered = true;
                    break;
                }
            }
            if (!effectTriggered) {
                result.message = "Breuvage étrange: Rien ne se passe... pour l'instant.";
            }
            result.success = true;
            return result;
        }
        else if (itemDef.effects.custom === 'eauSaleeEffect') {
            if (player.status.includes('Malade')) {
            } else {
                if (Math.random() < 0.60) {
                    if (!player.status.includes('Malade')) {
                        player.status = player.status.filter(s => s !== 'normale');
                        player.status.push('Malade');
                    }
                    if (!result.floatingTexts) result.floatingTexts = [];
                    result.floatingTexts.push('Statut: Malade (Nouveau)');
                }
            }
        } else if (itemDef.effects.custom === 'eauCroupieEffect') {
            if (Math.random() < 0.80) {
                if (!player.status.includes('Malade')) {
                    player.status = player.status.filter(s => s !== 'normale');
                    player.status.push('Malade');
                }
                if (!result.floatingTexts) result.floatingTexts = [];
                result.floatingTexts.push('Statut: Malade (Nouveau)');
            }
        } else if (itemDef.effects.custom === 'drogueEffect') {
            if (!player.status.includes('Drogué')) {
                player.status = player.status.filter(s => s !== 'normale');
                player.status.push('Drogué');
            }
            if (!result.floatingTexts) result.floatingTexts = [];
            result.floatingTexts.push('Statut: Drogué (Nouveau)');
        } else if (itemDef.effects.custom === 'chargeDevice') {
            if (player.equipment.weapon) {
                const equippedWeaponName = player.equipment.weapon.name;
                let chargedItemName = null;
                if (equippedWeaponName === 'Radio déchargée') chargedItemName = 'Radio chargée';
                else if (equippedWeaponName === 'Téléphone déchargé') chargedItemName = 'Téléphone chargé';
                else if (equippedWeaponName === 'Guitare déchargé') chargedItemName = 'Guitare';

                if (chargedItemName) {
                    const unequipSuccess = unequipItem('weapon');
                    if (unequipSuccess.success) {
                        addResourceToPlayer(chargedItemName, 1);
                        const equipResult = equipItem(chargedItemName);

                        if (player.inventory['Batterie chargée'] > 0) {
                            player.inventory['Batterie chargée']--;
                            if (player.inventory['Batterie chargée'] <= 0) delete player.inventory['Batterie chargée'];
                        }
                        result.message = `${ITEM_TYPES[chargedItemName]?.name || chargedItemName} ${equipResult.success ? 'équipée' : 'obtenue'} !`;
                        result.success = true;
                    } else {
                        result.success = false;
                        result.message = "Impossible de déséquiper l'appareil actuel.";
                    }
                } else {
                    result.success = false;
                    result.message = "Vous devez équiper une radio ou un téléphone déchargé pour utiliser la batterie.";
                }
            } else {
                 result.success = false;
                 result.message = "Vous devez équiper un appareil pour le charger.";
            }
        }
        if (result.success && !result.message && itemDef.effects.custom) {
            result.message = `Vous utilisez: ${itemName}.`;
        }
    }
    return result;
}


export function dropItemOnGround(item, quantity) {
    const player = gameState.player;
    let itemKey = item;
    let itemName = typeof item === 'string' ? item : item.name;
    let itemToDrop = null;

    // Handle both string keys and object references
    if (typeof item === 'object') {
        itemKey = Object.keys(player.inventory).find(key => player.inventory[key] === item);
        if (!itemKey) {
            return { success: false, message: "Objet introuvable dans l'inventaire." };
        }
        itemToDrop = player.inventory[itemKey];
    } else {
        // For string keys, check if it's a stackable item or unique admin item
        if (player.inventory[itemKey] && typeof player.inventory[itemKey] === 'number') {
            // Stackable item
            itemToDrop = { name: itemKey };
        } else if (player.inventory[itemKey] && typeof player.inventory[itemKey] === 'object') {
            // Unique admin item
            itemToDrop = player.inventory[itemKey];
            itemName = itemToDrop.name;
        } else {
            return { success: false, message: "Quantité insuffisante dans l'inventaire." };
        }
    }

    const tile = gameState.map[player.y][player.x];
    if (!tile.groundItems) tile.groundItems = {};

    // Remove from inventory
    delete player.inventory[itemKey];

    // Add to ground items
    tile.groundItems[itemKey] = itemToDrop;

    return { success: true, message: `Vous avez déposé ${itemName} au sol.` };
}

export function pickUpItemFromGround(item, quantity) {
    const player = gameState.player;
    const tile = gameState.map[player.y][player.x];

    let itemKey = item;
     if (typeof item === 'string') {
        itemKey = Object.keys(tile.groundItems).find(key => key === item);
        if (!itemKey) {
            return { success: false, message: "Objet introuvable au sol." };
        }
    }

    if (!tile.groundItems || !tile.groundItems[itemKey]) {
        return { success: false, message: "Quantité insuffisante au sol." };
    }

    const itemToPickUp = tile.groundItems[itemKey];
    delete tile.groundItems[itemKey];

    addResourceToPlayer(itemToPickUp, 1);

    return { success: true, message: `Vous avez ramassé ${itemToPickUp.name}.` };
}

export function countItemTypeInInventory(itemTypeIdentifier) {
    let count = 0;
    for (const itemName in gameState.player.inventory) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef && itemDef.teachesRecipe && (itemTypeIdentifier === 'teachesRecipe' || itemDef.teachesRecipe === itemTypeIdentifier)) {
            count += gameState.player.inventory[itemName];
        } else if (itemDef && itemDef[itemTypeIdentifier]) {
             count += gameState.player.inventory[itemName];
        }
    }
    return count;
}

export function getRandomPlanByRarity(rarity) {
    const plansOfRarity = [];
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && itemDef.rarity === rarity && !gameState.knownRecipes[itemDef.teachesRecipe] && !itemDef.unique) {
            plansOfRarity.push(itemName);
        }
    }
    if (plansOfRarity.length === 0) {
         for (const itemName in ITEM_TYPES) {
            const itemDef = ITEM_TYPES[itemName];
            if (itemDef.teachesRecipe && itemDef.rarity === rarity && !gameState.knownRecipes[itemDef.teachesRecipe]) {
                 plansOfRarity.push(itemName);
            }
        }
    }
    return plansOfRarity.length > 0 ? plansOfRarity[Math.floor(Math.random() * plansOfRarity.length)] : null;
}
