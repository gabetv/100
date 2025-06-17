// js/state.js
import { generateMap } from './map.js';
// CORRECTION ICI : 'transferItem' a été retiré de la liste d'importation.
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItem, transferItems } from './player.js';
import { initNpcs } from './npc.js';
import { TILE_TYPES, CONFIG } from './config.js';

const gameState = {
    map: [],
    player: null,
    npcs: [],
    day: 1,
    gameIntervals: [],
    activeEvent: { type: 'none', duration: 0, data: null },
    shelterLocation: null,
    isGameOver: false,
};

export const state = gameState;

export function initializeGameState(config) {
    gameState.map = generateMap(config);
    gameState.player = initPlayer(config);
    gameState.npcs = initNpcs(config, gameState.map);
    
    const shelterTile = gameState.map.flat().find(tile => tile.type.name === TILE_TYPES.SHELTER_COLLECTIVE.name);
    if (shelterTile) {
        gameState.shelterLocation = { x: shelterTile.x, y: shelterTile.y }; 
    } else {
        console.error("Aucun abri collectif n'a été généré sur la carte.");
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

    let from, to, toCapacity, success;

    if (transferType === 'deposit') {
        from = player.inventory;
        to = tile.inventory;
        success = transferItems(itemName, amount, from, to);
        if (success) return { success: true, message: `Vous avez déposé ${amount} ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Quantité invalide ?" };
    } 
    
    if (transferType === 'withdraw') {
        from = tile.inventory;
        to = player.inventory;
        toCapacity = CONFIG.PLAYER_MAX_RESOURCES;
        success = transferItems(itemName, amount, from, to, toCapacity);
        if (success) return { success: true, message: `Vous avez pris ${amount} ${itemName}.` };
        return { success: false, message: "Le retrait a échoué. Inventaire plein ou stock insuffisant ?" };
    }

    return { success: false, message: "Type de transfert inconnu." };
}

export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

export function updateTileType(x, y, newType) {
    const tile = gameState.map[y][x];
    tile.type = newType;
    if (newType.background && newType.background.length > 0) {
        // Pour éviter une erreur si une nouvelle tuile n'a pas de fond défini
        tile.backgroundKey = newType.background[Math.floor(Math.random() * newType.background.length)];
    }
    // S'assurer que les propriétés de la nouvelle tuile sont bien appliquées
    tile.harvestsLeft = newType.harvests === Infinity ? Infinity : (newType.harvests || 0);
    tile.resources = newType.resource ? { ...newType.resource } : null;
}

export function consumeItem(itemOrNeed) {
    return playerConsumeItem(itemOrNeed, gameState.player);
}

export function hasResources(costs) {
    return playerHasResources(gameState.player, costs);
}

export function applyResourceDeduction(costs) {
    deductResources(gameState.player, costs);
}