// js/player.js
import * as UI from './ui.js';
import { TILE_TYPES, CONFIG, ACTION_DURATIONS } from './config.js';

// --- Fonctions de base du joueur (initialisation, déplacement, dégradation des stats) ---

export function initPlayer(config) {
    return {
        x: Math.floor(config.MAP_WIDTH / 2) + 1,
        y: Math.floor(config.MAP_HEIGHT / 2),
        health: 100,
        thirst: 100,
        hunger: 100,
        sleep: 100,
        inventory: {},
        color: '#ffd700',
        isBusy: false
    };
}

export function movePlayer(direction, player, map, config) {
    if (player.isBusy) return false;
    let newX = player.x, newY = player.y;
    switch (direction) {
        case 'north': newY--; break;
        case 'south': newY++; break;
        case 'west': newX--; break;
        case 'east': newX++; break;
        default: return false;
    }
    if (newX >= 0 && newX < config.MAP_WIDTH && newY >= 0 && newY < config.MAP_HEIGHT && map[newY][newX].type.accessible) {
        player.x = newX;
        player.y = newY;
        return true;
    }
    return false;
}

export function decayStats(player) {
    if (player.isBusy) return;
    player.thirst = Math.max(0, player.thirst - 2);
    player.hunger = Math.max(0, player.hunger - 1);
    player.sleep = Math.max(0, player.sleep - 0.5);
    if (player.thirst === 0 || player.hunger === 0) {
        UI.addChatMessage("Votre santé se dégrade !", "system");
        player.health = Math.max(0, player.health - 5);
    }
}


// --- Fonctions Utilitaires Internes ---

// Vérifie si le joueur a les ressources nécessaires
function playerHasResources(player, costs, silent = false) {
    for (const resource in costs) {
        if (!player.inventory[resource] || player.inventory[resource] < costs[resource]) {
            if (!silent) {
                UI.addChatMessage(`Ressources insuffisantes: Il vous manque du ${resource}.`, "system");
            }
            return false;
        }
    }
    return true;
}

// Déduit les ressources de l'inventaire du joueur
function deductResources(player, costs) {
    for (const resource in costs) {
        player.inventory[resource] -= costs[resource];
        UI.showFloatingText(`-${costs[resource]} ${resource}`, 'cost');
    }
    UI.triggerActionFlash('cost');
}

// Crée un bouton d'action dans l'interface
function createActionButton(text, onClick, disabled = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.disabled = disabled;
    button.onclick = onClick;
    UI.actionsEl.appendChild(button);
}

// --- Système Central d'Actions Temporisées ---

/**
 * Gestionnaire central pour toutes les actions temporisées.
 * @param {object} gameState - L'état du jeu.
 * @param {number} duration - La durée de l'action en ms.
 * @param {function} onStart - (Optionnel) Ce qui se passe au début.
 * @param {function} onComplete - Ce qui se passe à la fin.
 */
function performTimedAction(gameState, duration, onStart, onComplete) {
    if (gameState.player.isBusy) return;

    gameState.player.isBusy = true;
    if (onStart) onStart();
    
    // Met à jour la liste des actions (pour afficher "Action en cours...")
    // et l'état des boutons (pour tout griser).
    updatePossibleActions(gameState);
    UI.updateAllButtonsState(gameState);

    setTimeout(() => {
        if (onComplete) onComplete();
        gameState.player.isBusy = false;
        
        // Met à jour les stats/minimap, PUIS la liste des actions, PUIS l'état des boutons.
        UI.updateAllUI(gameState, CONFIG);
        updatePossibleActions(gameState);
        UI.updateAllButtonsState(gameState);
    }, duration);
}


// --- Fonctions d'Action Principales (Exportées ou utilisées par refreshUI) ---

export function updatePossibleActions(gameState) {
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    UI.actionsEl.innerHTML = '';
    
    if (player.isBusy) {
        const busyAction = document.createElement('div');
        busyAction.textContent = "Action en cours...";
        busyAction.style.textAlign = 'center';
        busyAction.style.padding = '12px';
        UI.actionsEl.appendChild(busyAction);
        return;
    }

    // Action de récolte
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

    // Actions de construction et autres
    switch (tile.type) {
        case TILE_TYPES.PLAINS: case TILE_TYPES.WASTELAND:
            createActionButton("Abri (-20B, -10P)", () => {
                if (playerHasResources(player, { 'Bois': 20, 'Pierre': 10 })) {
                    performTimedAction(gameState, ACTION_DURATIONS.CRAFT,
                        () => UI.addChatMessage("Construction d'un abri...", 'system'),
                        () => {
                            deductResources(player, { 'Bois': 20, 'Pierre': 10 });
                            tile.type = TILE_TYPES.SHELTER_INDIVIDUAL;
                        }
                    );
                }
            }, !playerHasResources(player, { 'Bois': 20, 'Pierre': 10 }, true));
            
            createActionButton("Feu (-10B, -5P)", () => {
                if (playerHasResources(player, { 'Bois': 10, 'Pierre': 5 })) {
                    performTimedAction(gameState, ACTION_DURATIONS.CRAFT,
                        () => UI.addChatMessage("Préparation d'un feu de camp...", 'system'),
                        () => {
                            deductResources(player, { 'Bois': 10, 'Pierre': 5 });
                            tile.type = TILE_TYPES.CAMPFIRE;
                        }
                    );
                }
            }, !playerHasResources(player, { 'Bois': 10, 'Pierre': 5 }, true));
            break;
            
        case TILE_TYPES.CAMPFIRE:
            createActionButton("Cuisiner (-1P, -1B)", () => {
                if (playerHasResources(player, { 'Poisson': 1, 'Bois': 1 })) {
                    performTimedAction(gameState, ACTION_DURATIONS.CRAFT,
                        () => UI.addChatMessage("Cuisson du poisson...", 'system'),
                        () => {
                            deductResources(player, { 'Poisson': 1, 'Bois': 1 });
                            player.inventory['Poisson Cuit'] = (player.inventory['Poisson Cuit'] || 0) + 1;
                            UI.showFloatingText("+1 Poisson Cuit", 'gain');
                        }
                    );
                }
            }, !playerHasResources(player, { 'Poisson': 1, 'Bois': 1 }, true));
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
    if (player.isBusy || !player.inventory[itemName] || player.inventory[itemName] <= 0) return;
    
    let consumed = true;
    switch (itemName) {
        case 'Eau':
            player.thirst = Math.min(100, player.thirst + 30);
            UI.showFloatingText("+30 Soif", 'gain');
            break;
        case 'Poisson':
            player.hunger = Math.min(100, player.hunger + 15);
            player.health = Math.max(0, player.health - 5);
            UI.addChatMessage("Manger du poisson cru n'est pas une bonne idée...", 'system');
            UI.showFloatingText("+15 Faim", 'gain');
            UI.showFloatingText("-5 Santé", 'cost');
            break;
        case 'Poisson Cuit':
            player.hunger = Math.min(100, player.hunger + 40);
            UI.showFloatingText("+40 Faim", 'gain');
            break;
        default:
            consumed = false;
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