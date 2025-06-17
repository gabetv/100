// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItem, transferItem } from './player.js';
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
    console.log("Game state initialized:", gameState);
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

export function applyInventoryTransfer(itemName, transferType) {
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;

    if (!tile.inventory) {
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }

    if (transferType === 'deposit') {
        const success = transferItem(itemName, player.inventory, tile.inventory);
        if (success) return { success: true, message: `Vous avez déposé 1 ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Avez-vous cet objet ?" };
    } 
    
    if (transferType === 'withdraw') {
        const totalPlayerResources = getTotalResources(player.inventory);
        if (totalPlayerResources >= CONFIG.PLAYER_MAX_RESOURCES) {
             return { success: false, message: "Votre inventaire est plein." };
        }

        const success = transferItem(itemName, tile.inventory, player.inventory, CONFIG.PLAYER_MAX_RESOURCES);
        if (success) return { success: true, message: `Vous avez pris 1 ${itemName}.` };
        
        return { success: false, message: "Le retrait a échoué. Le stock est vide ?" };
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
        tile.backgroundKey = newType.background[Math.floor(Math.random() * newType.background.length)];
    }
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