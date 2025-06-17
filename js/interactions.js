// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks) {
    if (player.isBusy || player.animationState) return;

    player.isBusy = true;
    onStart();
    updateUICallbacks.updatePossibleActions();
    updateUICallbacks.updateAllButtonsState();

    setTimeout(() => {
        onComplete();
        player.isBusy = false;
        updateUICallbacks.updateAllUI();
        updateUICallbacks.updatePossibleActions();
        updateUICallbacks.updateAllButtonsState();
    }, duration);
}

export function handlePlayerAction(actionId, data, updateUICallbacks) {
    const { player, map, activeEvent } = State.state;
    const tile = map[player.y][player.x];

    switch(actionId) {
        case 'harvest':
            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage("Récolte...", "system"), 
                () => {
                    const { type, yield: baseYield } = tile.type.resource;
                    let finalYield = activeEvent.type === 'Abondance' && activeEvent.data.resource === type ? baseYield * 2 : baseYield;
                    const availableSpace = CONFIG.PLAYER_MAX_RESOURCES - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(type, amountToHarvest);
                        tile.harvestsLeft--;
                        UI.showFloatingText(`+${amountToHarvest} ${type}`, 'gain');
                        UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, TILE_TYPES.WASTELAND);
                            UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                        }
                    } else { 
                        UI.addChatMessage("Votre inventaire est plein !", "system"); 
                        UI.triggerShake(document.getElementById('inventory-capacity-display'));
                    }
                }, 
                updateUICallbacks
            );
            break;

        case 'build':
            const costs = data.structure === 'shelter' ? { 'Bois': 20, 'Pierre': 10 } : { 'Bois': 10, 'Pierre': 5 };
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes.", "system");
                UI.triggerShake(document.getElementById('inventory-list'));
                return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Construction...`, "system"), 
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText(`-${costs['Bois']} Bois`, 'cost');
                    UI.showFloatingText(`-${costs['Pierre']} Pierre`, 'cost');
                    UI.triggerActionFlash('cost');
                    const newStructure = data.structure === 'shelter' ? TILE_TYPES.SHELTER_INDIVIDUAL : TILE_TYPES.CAMPFIRE;
                    State.updateTileType(player.x, player.y, newStructure);
                },
                updateUICallbacks
            );
            break;

        case 'cook':
             if (!State.hasResources({ 'Poisson': 1, 'Bois': 1 }).success) {
                UI.addChatMessage("Ressources insuffisantes pour cuisiner.", "system");
                UI.triggerShake(document.getElementById('inventory-list'));
                return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage("Cuisson...", "system"), 
                () => {
                    State.applyResourceDeduction({ 'Poisson': 1, 'Bois': 1 });
                    State.addResourceToPlayer('Poisson Cuit', 1);
                    UI.showFloatingText("+1 Poisson Cuit", "gain"); UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;

        case 'sleep':
            performTimedAction(player, ACTION_DURATIONS.SLEEP, 
                () => UI.addChatMessage("Vous vous endormez...", "system"), 
                () => {
                    player.sleep = Math.min(100, player.sleep + 50); 
                    player.health = Math.min(100, player.health + 10);
                    UI.addChatMessage("Vous vous réveillez reposé.", "system");
                },
                updateUICallbacks
            );
            break;
    }
}