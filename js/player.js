// js/player.js
import * as UI from './ui.js';
import { TILE_TYPES, CONFIG } from './config.js';

export function initPlayer(config) { return { x: Math.floor(config.MAP_WIDTH / 2) + 1, y: Math.floor(config.MAP_HEIGHT / 2), health: 100, thirst: 100, hunger: 100, sleep: 100, inventory: {}, color: '#ffd700', isBusy: false }; }
export function movePlayer(direction, player, map, config) { if(player.isBusy) return false; let newX = player.x, newY = player.y; switch (direction) { case 'north': newY--; break; case 'south': newY++; break; case 'west': newX--; break; case 'east': newX++; break; default: return false; } if (newX >= 0 && newX < config.MAP_WIDTH && newY >= 0 && newY < config.MAP_HEIGHT && map[newY][newX].type.accessible) { player.x = newX; player.y = newY; return true; } return false; }
export function decayStats(player) { if(player.isBusy) return; player.thirst = Math.max(0, player.thirst - 2); player.hunger = Math.max(0, player.hunger - 1); player.sleep = Math.max(0, player.sleep - 0.5); if (player.thirst === 0 || player.hunger === 0) { UI.addChatMessage("Votre santé se dégrade !", "system"); player.health = Math.max(0, player.health - 5); } }

export function updatePossibleActions(gameState) {
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    UI.actionsEl.innerHTML = '';
    
    if (player.isBusy) return;

    // Action générique de récolte
    if (tile.type.resource && tile.harvestsLeft > 0) {
        const { type, yield: y } = tile.type.resource;
        let actionText = `Récolter ${type}`;
        if (type === 'Eau') actionText = `Puiser de l'eau`;
        if (type === 'Poisson') actionText = `Pêcher`;
        if (type === 'Pierre') actionText = `Miner de la pierre`;
        if (type === 'Bois') actionText = `Couper du bois`;

        createActionButton(actionText, () => {
            player.inventory[type] = (player.inventory[type] || 0) + y;
            tile.harvestsLeft--;
            UI.showFloatingText(`+${y} ${type}`, 'gain');

            if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                tile.type = TILE_TYPES.WASTELAND;
                const newBgs = TILE_TYPES.WASTELAND.background;
                tile.backgroundKey = newBgs[Math.floor(Math.random() * newBgs.length)];
                UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
            }
            updatePossibleActions(gameState);
        });
    }

    // Actions spécifiques au type de case
    switch (tile.type) {
        case TILE_TYPES.PLAINS:
        case TILE_TYPES.WASTELAND:
            createActionButton("Abri Individuel (-20 Bois, -10 Pierre)", () => { 
                if (playerHasResources(player, { 'Bois': 20, 'Pierre': 10 })) { 
                    deductResources(player, { 'Bois': 20, 'Pierre': 10 }); 
                    tile.type = TILE_TYPES.SHELTER_INDIVIDUAL;
                    updatePossibleActions(gameState); 
                } 
            });
            createActionButton("Feu de Camp (-10 Bois, -5 Pierre)", () => {
                if (playerHasResources(player, { 'Bois': 10, 'Pierre': 5 })) {
                    deductResources(player, { 'Bois': 10, 'Pierre': 5 });
                    tile.type = TILE_TYPES.CAMPFIRE;
                    updatePossibleActions(gameState);
                }
            });
            break;
            
        case TILE_TYPES.CAMPFIRE:
            createActionButton("Cuisiner Poisson (-1 Poisson, -1 Bois)", () => {
                if (playerHasResources(player, { 'Poisson': 1, 'Bois': 1 })) {
                    deductResources(player, { 'Poisson': 1, 'Bois': 1 });
                    player.inventory['Poisson Cuit'] = (player.inventory['Poisson Cuit'] || 0) + 1;
                    UI.showFloatingText("+1 Poisson Cuit", 'gain');
                }
            });
            break;

        case TILE_TYPES.SHELTER_COLLECTIVE:
        case TILE_TYPES.SHELTER_INDIVIDUAL:
            createActionButton("Dormir (Récupération)", () => sleep(player, 50, 10, gameState));
            break;
    }
}

function createActionButton(text, onClick) { const button = document.createElement('button'); button.textContent = text; button.onclick = () => { onClick(); UI.updateAllUI(gameState, CONFIG); }; UI.actionsEl.appendChild(button); }
function playerHasResources(player, costs) { for (const resource in costs) { if (!player.inventory[resource] || player.inventory[resource] < costs[resource]) { UI.addChatMessage(`Ressources insuffisantes: Il vous manque du ${resource}.`, "system"); return false; } } return true; }
function deductResources(player, costs) { for (const resource in costs) { player.inventory[resource] -= costs[resource]; UI.showFloatingText(`-${costs[resource]} ${resource}`, 'cost'); } }
function sleep(player, sleepGain, healthGain, gameState) { player.isBusy = true; UI.addChatMessage("Vous vous endormez...", "system"); setTimeout(() => { player.sleep = Math.min(100, player.sleep + sleepGain); player.health = Math.min(100, player.health + healthGain); player.isBusy = false; UI.addChatMessage("Vous vous réveillez reposé.", "system"); updatePossibleActions(gameState); UI.updateAllUI(gameState, CONFIG); }, 3000); }

export function consumeItem(itemName, player, gameState, config) {
    if (!player.inventory[itemName] || player.inventory[itemName] <= 0) return;
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
        if (player.inventory[itemName] <= 0) delete player.inventory[itemName];
        UI.updateAllUI(gameState, config);
    }
}