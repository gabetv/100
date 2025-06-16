// js/player.js
import * as UI from './ui.js';
import { TILE_TYPES } from './config.js';

export function initPlayer(config) { return { x: Math.floor(config.MAP_WIDTH / 2) + 1, y: Math.floor(config.MAP_HEIGHT / 2), health: 100, thirst: 100, hunger: 100, sleep: 100, inventory: {}, color: '#ffd700', isBusy: false }; }
export function movePlayer(direction, player, map, config) { if(player.isBusy) return false; let newX = player.x, newY = player.y; switch (direction) { case 'north': newY--; break; case 'south': newY++; break; case 'west': newX--; break; case 'east': newX++; break; default: return false; } if (newX >= 0 && newX < config.MAP_WIDTH && newY >= 0 && newY < config.MAP_HEIGHT && map[newY][newX].type.accessible) { player.x = newX; player.y = newY; return true; } return false; }
export function decayStats(player) { if(player.isBusy) return; player.thirst = Math.max(0, player.thirst - 2); player.hunger = Math.max(0, player.hunger - 1); player.sleep = Math.max(0, player.sleep - 0.5); if (player.thirst === 0 || player.hunger === 0) { UI.addChatMessage("Votre santé se dégrade !", "system"); player.health = Math.max(0, player.health - 5); } }

/**
 * NOUVELLE VERSION : Met à jour les actions possibles en fonction de la case du joueur.
 */
export function updatePossibleActions(gameState) {
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    UI.actionsEl.innerHTML = '';
    
    if (player.isBusy) return;

    // Logique similaire à l'ancienne `handleInteraction`
    switch (tile.type) {
        case TILE_TYPES.FOREST: if (tile.harvestsLeft > 0) createActionButton("Récolter du bois", () => { player.inventory['Bois'] = (player.inventory['Bois'] || 0) + tile.resources.yield; tile.harvestsLeft--; if (tile.harvestsLeft <= 0) tile.type = TILE_TYPES.WASTELAND; updatePossibleActions(gameState); UI.updateAllUI(gameState, CONFIG); }); break;
        case TILE_TYPES.WASTELAND: case TILE_TYPES.PLAINS: createActionButton("Abri Individuel (-20 Bois)", () => { if (playerHasResources(player, { 'Bois': 20 })) { deductResources(player, { 'Bois': 20 }); tile.type = TILE_TYPES.SHELTER_INDIVIDUAL; updatePossibleActions(gameState); } }); break;
        case TILE_TYPES.SHELTER_COLLECTIVE: createActionButton("Dormir (10h)", () => sleep(player, 3, 5, gameState)); createActionButton("Cuisiner Poisson (-1 Poisson, -1 Bois)", () => { if (playerHasResources(player, { 'Poisson': 1, 'Bois': 1 })) { deductResources(player, { 'Poisson': 1, 'Bois': 1 }); player.inventory['Poisson Cuit'] = (player.inventory['Poisson Cuit'] || 0) + 1; UI.updateAllUI(gameState, CONFIG); } }); break;
        // ... ajoutez d'autres actions ici
    }
}

export function consumeItem(itemName, player, gameState, config) { /* ... */ } // Le corps de cette fonction est ajouté ci-dessous
function createActionButton(text, onClick) { const button = document.createElement('button'); button.textContent = text; button.onclick = onClick; UI.actionsEl.appendChild(button); }
function playerHasResources(player, costs) { for (const resource in costs) { if (!player.inventory[resource] || player.inventory[resource] < costs[resource]) { UI.addChatMessage(`Ressources insuffisantes: ${resource}.`, "system"); return false; } } return true; }
function deductResources(player, costs) { for (const resource in costs) player.inventory[resource] -= costs[resource]; }
function sleep(player, sleepGain, healthGain, gameState) { player.isBusy = true; UI.addChatMessage("Vous vous endormez...", "system"); setTimeout(() => { player.sleep = Math.min(100, player.sleep + sleepGain); player.health = Math.min(100, player.health + healthGain); player.isBusy = false; UI.addChatMessage("Vous vous réveillez reposé.", "system"); updatePossibleActions(gameState); UI.updateAllUI(gameState, CONFIG); }, 3000); }
// Corps complet de consumeItem
consumeItem = function(itemName, player, gameState, config) { if (!player.inventory[itemName] || player.inventory[itemName] <= 0) return; let consumed = true; switch (itemName) { case 'Eau': player.thirst = Math.min(100, player.thirst + 30); break; case 'Poisson Cuit': player.hunger = Math.min(100, player.hunger + 40); break; default: consumed = false; break; } if (consumed) { player.inventory[itemName]--; if (player.inventory[itemName] <= 0) delete player.inventory[itemName]; UI.updateAllUI(gameState, config); } }