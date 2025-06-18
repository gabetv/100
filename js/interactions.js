// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES } from './config.js';
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

export function handleCombatAction(action) {
    const { combatState, player } = State.state;
    if (!combatState || !combatState.isPlayerTurn) return;

    combatState.isPlayerTurn = false;
    UI.updateCombatUI(combatState);

    setTimeout(() => {
        if (action === 'attack') {
            playerAttack();
        } else if (action === 'flee') {
            playerFlee();
        }

        if (State.state.combatState) {
            setTimeout(() => {
                enemyAttack();
                if (State.state.combatState) {
                    State.state.combatState.isPlayerTurn = true;
                    UI.updateCombatUI(State.state.combatState);
                }
            }, 1000);
        }
    }, 500);
}

function playerAttack() {
    const { combatState, player } = State.state;
    const weapon = player.equipment.weapon;
    // LA CORRECTION EST ICI
    const damage = weapon ? weapon.stats.damage : COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;
    
    combatState.enemy.currentHealth = Math.max(0, combatState.enemy.currentHealth - damage);
    combatState.log.unshift(`Vous infligez ${damage} dégâts avec ${weapon ? weapon.name : 'vos poings'}.`);

    if (combatState.enemy.currentHealth <= 0) {
        combatState.log.unshift(`Vous avez vaincu ${combatState.enemy.name} !`);
        UI.addChatMessage(`Vous avez vaincu ${combatState.enemy.name} !`, 'gain');
        Object.keys(combatState.enemy.loot).forEach(item => {
            const amount = combatState.enemy.loot[item];
            if (amount > 0) {
                UI.showFloatingText(`+${amount} ${item}`, 'gain');
            }
        });
        State.endCombat(true);
        UI.hideCombatModal();
        UI.updateAllUI(State.state);
        UI.updatePossibleActions();
    } else {
        UI.updateCombatUI(combatState);
    }
}

function playerFlee() {
    const { combatState } = State.state;
    if (Math.random() < COMBAT_CONFIG.FLEE_CHANCE) {
        combatState.log.unshift("Vous avez réussi à fuir !");
        UI.addChatMessage("Vous avez pris la fuite.", "system");
        State.endCombat(false);
        UI.hideCombatModal();
        UI.updatePossibleActions();
    } else {
        combatState.log.unshift("Votre tentative de fuite a échoué !");
        UI.updateCombatUI(combatState);
    }
}

function enemyAttack() {
    const { combatState, player } = State.state;
    if (!combatState) return;
    
    const defense = player.equipment.armor ? player.equipment.armor.stats.defense : 0;
    const damageTaken = Math.max(0, combatState.enemy.damage - defense);

    player.health = Math.max(0, player.health - damageTaken);
    combatState.log.unshift(`${combatState.enemy.name} vous inflige ${damageTaken} dégâts.`);

    if (player.health <= 0) {
        combatState.log.unshift("Vous avez été vaincu...");
    }
    
    UI.updateCombatUI(combatState);
    UI.updateAllUI(State.state);
}


export function handlePlayerAction(actionId, data, updateUICallbacks) {
    const { player, map, activeEvent, combatState } = State.state;
    if (combatState) {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", 'system');
        return;
    }
    const tile = map[player.y][player.x];

    switch(actionId) {
        case 'harvest': {
            const { type, yield: baseYield, thirstCost, hungerCost } = tile.type.resource;
            player.thirst = Math.max(0, player.thirst - (thirstCost || 0));
            player.hunger = Math.max(0, player.hunger - (hungerCost || 0));
            
            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage("Récolte...", "system"), 
                () => {
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
        }

        case 'harvest_ore': {
            const { thirstCost, hungerCost } = tile.type.resource;
            player.thirst = Math.max(0, player.thirst - thirstCost);
            player.hunger = Math.max(0, player.hunger - hungerCost);

            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage("Vous minez...", "system"),
                () => {
                    const randomOre = ORE_TYPES[Math.floor(Math.random() * ORE_TYPES.length)];
                    State.addResourceToPlayer(randomOre, 1);
                    UI.showFloatingText(`+1 ${randomOre}`, 'gain');
                    UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;
        }

        case 'build': {
            const costs = data.structure === 'shelter_individual' 
                ? { 'Bois': 20 } 
                : { 'Bois': 600 };
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
                    const newStructure = data.structure === 'shelter_individual' ? TILE_TYPES.SHELTER_INDIVIDUAL : TILE_TYPES.SHELTER_COLLECTIVE;
                    State.updateTileType(player.x, player.y, newStructure);
                },
                updateUICallbacks
            );
            break;
        }
        
        case 'dig_mine': {
            const costs = { 'Bois': 100 };
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Pas assez de bois pour étayer la mine.", "system");
                return;
            }
            
            player.thirst = Math.max(0, player.thirst - 10);
            player.hunger = Math.max(0, player.hunger - 10);

            performTimedAction(player, ACTION_DURATIONS.DIG,
                () => UI.addChatMessage("Vous creusez une entrée de mine...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText("-100 Bois", 'cost');
                    State.updateTileType(player.x, player.y, TILE_TYPES.MINE);
                    UI.addChatMessage("La mine est prête !", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'regenerate_forest': {
            const costs = TILE_TYPES.WASTELAND.regeneration.cost;
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Vous n'avez pas assez d'eau.", "system");
                return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage("Vous arrosez la terre...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText("-5 Eau", "cost");
                    State.updateTileType(player.x, player.y, TILE_TYPES.FOREST);
                    UI.addChatMessage("La terre redevient fertile.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'sleep': {
            const sleepEffect = tile.type.sleepEffect;
            if (!sleepEffect) return;

            performTimedAction(player, ACTION_DURATIONS.SLEEP, 
                () => UI.addChatMessage("Vous vous endormez pour 10 heures...", "system"), 
                () => {
                    player.sleep = Math.min(100, player.sleep + sleepEffect.sleep); 
                    player.health = Math.min(10, player.health + sleepEffect.health);
                    UI.addChatMessage("Vous vous réveillez reposé.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'cook': {
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
        }
    }
}