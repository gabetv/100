// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItem, transferItems } from './player.js';
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
};

export const state = gameState;

export function initializeGameState(config) {
    gameState.map = generateMap(config);
    gameState.player = initPlayer(config);
    gameState.npcs = initNpcs(config, gameState.map);
    gameState.enemies = initEnemies(config, gameState.map);
    
    // Shelter location will now be set when player builds a collective shelter,
    // or if one is found/pre-placed through other means in the future.
    // For now, it starts as null. NPCs will adapt.
    gameState.shelterLocation = null; 
    
    // Example: Find if a collective shelter already exists (e.g. from a scenario or older map gen)
    const existingShelterTile = gameState.map.flat().find(tile => tile.type.name === TILE_TYPES.SHELTER_COLLECTIVE.name);
    if (existingShelterTile) {
        gameState.shelterLocation = { x: existingShelterTile.x, y: existingShelterTile.y };
    }
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

    if (!tile.inventory) {
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }

    let from, to, success;

    if (transferType === 'deposit') {
        from = player.inventory;
        to = tile.inventory;
        // Get capacity from tile's type definition in config
        const tileMaxInv = tile.type.maxInventory;
        const effectiveToCapacity = tileMaxInv !== undefined ? tileMaxInv : Infinity;
        success = transferItems(itemName, amount, from, to, effectiveToCapacity);
        if (success) return { success: true, message: `Vous avez déposé ${amount} ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Quantité invalide ou stockage plein ?" };
    } 
    
    if (transferType === 'withdraw') {
        from = tile.inventory;
        to = player.inventory; 
        const toCapacity = player.maxInventory; // Capacity of player's inventory
        success = transferItems(itemName, amount, from, to, toCapacity);
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
    if(newEquip.durability) newEquip.currentDurability = newEquip.durability;
    player.equipment[slot] = newEquip;

    if (itemDef.stats) {
        for (const stat in itemDef.stats) {
            if (player.hasOwnProperty(stat)) {
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
            if (player.hasOwnProperty(stat)) {
                player[stat] -= item.stats[stat];
                const currentStat = stat.replace('max', '').toLowerCase();
                if(player.hasOwnProperty(currentStat)) {
                    player[currentStat] = Math.min(player[currentStat], player[stat]);
                }
            }
        }
    }
    
    return { success: true, message: `${item.name} déséquipé.` };
}

export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

export function updateTileType(x, y, newType) {
    const tile = gameState.map[y][x];
    tile.type = newType;
    if (newType.background && newType.background.length > 0) {
        tile.backgroundKey = newType.background[Math.floor(Math.random() * newType.background.length)];
    }
    tile.harvestsLeft = (newType.harvests === Infinity) ? Infinity : (newType.harvests || 0);
    tile.resources = newType.resource ? { ...newType.resource } : null;
    
    // Initialize inventory for structures that have it (e.g. shelters)
    if (newType.inventory && tile.inventory === undefined) {
        tile.inventory = JSON.parse(JSON.stringify(newType.inventory)); // Create a fresh inventory object
    } else if (!newType.inventory && tile.inventory !== undefined) {
        delete tile.inventory; // Remove inventory if the new tile type doesn't have one
    }
    // isOpened for treasure chests
    if (newType.name === TILE_TYPES.TREASURE_CHEST.name) tile.isOpened = false;
    else if (tile.hasOwnProperty('isOpened')) delete tile.isOpened;

    // If a collective shelter is built, update the global shelterLocation
    if (newType.name === TILE_TYPES.SHELTER_COLLECTIVE.name) {
        gameState.shelterLocation = { x, y };
        console.log("Collective shelter built. Global shelterLocation updated to:", gameState.shelterLocation);
    }
}

export function consumeItem(itemName) {
    return playerConsumeItem(itemName, gameState.player);
}

export function hasResources(costs) {
    return playerHasResources(gameState.player, costs);
}

export function applyResourceDeduction(costs) {
    deductResources(gameState.player, costs);
}