// js/state.js
import { generateMap } from './map.js';
import { initPlayer, getTotalResources, hasResources as playerHasResources, deductResources, consumeItem as playerConsumeItem, transferItem } from './player.js';
import { initNpcs } from './npc.js';
import { TILE_TYPES, CONFIG } from './config.js'; // Assurez-vous d'importer CONFIG ici

// La source unique de vérité pour l'état du jeu.
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

// Exporter l'état pour que les autres modules puissent le lire (mais pas le modifier)
export const state = gameState;

/**
 * Initialise l'ensemble de l'état du jeu au démarrage.
 */
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

// --- Fonctions de modification de l'état (Mutations) ---

/**
 * Applique le déplacement du joueur à l'état.
 * @param {string} direction - 'north', 'south', 'east', 'west'.
 */
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

/**
 * Tente d'effectuer un transfert d'inventaire et met à jour l'état si réussi.
 * C'EST LA FONCTION CLÉ POUR CORRIGER LE BUG.
 * @param {string} itemName - L'objet à transférer.
 * @param {'deposit' | 'withdraw'} transferType - Le sens du transfert.
 * @returns {{success: boolean, message: string}} - Le résultat de l'opération.
 */
export function applyInventoryTransfer(itemName, transferType) {
    console.log(`%cSTATE: Tentative de transfert. Objet: ${itemName}, Type: ${transferType}`, "color: lightgreen;");
    const tile = gameState.map[gameState.player.y][gameState.player.x];
    const player = gameState.player;

    if (!tile.inventory) {
        console.error("STATE ERROR: La tuile n'a pas d'inventaire.", tile);
        return { success: false, message: "Ce lieu n'a pas de stockage." };
    }

    let success = false;
    if (transferType === 'deposit') {
        console.log("STATE: Dépôt. Joueur inv:", JSON.parse(JSON.stringify(player.inventory)), "Tuile inv:", JSON.parse(JSON.stringify(tile.inventory)));
        // Le joueur dépose un objet dans le stockage de la tuile.
        success = transferItem(itemName, player.inventory, tile.inventory);
        if (success) return { success: true, message: `Vous avez déposé 1 ${itemName}.` };
        return { success: false, message: "Le dépôt a échoué. Avez-vous cet objet ?" };
    } 
    
    if (transferType === 'withdraw') {
        console.log("STATE: Retrait. Joueur inv:", JSON.parse(JSON.stringify(player.inventory)), "Tuile inv:", JSON.parse(JSON.stringify(tile.inventory)));
        const playerCapacity = CONFIG.PLAYER_MAX_RESOURCES; // CORRECTION DE L'ERREUR ICI
        const totalPlayerResources = getTotalResources(player.inventory);
        
        if (totalPlayerResources >= playerCapacity) {
             console.log(`STATE ERROR: Inventaire joueur plein. (${totalPlayerResources}/${playerCapacity})`);
             return { success: false, message: "Votre inventaire est plein." };
        }

        // Le joueur retire un objet du stockage de la tuile.
        success = transferItem(itemName, tile.inventory, player.inventory);
        if (success) return { success: true, message: `Vous avez pris 1 ${itemName}.` };
        
        return { success: false, message: "Le retrait a échoué. Le stock est vide ?" };
    }

    return { success: false, message: "Type de transfert inconnu." };
}


/**
 * Ajoute des ressources à l'inventaire du joueur.
 * @param {string} resourceType - Le type de ressource.
 * @param {number} amount - La quantité à ajouter.
 */
export function addResourceToPlayer(resourceType, amount) {
    const player = gameState.player;
    player.inventory[resourceType] = (player.inventory[resourceType] || 0) + amount;
}

/**
 * Change le type d'une tuile sur la carte.
 * @param {number} x - Coordonnée X de la tuile.
 * @param {number} y - Coordonnée Y de la tuile.
 * @param {object} newType - Le nouveau TILE_TYPE.
 */
export function updateTileType(x, y, newType) {
    const tile = gameState.map[y][x];
    tile.type = newType;
    tile.backgroundKey = newType.background[Math.floor(Math.random() * newType.background.length)];
}

/**
 * Gère la consommation d'un objet par le joueur.
 * @param {string} itemOrNeed - Le besoin à combler ou l'objet à consommer.
 * @returns {object} Le résultat de l'action de consommation.
 */
export function consumeItem(itemOrNeed) {
    return playerConsumeItem(itemOrNeed, gameState.player);
}

/**
 * Vérifie si le joueur possède les ressources requises.
 * @param {object} costs - Un objet des coûts { 'Bois': 10, ... }.
 * @returns {{success: boolean, missing: string|null}}
 */
export function hasResources(costs) {
    return playerHasResources(gameState.player, costs);
}

/**
 * Déduit les ressources de l'inventaire du joueur.
 * @param {object} costs - Un objet des coûts à déduire.
 */
export function applyResourceDeduction(costs) {
    deductResources(gameState.player, costs);
}