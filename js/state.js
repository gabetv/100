// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItemLogic, transferItems } from './player.js';
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
    config: null, // Sera initialisé avec CONFIG
    knownRecipes: {
        'Planche': true, // Exemple de recette de base
        // D'autres recettes initiales pourraient être ajoutées ici
    },
};

// Exporte l'objet gameState lui-même pour un accès direct
export const state = gameState;

// Exporte la fonction initializeGameState
export function initializeGameState(config) {
    console.log("State.initializeGameState appelée avec config:", config); // Log pour débogage
    gameState.config = config; // S'assurer que gameState.config est défini tôt
    gameState.map = generateMap(config);
    gameState.player = initPlayer(config);
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
    if (newEquip.durability) newEquip.currentDurability = newEquip.durability;
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


export function consumeItem(itemName) {
    const player = gameState.player;
    const itemDef = ITEM_TYPES[itemName];
    let result;

    // Appel à la logique de base de consommation (décrémenter item, appliquer effets numériques)
    result = playerConsumeItemLogic(itemName, player); // Utilise la fonction renommée

    // Si la consommation de base a échoué (ex: objet non consommable, pas en inventaire), retourner l'erreur
    if (!result.success && !itemDef?.teachesRecipe) { // Sauf si c'est un parchemin (qui sera géré après)
        return result;
    }


    // Logique spécifique après la consommation de base ou si c'est un parchemin
    if (itemDef?.teachesRecipe) {
        if (!player.inventory[itemName] || player.inventory[itemName] <= 0) { // Vérifier si on a bien l'item avant de l'apprendre
            return { success: false, message: "Vous n'avez plus ce parchemin." };
        }
        if (gameState.knownRecipes[itemDef.teachesRecipe]) {
            // Optionnel: consommer quand même et juste afficher un message, ou ne pas consommer.
            // Si on consomme quand même :
            player.inventory[itemName]--;
            if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
            result.message = `Vous relisez le parchemin de ${itemDef.teachesRecipe}. Vous connaissez déjà cette recette.`;
            result.success = true; // Assurer que le résultat est un succès même si la recette est connue
        } else {
            gameState.knownRecipes[itemDef.teachesRecipe] = true;
            player.inventory[itemName]--; // Consommer le parchemin
            if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
            result.message = `Vous avez appris la recette : ${itemDef.teachesRecipe} !`;
            result.success = true;
        }
    } else if (itemDef?.effects?.custom) {
        // Gérer les effets custom ici
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
                player.health = Math.max(0, player.health - 1);
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
        // Assurer le succès si on est arrivé ici avec un effet custom
        result.success = true;
        if (!result.message) result.message = `Vous utilisez: ${itemName}.`; // Message par défaut si pas déjà défini
    }

    return result;
}

export function hasResources(costs) {
    return playerHasResources(gameState.player, costs);
}

export function applyResourceDeduction(costs) {
    deductResources(gameState.player, costs);
}