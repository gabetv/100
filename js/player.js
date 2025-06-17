// js/player.js
import * as UI from './ui.js';
import { TILE_TYPES, CONFIG, ACTION_DURATIONS } from './config.js';

// --- Fonctions de base du joueur ---

/**
 * MODIFIÉ POUR LE DÉBOGAGE : Ajoute 400 de chaque ressource au départ.
 */
export function initPlayer(config) {
    return {
        x: Math.floor(config.MAP_WIDTH / 2) + 1,
        y: Math.floor(config.MAP_HEIGHT / 2),
        health: 100,
        thirst: 100,
        hunger: 100,
        sleep: 100,
        inventory: {
            // --- RESSOURCES DE DÉPART POUR LE TEST ---
            'Bois': 400,
            'Pierre': 400,
            'Poisson': 400,
            'Eau': 400,
            // -----------------------------------------
        },
        color: '#ffd700',
        isBusy: false,
        animationState: null,
    };
}

export function movePlayer(direction, player, map, config) {
    let newX = player.x, newY = player.y;
    switch (direction) {
        case 'north': newY--; break;
        case 'south': newY++; break;
        case 'west': newX--; break;
        case 'east': newX++; break;
        default: return false;
    }
    player.x = newX;
    player.y = newY;
    return true;
}

export function decayStats(player) {
    if (player.isBusy || player.animationState) return;
    player.thirst = Math.max(0, player.thirst - 2);
    player.hunger = Math.max(0, player.hunger - 1);
    player.sleep = Math.max(0, player.sleep - 0.5);
    if (player.thirst === 0 || player.hunger === 0) {
        UI.addChatMessage("Votre santé se dégrade !", "system");
        player.health = Math.max(0, player.health - 5);
    }
}


// --- Fonctions Utilitaires Internes ---

function playerHasResources(player, costs, silent = false) {
    for (const resource in costs) {
        if (!player.inventory[resource] || player.inventory[resource] < costs[resource]) {
            if (!silent) UI.addChatMessage(`Ressources insuffisantes: Il vous manque du ${resource}.`, "system");
            return false;
        }
    }
    return true;
}

function deductResources(player, costs) {
    for (const resource in costs) {
        player.inventory[resource] -= costs[resource];
        UI.showFloatingText(`-${costs[resource]} ${resource}`, 'cost');
    }
    UI.triggerActionFlash('cost');
}

function createActionButton(text, onClick, disabled = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.disabled = disabled;
    button.onclick = onClick;
    UI.actionsEl.appendChild(button);
}

// --- Système Central d'Actions Temporisées ---

function performTimedAction(gameState, duration, onStart, onComplete) {
    if (gameState.player.isBusy || gameState.player.animationState) return;
    gameState.player.isBusy = true;
    if (onStart) onStart();
    updatePossibleActions(gameState);
    UI.updateAllButtonsState(gameState);
    setTimeout(() => {
        if (onComplete) onComplete();
        gameState.player.isBusy = false;
        UI.updateAllUI(gameState, CONFIG);
        updatePossibleActions(gameState);
        UI.updateAllButtonsState(gameState);
    }, duration);
}


// --- Fonctions d'Action Principales ---

