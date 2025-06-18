// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';

function applyActionCosts(player, costs) {
    let floatingTextParts = [];
    if (costs.thirst) {
        player.thirst = Math.max(0, player.thirst - costs.thirst);
        floatingTextParts.push(`-${costs.thirst}💧`);
    }
    if (costs.hunger) {
        player.hunger = Math.max(0, player.hunger - costs.hunger);
        floatingTextParts.push(`-${costs.hunger}🍗`);
    }
    if (costs.sleep) {
        player.sleep = Math.max(0, player.sleep - costs.sleep);
        floatingTextParts.push(`-${costs.sleep}🌙`);
    }
    if(floatingTextParts.length > 0){
        UI.showFloatingText(floatingTextParts.join(' '), 'cost');
    }
}

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks) {
    if (player.isBusy || player.animationState) return;

    player.isBusy = true;
    onStart();
    updateUICallbacks.updatePossibleActions();
    UI.updateAllButtonsState(State.state);

    setTimeout(() => {
        onComplete();
        player.isBusy = false;
        updateUICallbacks.updateAllUI();
        updateUICallbacks.updatePossibleActions();
        UI.updateAllButtonsState(State.state);
    }, duration);
}

function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks) {
    const tool = player.equipment[toolSlot];
    if (!tool || tool.action !== actionType) {
        UI.addChatMessage(`Vous n'avez pas le bon outil équipé pour cette action.`, 'system');
        UI.triggerShake(document.getElementById('equipment-slots'));
        return;
    }

    performTimedAction(player, ACTION_DURATIONS.HARVEST,
        () => UI.addChatMessage(`Utilisation de ${tool.name}...`, 'system'),
        () => {
            onComplete(tool.power);

            tool.currentDurability--;
            if (tool.currentDurability <= 0) {
                UI.addChatMessage(`${tool.name} s'est cassé !`, 'system');
                State.state.player.equipment[toolSlot] = null;
            }
            if (!UI.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
        },
        updateUICallbacks
    );
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
    
    const damage = weapon && weapon.stats?.damage ? weapon.stats.damage : COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;
    
    combatState.enemy.currentHealth = Math.max(0, combatState.enemy.currentHealth - damage);
    combatState.log.unshift(`Vous infligez ${damage} dégâts avec ${weapon ? weapon.name : 'vos poings'}.`);
    
    if (weapon && weapon.hasOwnProperty('currentDurability')) {
        weapon.currentDurability--;
        if (weapon.currentDurability <= 0) {
            combatState.log.unshift(`${weapon.name} s'est cassé !`);
            player.equipment.weapon = null;
        }
    }

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
    
    const defense = player.equipment.body?.stats?.defense || 0;
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
            const resource = tile.type.resource;
            if (!resource) return;
            
            const costs = {
                thirst: resource.thirstCost || 0,
                hunger: resource.hungerCost || 0,
                sleep: resource.sleepCost || 0,
            };
            applyActionCosts(player, costs);

            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage("Récolte...", "system"), 
                () => {
                    let finalYield = activeEvent.type === 'Abondance' && activeEvent.data.resource === resource.type ? resource.yield * 2 : resource.yield;
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        tile.harvestsLeft--;
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain');
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
        
        case 'harvest_wood': {
            applyActionCosts(player, { thirst: 4, hunger: 2, sleep: 3 });
            performToolAction(player, 'weapon', 'harvest_wood', (power) => {
                State.addResourceToPlayer('Bois', power);
                UI.showFloatingText(`+${power} Bois`, 'gain');
                UI.triggerActionFlash('gain');
            }, updateUICallbacks);
            break;
        }

        case 'fish': {
            applyActionCosts(player, { thirst: 2, hunger: 1, sleep: 2 });
            performToolAction(player, 'weapon', 'fish', (power) => {
                State.addResourceToPlayer('Poisson cru', power);
                UI.showFloatingText(`+${power} Poisson cru`, 'gain');
                UI.triggerActionFlash('gain');
            }, updateUICallbacks);
            break;
        }

        case 'hunt': {
             const weapon = player.equipment.weapon;
             if (!weapon) {
                 UI.addChatMessage("Vous ne pouvez pas chasser sans arme.", "system");
                 return;
             }
             
             applyActionCosts(player, { thirst: 5, hunger: 3, sleep: 4 });
             performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) {
                        const amount = weapon.stats?.damage || weapon.power || 1;
                        State.addResourceToPlayer('Viande crue', amount);
                        UI.showFloatingText(`+${amount} Viande crue`, "gain");
                    } else {
                        UI.addChatMessage("La chasse n'a rien donné.", "system");
                    }
                    if (weapon.hasOwnProperty('currentDurability')) {
                        weapon.currentDurability--;
                        if (weapon.currentDurability <= 0) {
                            UI.addChatMessage(`${weapon.name} s'est cassé !`, 'system');
                            player.equipment.weapon = null;
                        }
                    }
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
            applyActionCosts(player, { thirst: 10, hunger: 5, sleep: 5 });
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
            
            applyActionCosts(player, { thirst: 10, hunger: 10, sleep: 15 });
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
            applyActionCosts(player, { thirst: 3, hunger: 2, sleep: 2 });
            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage("Vous arrosez la terre...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText(`-${Object.values(costs)[0]} ${Object.keys(costs)[0]}`, "cost");
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
                    player.sleep = Math.min(player.maxSleep, player.sleep + sleepEffect.sleep); 
                    player.health = Math.min(player.maxHealth, player.health + sleepEffect.health);
                    UI.addChatMessage("Vous vous réveillez reposé.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'cook': {
             if (!State.hasResources({ 'Poisson cru': 1, 'Bois': 1 }).success) {
                UI.addChatMessage("Ressources insuffisantes pour cuisiner.", "system");
                UI.triggerShake(document.getElementById('inventory-list'));
                return;
            }
            applyActionCosts(player, { thirst: 1, sleep: 1 });
            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage("Cuisson...", "system"), 
                () => {
                    State.applyResourceDeduction({ 'Poisson cru': 1, 'Bois': 1 });
                    State.addResourceToPlayer('Poisson cuit', 1);
                    UI.showFloatingText("+1 Poisson cuit", "gain"); UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;
        }
    }
}