export function updatePossibleActions(gameState) {
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    UI.actionsEl.innerHTML = '';
    
    if (player.isBusy || player.animationState) {
        const busyAction = document.createElement('div');
        busyAction.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        busyAction.style.textAlign = 'center';
        busyAction.style.padding = '12px';
        UI.actionsEl.appendChild(busyAction);
        return;
    }

    if (tile.type.resource && tile.harvestsLeft > 0) {
        const { type, yield: y } = tile.type.resource;
        let actionText = `Récolter ${type}`;
        if (type === 'Eau') actionText = `Puiser`; else if (type === 'Poisson') actionText = `Pêcher`;
        else if (type === 'Pierre') actionText = `Miner`; else if (type === 'Bois') actionText = `Couper du bois`;
        createActionButton(actionText, () => {
            performTimedAction(gameState, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`${actionText}...`, 'system'),
                () => {
                    player.inventory[type] = (player.inventory[type] || 0) + y;
                    tile.harvestsLeft--;
                    UI.showFloatingText(`+${y} ${type}`, 'gain');
                    UI.triggerActionFlash('gain');
                    if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                        tile.type = TILE_TYPES.WASTELAND;
                        const newBgs = TILE_TYPES.WASTELAND.background;
                        tile.backgroundKey = newBgs[Math.floor(Math.random() * newBgs.length)];
                        UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                    }
                }
            );
        });
    }

    switch (tile.type) {
        case TILE_TYPES.PLAINS: case TILE_TYPES.WASTELAND:
            createActionButton("Abri (-20B, -10P)", () => { if (playerHasResources(player, { 'Bois': 20, 'Pierre': 10 })) { performTimedAction(gameState, ACTION_DURATIONS.CRAFT, () => UI.addChatMessage("Construction d'un abri...", 'system'), () => { deductResources(player, { 'Bois': 20, 'Pierre': 10 }); tile.type = TILE_TYPES.SHELTER_INDIVIDUAL; }); } }, !playerHasResources(player, { 'Bois': 20, 'Pierre': 10 }, true));
            createActionButton("Feu (-10B, -5P)", () => { if (playerHasResources(player, { 'Bois': 10, 'Pierre': 5 })) { performTimedAction(gameState, ACTION_DURATIONS.CRAFT, () => UI.addChatMessage("Préparation d'un feu de camp...", 'system'), () => { deductResources(player, { 'Bois': 10, 'Pierre': 5 }); tile.type = TILE_TYPES.CAMPFIRE; }); } }, !playerHasResources(player, { 'Bois': 10, 'Pierre': 5 }, true));
            break;
        case TILE_TYPES.CAMPFIRE:
            createActionButton("Cuisiner (-1P, -1B)", () => { if (playerHasResources(player, { 'Poisson': 1, 'Bois': 1 })) { performTimedAction(gameState, ACTION_DURATIONS.CRAFT, () => UI.addChatMessage("Cuisson du poisson...", 'system'), () => { deductResources(player, { 'Poisson': 1, 'Bois': 1 }); player.inventory['Poisson Cuit'] = (player.inventory['Poisson Cuit'] || 0) + 1; UI.showFloatingText("+1 Poisson Cuit", 'gain'); }); } }, !playerHasResources(player, { 'Poisson': 1, 'Bois': 1 }, true));
            break;
        case TILE_TYPES.SHELTER_COLLECTIVE: case TILE_TYPES.SHELTER_INDIVIDUAL:
            createActionButton("Dormir", () => sleep(gameState));
            break;
    }
}

export function sleep(gameState) {
    performTimedAction(gameState, ACTION_DURATIONS.SLEEP,
        () => UI.addChatMessage("Vous vous endormez...", "system"),
        () => {
            gameState.player.sleep = Math.min(100, gameState.player.sleep + 50);
            gameState.player.health = Math.min(100, gameState.player.health + 10);
            UI.addChatMessage("Vous vous réveillez reposé.", "system");
        }
    );
}

export function consumeItem(itemName, player, gameState, config) {
    if (player.isBusy || player.animationState || !player.inventory[itemName] || player.inventory[itemName] <= 0) return;
    
    let consumed = true;
    switch (itemName) {
        case 'Eau':
            player.thirst = Math.min(100, player.thirst + 30);
            UI.showFloatingText("+30 Soif", 'gain');
            UI.triggerActionFlash('gain');
            break;
        case 'Poisson':
            player.hunger = Math.min(100, player.hunger + 15);
            player.health = Math.max(0, player.health - 5);
            UI.addChatMessage("Manger du poisson cru n'est pas une bonne idée... (-5 santé)", 'system');
            UI.showFloatingText("+15 Faim", 'gain');
            UI.showFloatingText("-5 Santé", 'cost');
            UI.triggerActionFlash('gain');
            break;
        case 'Poisson Cuit':
            player.hunger = Math.min(100, player.hunger + 40);
            UI.showFloatingText("+40 Faim", 'gain');
            UI.triggerActionFlash('gain');
            break;
        default:
            consumed = false;
            UI.addChatMessage("Vous ne pouvez pas consommer cet objet.", "system");
            break;
    }

    if (consumed) {
        player.inventory[itemName]--;
        if (player.inventory[itemName] <= 0) {
            delete player.inventory[itemName];
        }
        UI.updateAllUI(gameState, CONFIG);
        updatePossibleActions(gameState);
        UI.updateAllButtonsState(gameState);
    }
}