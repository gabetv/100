// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';
import { findEnemyOnTile } from './enemy.js';
import DOM from './ui/dom.js';
import { handleNpcInteraction as npcInteractionHandler } from './npc.js';

function applyActionCosts(player, costs) {
    if (costs.thirst && player.thirst > 0) {
        player.thirst = Math.max(0, player.thirst - costs.thirst);
    }
    if (costs.hunger && player.hunger > 0) {
        player.hunger = Math.max(0, player.hunger - costs.hunger);
    }
    if (costs.sleep && player.sleep > 0) {
        player.sleep = Math.max(0, player.sleep - costs.sleep);
    }
}

export function applyRandomStatCost(player, amount = 1, actionNameForLog = "") {
    let chosenStatName = null;
    let statIcon = '';
    const availableStats = [];
    if (player.thirst > 0) availableStats.push({ name: 'thirst', icon: '💧' });
    if (player.hunger > 0) availableStats.push({ name: 'hunger', icon: '🍗' });
    if (player.sleep > 0) availableStats.push({ name: 'sleep', icon: '🌙' });
    if (availableStats.length === 0) {
        UI.addChatMessage("Vous êtes à bout de forces !", "warning");
        return true;
    }

    if (player.status === 'Alcoolisé') {
        amount = 2;
    }
    const rand = Math.random();
    let selectedStatChoice = null;

    if (rand < 0.10 && player.thirst > 0) selectedStatChoice = availableStats.find(s => s.name === 'thirst');
    else if (rand < 0.50 && player.hunger > 0) selectedStatChoice = availableStats.find(s => s.name === 'hunger');
    else if (player.sleep > 0) selectedStatChoice = availableStats.find(s => s.name === 'sleep');

    if (!selectedStatChoice && availableStats.length > 0) {
        selectedStatChoice = availableStats[Math.floor(Math.random() * availableStats.length)];
    }

    if (selectedStatChoice) {
        chosenStatName = selectedStatChoice.name;
        statIcon = selectedStatChoice.icon;
        player[chosenStatName] = Math.max(0, player[chosenStatName] - amount);
        const maxStatValue = player[`max${chosenStatName.charAt(0).toUpperCase() + chosenStatName.slice(1)}`];
        if (player[chosenStatName] <= (maxStatValue * 0.1) && player[chosenStatName] > 0 ) {
            UI.addChatMessage(`Attention, votre ${chosenStatName} est très basse !`, "warning");
        }
    }
    return true;
}

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks, actionData = {}) {
    if (player.isBusy || player.animationState) {
        console.warn("[performTimedAction] Joueur occupé ou en animation, action annulée.");
        return;
    }
    console.log(`[performTimedAction] Démarrage action. Durée: ${duration}ms, Action Data:`, actionData);
    player.isBusy = true;
    if(typeof onStart === 'function') onStart();
    if (updateUICallbacks && updateUICallbacks.updatePossibleActions) updateUICallbacks.updatePossibleActions();
    if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) UI.updateAllButtonsState(State.state);

    setTimeout(() => {
        console.log("[performTimedAction] Timeout terminé. Exécution de onComplete.");
        if(typeof onComplete === 'function') onComplete(actionData);
        player.isBusy = false;
        console.log("[performTimedAction] Joueur n'est plus occupé.");
        if (updateUICallbacks && updateUICallbacks.updateAllUI) updateUICallbacks.updateAllUI();
    }, duration);
}


function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks, actionData = {}, specificToolName = null) {
    const tool = player.equipment[toolSlot];

    if (specificToolName) {
        if (!tool || tool.name !== specificToolName) {
            UI.addChatMessage(`Vous avez besoin d'un(e) ${specificToolName} équipé(e).`, 'system');
            if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
            else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
            return;
        }
    } else if (actionType) { // General action check (e.g., 'dig')
        if (!tool || tool.action !== actionType) {
            UI.addChatMessage(`Vous n'avez pas le bon outil équipé pour "${actionType}".`, 'system');
             if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
             else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
            return;
        }
    }
    // If no specificToolName and no actionType, it implies hands or logic is handled by caller

    let durationKey = actionType ? actionType.toUpperCase() : 'HARVEST';
    // Normalize duration keys
    if (actionType === 'harvest_wood') durationKey = 'HARVEST';
    else if (actionType === 'mine_ore') durationKey = 'HARVEST'; // Mining ore is a type of harvest
    else if (actionType === 'dig') durationKey = 'DIG';
    else if (actionType === 'fish') durationKey = 'HARVEST'; // Fishing is a type of harvest

    performTimedAction(player, ACTION_DURATIONS[durationKey] || ACTION_DURATIONS.HARVEST,
        () => UI.addChatMessage(`Utilisation de ${tool ? tool.name : 'vos mains'}...`, 'system'),
        () => {
            onComplete(tool ? (tool.power || 1) : 1, tool); // Pass tool instance
            if (tool) { // Only process tool if one was actually used (not hands)
                if (tool.hasOwnProperty('currentDurability') && typeof tool.currentDurability === 'number') {
                    tool.currentDurability--;
                    if (tool.currentDurability <= 0) {
                        UI.addChatMessage(`${tool.name} s'est cassé !`, 'system_warning');
                        State.unequipItem(toolSlot);
                    }
                } else if (tool.hasOwnProperty('uses')) { // Check for uses property first (e.g. for tools like Filtre à eau)
                    // If the item definition has 'uses' but the instance doesn't have 'currentUses', initialize it.
                    if (typeof tool.currentUses === 'undefined' && typeof tool.uses === 'number') {
                        tool.currentUses = tool.uses;
                    }
                    if (tool.hasOwnProperty('currentUses') && typeof tool.currentUses === 'number') {
                        tool.currentUses--;
                        if (tool.currentUses <= 0) {
                            UI.addChatMessage(`${tool.name} est épuisé !`, 'system_warning');
                            State.unequipItem(toolSlot); // Remove from equipment
                        }
                    }
                }
            }
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
        },
        updateUICallbacks,
        actionData
    );
}


export function handleCombatAction(action) {
    const { combatState, player } = State.state;
    if (!combatState || !combatState.isPlayerTurn) return;
    combatState.isPlayerTurn = false;
    UI.updateCombatUI(combatState);
    setTimeout(() => {
        if (action === 'attack') playerAttack();
        else if (action === 'flee') playerFlee();
        if (State.state.combatState && State.state.combatState.enemy.currentHealth > 0 && player.health > 0) {
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
    if (!combatState) return;
    const weapon = player.equipment.weapon;
    const damage = weapon && weapon.stats?.damage ? weapon.stats.damage : COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE;
    combatState.enemy.currentHealth = Math.max(0, combatState.enemy.currentHealth - damage);
    combatState.log.unshift(`Vous infligez ${damage} dégâts avec ${weapon ? weapon.name : 'vos poings'}.`);
    if (weapon && weapon.hasOwnProperty('currentDurability') && typeof weapon.currentDurability === 'number') {
        weapon.currentDurability--;
        if (weapon.currentDurability <= 0) {
            combatState.log.unshift(`${weapon.name} s'est cassé !`);
            State.unequipItem('weapon');
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
        }
    }
    if (combatState.enemy.currentHealth <= 0) {
        combatState.log.unshift(`Vous avez vaincu ${combatState.enemy.name} !`);
        UI.addChatMessage(`Vous avez vaincu ${combatState.enemy.name} !`, 'gain');
        Object.keys(combatState.enemy.loot).forEach(item => {
            const amount = combatState.enemy.loot[item];
            if (amount > 0) {
                State.addResourceToPlayer(item, amount);
                UI.showFloatingText(`+${amount} ${item}`, 'gain');
            }
        });

        State.endCombat(true);
        UI.hideCombatModal();
        if (window.fullUIUpdate) window.fullUIUpdate();
    } else {
        UI.updateCombatUI(combatState);
    }
}

function playerFlee() {
    const { combatState } = State.state;
    if (!combatState) return;
    if (Math.random() < COMBAT_CONFIG.FLEE_CHANCE) {
        combatState.log.unshift("Vous avez réussi à fuir !");
        UI.addChatMessage("Vous avez pris la fuite.", "system");
        State.endCombat(false);
        UI.hideCombatModal();
        if (window.fullUIUpdate) window.fullUIUpdate();
    } else {
        combatState.log.unshift("Votre tentative de fuite a échoué !");
        UI.updateCombatUI(combatState);
    }
}

function enemyAttack() {
    const { combatState, player } = State.state;
    if (!combatState) return;
    const defense = (player.equipment.body?.stats?.defense || 0) +
                    (player.equipment.head?.stats?.defense || 0) +
                    (player.equipment.feet?.stats?.defense || 0) +
                    (player.equipment.shield?.stats?.defense || 0);
    const damageTaken = Math.max(0, combatState.enemy.damage - defense);
    player.health = Math.max(0, player.health - damageTaken);
    combatState.log.unshift(`${combatState.enemy.name} vous inflige ${damageTaken} dégâts.`);
    if (player.health <= 0) combatState.log.unshift("Vous avez été vaincu...");
    UI.updateCombatUI(combatState);
    if (window.fullUIUpdate) window.fullUIUpdate();
}

function findBuildingOnTile(tile, buildingKey) {
    if (!tile || !tile.buildings) return null;
    return tile.buildings.find(b => b.key === buildingKey);
}
function getBuildingIndexOnTile(tile, buildingKey) {
    if (!tile || !tile.buildings) return -1;
    return tile.buildings.findIndex(b => b.key === buildingKey);
}

export function handlePlayerAction(actionId, data, updateUICallbacks) {
    const { player, map, activeEvent, combatState, enemies, knownRecipes, foundUniqueParchemins } = State.state;
    console.log(`[handlePlayerAction] Action: ${actionId}, Data:`, JSON.stringify(data));
    if (combatState && actionId !== 'combat_action') {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", "system");
        return;
    }
    const tile = map[player.y][player.x];
    let shouldApplyBaseCost = true;
    const noBaseCostActions = [
        'sleep', 'initiate_combat', 'take_hidden_item', 'open_treasure',
        'consume_eau_salee', 'open_large_map',
        'talk_to_npc', 'open_building_inventory',
        'plant_tree', 'sleep_by_campfire', 'dismantle_building',
        'craft_item_workshop', 'open_all_parchemins',
        'fire_distress_gun', 'fire_distress_flare', 'place_solar_panel_fixed', 'charge_battery_portable_solar',
        'place_trap', 'attract_npc_attention', 'find_mine_compass', 'observe_weather', 'use_building_action'
    ];
    if (noBaseCostActions.includes(actionId)) {
        shouldApplyBaseCost = false;
    }

    if (shouldApplyBaseCost) applyRandomStatCost(player, 1, actionId);

    switch(actionId) {
        case 'initiate_combat': {
            const enemy = findEnemyOnTile(player.x, player.y, enemies);
            if (enemy) {
                State.startCombat(player, enemy);
                UI.showCombatModal(State.state.combatState);
                if (updateUICallbacks && updateUICallbacks.updatePossibleActions) updateUICallbacks.updatePossibleActions();
            } else UI.addChatMessage("Il n'y a plus rien à attaquer ici.", "system");
            break;
        }
        case 'consume_eau_salee': {
            if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                UI.addChatMessage("Vous ne pouvez boire de l'eau salée que sur la plage.", "system"); return;
            }
            if (player.thirst > player.maxThirst - ITEM_TYPES['Eau salée'].effects.thirst) {
                 UI.addChatMessage("Vous n'avez pas assez soif pour risquer de boire ceci.", "system"); return;
            }
            if (player.inventory['Eau salée'] > 0) {
                const result = State.consumeItem('Eau salée');
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                if (result.success && result.floatingTexts) {
                    result.floatingTexts.forEach(text => {
                         if (!text.includes('💧') || text.includes('❤️')) {
                             UI.showFloatingText(text, text.startsWith('-') ? 'cost' : 'info')
                         }
                    });
                }
            } else {
                UI.addChatMessage("Vous n'avez plus d'Eau salée.", "system");
            }
            break;
        }
        case 'harvest_salt_water': {
            if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                UI.addChatMessage("Vous ne pouvez récolter de l'eau salée que sur la plage.", "system"); return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.harvest_salt_water <= 0) {
                UI.addChatMessage("Vous ne pouvez plus récolter d'eau salée ici pour le moment.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`Récolte d'Eau salée...`, "system"),
                () => {
                    let amount = 1;
                    let toolUsed = null;
                    if (player.equipment.weapon && player.equipment.weapon.name === 'Seau') {
                        amount = 3;
                        toolUsed = player.equipment.weapon;
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    if (availableSpace >= amount) {
                        State.addResourceToPlayer('Eau salée', amount);
                        UI.showFloatingText(`+${amount} Eau salée`, 'gain'); UI.triggerActionFlash('gain');
                        tile.actionsLeft.harvest_salt_water--;

                        if (toolUsed && toolUsed.hasOwnProperty('currentDurability')) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                    } else {
                        UI.addChatMessage("Inventaire plein, impossible de récolter l'eau salée.", "system");
                        if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks );
            break;
        }
        case 'harvest_sand': {
            if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez récolter du sable que sur la plage.", "system"); return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.harvest_sand <= 0) {
                UI.addChatMessage("Vous ne pouvez plus récolter de sable ici pour le moment.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`Récolte de Sable...`, "system"),
                () => {
                    let yieldAmount = 1;
                    let toolUsed = null;
                    if (player.equipment.weapon) {
                        const weaponName = player.equipment.weapon.name;
                        if (weaponName === 'Pelle en bois' || weaponName === 'Seau') {
                            yieldAmount = 3;
                            toolUsed = player.equipment.weapon;
                        } else if (weaponName === 'Pelle en fer') {
                            yieldAmount = 5;
                            toolUsed = player.equipment.weapon;
                        }
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(yieldAmount, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Sable', amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} Sable`, 'gain'); UI.triggerActionFlash('gain');
                        tile.actionsLeft.harvest_sand--;

                        if (toolUsed && toolUsed.hasOwnProperty('currentDurability')) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                        if (amountToHarvest < yieldAmount && availableSpace <= 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");

                    } else {
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter.", "system");
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks );
            break;
        }
        case 'harvest': { // Generic harvest for stone from MINE_TERRAIN
            const resource = tile.type.resource;
            if (!resource || resource.type !== 'Pierre' || tile.type.name !== TILE_TYPES.MINE_TERRAIN.name) {
                console.warn("[handlePlayerAction - harvest] Action générique appelée pour une ressource non-Pierre ou un mauvais type de terrain."); return;
            }
            if (tile.harvestsLeft <= 0 && tile.harvestsLeft !== Infinity) {
                 UI.addChatMessage("Plus rien à récolter ici.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`Récolte de ${resource.type}...`, "system"),
                () => {
                    let finalYield = resource.yield;
                    let toolUsed = null;
                    if (player.equipment.weapon && player.equipment.weapon.name === 'Pioche') {
                        finalYield = 3;
                        toolUsed = player.equipment.weapon;
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace, tile.harvestsLeft === Infinity ? Infinity : tile.harvestsLeft);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        if (tile.harvestsLeft !== Infinity) tile.harvestsLeft -= amountToHarvest;

                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain'); UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");

                        if (toolUsed && toolUsed.hasOwnProperty('currentDurability')) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                        if (tile.harvestsLeft <= 0 && tile.harvestsLeft !== Infinity) {
                            UI.addChatMessage("Ce filon de pierre est épuisé.", "system");
                        }
                    } else {
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : (tile.harvestsLeft <=0 && tile.type.harvests !== Infinity ? "Plus rien à récolter ici." : "Impossible de récolter."), "system");
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks );
            break;
        }
        case 'harvest_wood_hache':
        case 'harvest_wood_scie':
        case 'harvest_wood_mains': {
            const requiredToolName = actionId === 'harvest_wood_hache' ? 'Hache' : (actionId === 'harvest_wood_scie' ? 'Scie' : null);
            const forestTileRef = map[player.y][player.x];
            if (forestTileRef.type.name !== TILE_TYPES.FOREST.name || forestTileRef.woodActionsLeft <= 0) {
                UI.addChatMessage("Plus de bois à couper/ramasser ici ou ce n'est pas une forêt.", "system"); return;
            }
            performToolAction(player, 'weapon', 'harvest_wood',
                (powerOverride, toolUsed) => {
                    let woodYield = 1;
                    let toolUsedNameForMessage = "vos mains";

                    if (actionId === 'harvest_wood_hache') {
                        if (toolUsed && toolUsed.name === 'Hache') { woodYield = 3; toolUsedNameForMessage = toolUsed.name; }
                        else { UI.addChatMessage("Vous avez besoin d'une Hache équipée.", "system"); return; }
                    } else if (actionId === 'harvest_wood_scie') {
                        if (toolUsed && toolUsed.name === 'Scie') { woodYield = 5; toolUsedNameForMessage = toolUsed.name; }
                        else { UI.addChatMessage("Vous avez besoin d'une Scie équipée.", "system"); return; }
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(woodYield, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Bois', amountToHarvest);
                        forestTileRef.woodActionsLeft--;
                        UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain'); UI.triggerActionFlash('gain');
                        UI.addChatMessage(`Vous obtenez ${amountToHarvest} Bois avec ${toolUsedNameForMessage}.`, 'system');
                        if (amountToHarvest < woodYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle de bois.", "system");

                        if (forestTileRef.woodActionsLeft <= 0) {
                            UI.addChatMessage("Cette partie de la forêt est épuisée pour le bois.", "system");
                        }
                    } else {
                         UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter du bois.", "system");
                         if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                },
                updateUICallbacks, {}, requiredToolName);
            break;
        }
        case 'fish': { // Pêche à la Canne à pêche
             if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez pêcher que sur la plage.", "system"); return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.fish <= 0) {
                UI.addChatMessage("Vous ne pouvez plus pêcher ici pour le moment.", "system"); return;
            }
            performToolAction(player, 'weapon', 'fish', (power, toolUsed) => {
                if (toolUsed && toolUsed.name === 'Canne à pêche') {
                    const fishCaught = Math.ceil(Math.random() * (toolUsed.power || 1));
                    if (fishCaught > 0) {
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(fishCaught, availableSpace);
                        if (amountToAdd > 0) {
                            State.addResourceToPlayer('Poisson cru', amountToAdd);
                            UI.showFloatingText(`+${amountToAdd} Poisson cru`, 'gain'); UI.triggerActionFlash('gain');
                            tile.actionsLeft.fish--;
                            if (amountToAdd < fishCaught) UI.addChatMessage("Inventaire plein, une partie du poisson a été relâchée.", "system");
                        } else {
                            UI.addChatMessage("Inventaire plein, impossible de garder le poisson.", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                        }
                    } else UI.addChatMessage("Ça ne mord pas aujourd'hui...", "system");
                } else {
                     UI.addChatMessage("Vous avez besoin d'une Canne à pêche équipée.", "system");
                }
            }, updateUICallbacks, {}, 'Canne à pêche');
            break;
        }
        case 'net_fish': { // Pêche au Filet
             if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez pêcher que sur la plage.", "system"); return;
            }
            performToolAction(player, 'weapon', 'net_fish', (power, toolUsed) => {
                if (toolUsed && toolUsed.name === 'Filet de pêche') {
                    const fishCaught = Math.ceil(Math.random() * 5) + 2; // 3-7 poissons avec filet
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToAdd = Math.min(fishCaught, availableSpace);
                    if (amountToAdd > 0) {
                        State.addResourceToPlayer('Poisson cru', amountToAdd);
                        UI.showFloatingText(`+${amountToAdd} Poisson cru`, 'gain'); UI.triggerActionFlash('gain');
                        // Pas de actionsLeft pour le filet, il est moins "épuisable" sur une zone, mais a des "uses"
                        if (amountToAdd < fishCaught) UI.addChatMessage("Inventaire plein, une partie du poisson a été relâchée.", "system");
                    } else {
                        UI.addChatMessage("Inventaire plein, impossible de garder le poisson.", "system");
                        if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                } else {
                    UI.addChatMessage("Vous avez besoin d'un Filet de pêche équipé.", "system");
                }
            }, updateUICallbacks, {}, 'Filet de pêche');
            break;
        }
        case 'hunt': {
             const weapon = player.equipment.weapon;
             const currentTileForHunt = map[player.y][player.x];
             if (!currentTileForHunt.huntActionsLeft || currentTileForHunt.huntActionsLeft <= 0) {
                 UI.addChatMessage("Plus d'opportunités de chasse ici pour le moment.", "system"); return;
             }
             if (!weapon || !weapon.stats || weapon.stats.damage <= 0) { // Need a weapon with damage
                 UI.addChatMessage("Vous ne pouvez pas chasser sans arme infligeant des dégâts.", "system"); return;
             }
             if (player.status === 'Drogué') { UI.addChatMessage("Vous ne pouvez pas chasser sous l'effet de la drogue.", "system"); return; }
             performTimedAction(player, ACTION_DURATIONS.CRAFT, // Hunt duration might need its own constant
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) { // 60% chance de succès
                        const baseAmount = (weapon.stats?.damage || 1);
                        const amount = baseAmount * (Math.floor(Math.random() * 2) + 1); // 1x ou 2x les dégâts de l'arme
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(amount, availableSpace);
                        if(amountToAdd > 0) {
                            State.addResourceToPlayer('Viande crue', amountToAdd);
                            UI.showFloatingText(`+${amountToAdd} Viande crue`, "gain"); UI.triggerActionFlash('gain');
                            currentTileForHunt.huntActionsLeft--;
                            if (amountToAdd < amount) UI.addChatMessage("Inventaire plein, une partie de la chasse a été laissée.", "system");
                        } else {
                            UI.addChatMessage("Inventaire plein, impossible de ramener la viande.", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                        }
                    } else UI.addChatMessage("La chasse n'a rien donné.", "system");

                    if (weapon.hasOwnProperty('currentDurability') && typeof weapon.currentDurability === 'number') {
                        weapon.currentDurability--;
                        if (weapon.currentDurability <= 0) {
                            UI.addChatMessage(`${weapon.name} s'est cassé !`, 'system_warning');
                            State.unequipItem('weapon');
                            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
                            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
                        }
                    }
                }, updateUICallbacks );
            break;
        }
        case 'build_structure': {
            const structureKey = data.structureKey;
            const structureType = TILE_TYPES[structureKey];
            if (!structureType) { UI.addChatMessage("Type de structure inconnu.", "system"); return; }

            const costs = { ...structureType.cost };
            const toolRequiredArray = costs.toolRequired;
            delete costs.toolRequired;

            if (player.status === 'Drogué') { UI.addChatMessage("Vous ne pouvez pas construire sous l'effet de la drogue.", "system"); return; }

            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes pour construire.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); return;
            }

            let hasRequiredToolForBuild = !toolRequiredArray || toolRequiredArray.length === 0;
            let actualToolUsed = null;
            if (toolRequiredArray && toolRequiredArray.length > 0) {
                if (player.equipment.weapon && toolRequiredArray.includes(player.equipment.weapon.name)) {
                    hasRequiredToolForBuild = true;
                    actualToolUsed = player.equipment.weapon;
                } else {
                    UI.addChatMessage(`Outil requis non équipé : ${toolRequiredArray.join(' ou ')}.`, "system"); return;
                }
            }

            if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) { UI.addChatMessage("Nombre maximum de bâtiments atteint sur cette tuile.", "system"); return; }

            if (tile.type.name !== TILE_TYPES.PLAINS.name && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE' && structureKey !== 'PETIT_PUIT') {
                UI.addChatMessage("Ce bâtiment ne peut être construit que sur une Plaine.", "system"); return;
            }
             if (!tile.type.buildable && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE' && structureKey !== 'PETIT_PUIT') {
                UI.addChatMessage("Vous ne pouvez pas construire sur ce type de terrain.", "system"); return;
            }

            performTimedAction(player, ACTION_DURATIONS.BUILD,
                () => UI.addChatMessage(`Construction de ${structureType.name}...`, "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    for (const item in costs) UI.showFloatingText(`-${costs[item]} ${item}`, 'cost');

                    if (actualToolUsed) {
                        if (actualToolUsed.hasOwnProperty('currentDurability') && typeof actualToolUsed.currentDurability === 'number') {
                            actualToolUsed.currentDurability--;
                            if (actualToolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${actualToolUsed.name} s'est cassé en construisant !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        } else if (actualToolUsed.hasOwnProperty('uses') && typeof actualToolUsed.uses === 'number' && actualToolUsed.isFireStarter && structureKey === 'CAMPFIRE') {
                            // Fire starters with 'uses'
                            if (typeof actualToolUsed.currentUses === 'undefined') actualToolUsed.currentUses = actualToolUsed.uses;
                            actualToolUsed.currentUses--;
                             if (actualToolUsed.currentUses <= 0) {
                                UI.addChatMessage(`${actualToolUsed.name} s'est épuisé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                    }

                    const buildResult = State.addBuildingToTile(player.x, player.y, structureKey);
                    UI.addChatMessage(buildResult.message, buildResult.success ? "gain" : "system");
                    if(buildResult.success) UI.triggerActionFlash('gain');
                }, updateUICallbacks );
            break;
        }
        case 'regenerate_forest': {
            if (tile.type.name !== TILE_TYPES.WASTELAND.name) { UI.addChatMessage("Cette action ne peut être faite que sur une friche.", "system"); return; }
            const costs = TILE_TYPES.WASTELAND.regeneration.cost;
            if (!State.hasResources(costs).success) { UI.addChatMessage("Ressources manquantes pour régénérer.", "system"); return; }
            performTimedAction(player, ACTION_DURATIONS.PLANT_TREE,
                () => UI.addChatMessage("Régénération de la forêt...", "system"),
                () => { State.applyResourceDeduction(costs); State.updateTileType(player.x, player.y, TILE_TYPES.WASTELAND.regeneration.target); UI.addChatMessage("La friche reverdit !", "gain"); UI.triggerActionFlash('gain'); },
                updateUICallbacks);
            break;
        }
        case 'plant_tree': {
            if (tile.type.name !== TILE_TYPES.PLAINS.name) { UI.addChatMessage("Vous ne pouvez planter un arbre que sur une Plaine.", "system"); return; }
            const costs = { 'Graine d\'arbre': 5, 'Eau pure': 1 };
            if (!State.hasResources(costs).success) { UI.addChatMessage("Nécessite 5 graines et 1 eau pure.", "system"); return; }
            performTimedAction(player, ACTION_DURATIONS.PLANT_TREE,
                () => UI.addChatMessage("Vous plantez un arbre...", "system"),
                () => { State.applyResourceDeduction(costs); State.updateTileType(player.x, player.y, 'FOREST'); UI.addChatMessage("Un jeune arbre pousse !", "gain"); UI.triggerActionFlash('gain'); },
                updateUICallbacks);
            break;
        }
        case 'sleep': {
            let sleepEffect = null; let buildingKeyForDamage = null;
            const shelterInd = findBuildingOnTile(tile, 'SHELTER_INDIVIDUAL');
            const shelterCol = findBuildingOnTile(tile, 'SHELTER_COLLECTIVE');
            const forteresse = findBuildingOnTile(tile, 'FORTERESSE');
            if (forteresse) { sleepEffect = TILE_TYPES.FORTERESSE.sleepEffect; buildingKeyForDamage = 'FORTERESSE'; }
            else if (shelterCol) { sleepEffect = TILE_TYPES.SHELTER_COLLECTIVE.sleepEffect; buildingKeyForDamage = 'SHELTER_COLLECTIVE'; }
            else if (shelterInd) { sleepEffect = TILE_TYPES.SHELTER_INDIVIDUAL.sleepEffect; buildingKeyForDamage = 'SHELTER_INDIVIDUAL'; }
            if (!sleepEffect) { UI.addChatMessage("Vous ne trouvez pas d'endroit sûr pour dormir ici.", "system"); return; }
            performTimedAction(player, ACTION_DURATIONS.SLEEP,
                () => UI.addChatMessage("Vous vous endormez pour environ 8 heures...", "system"),
                (actionDataPassed) => {
                    player.sleep = Math.min(player.maxSleep, player.sleep + (sleepEffect.sleep || 0));
                    player.health = Math.min(player.maxHealth, player.health + (sleepEffect.health || 0));
                    UI.addChatMessage("Vous vous réveillez, un peu reposé.", "system");
                    if(actionDataPassed.buildingKeyForDamage) {
                        const bldIndex = getBuildingIndexOnTile(tile, actionDataPassed.buildingKeyForDamage);
                        if(bldIndex !== -1) {
                            const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                            UI.addChatMessage(`${TILE_TYPES[actionDataPassed.buildingKeyForDamage].name} perd 1 durabilité.`, "system_event");
                            if (damageResult.destroyed) UI.addChatMessage(`${damageResult.name} s'est effondré !`, "system_event");
                        }
                    }
                }, updateUICallbacks, { buildingKeyForDamage } );
            break;
        }
        case 'sleep_by_campfire': {
            const campfire = findBuildingOnTile(tile, 'CAMPFIRE');
            if (!campfire || campfire.durability <= 0) {
                UI.addChatMessage("Le feu de camp n'est pas utilisable pour dormir.", "system"); return;
            }
            if (player.sleep >= player.maxSleep) {
                UI.addChatMessage("Vous n'avez pas besoin de dormir.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.SLEEP_BY_FIRE,
                () => UI.addChatMessage("Vous vous reposez près du feu...", "system"),
                () => {
                    player.sleep = Math.min(player.maxSleep, player.sleep + 1);
                    UI.addChatMessage("Vous vous sentez un peu mieux. (+1 Sommeil)", "system");
                    const cfIndex = getBuildingIndexOnTile(tile, 'CAMPFIRE');
                    if (cfIndex !== -1) {
                        const damageResult = State.damageBuilding(player.x, player.y, cfIndex, 1);
                         if (damageResult.destroyed) UI.addChatMessage("Le Feu de Camp s'est éteint et effondré !", "system_event");
                    }
                }, updateUICallbacks);
            break;
        }
        case 'cook': { // This is a generic cook action handler
            const { raw, buildingKeyForDamage } = data; // Expect raw material and building key in data
            const building = findBuildingOnTile(tile, buildingKeyForDamage);
            if (!building) { UI.addChatMessage("Bâtiment de cuisson introuvable.", "system"); return; }
            if (building.durability <= 0) { UI.addChatMessage("Le bâtiment de cuisson est inutilisable.", "system"); return; }

            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite', 'Oeuf cru': 'Oeuf cuit' };
            const cookedItem = cookable[raw];
            if (!raw || !cookedItem) { UI.addChatMessage("Ingrédient de cuisine invalide.", "system"); return; }
            if (!player.inventory[raw] || player.inventory[raw] < 1) {
                UI.addChatMessage(`Vous n'avez pas de ${raw} à cuisiner.`, "system"); return;
            }
            if (buildingKeyForDamage === 'CAMPFIRE' && !State.hasResources({ 'Bois': 1 }).success) {
                UI.addChatMessage(`Il faut du Bois pour alimenter le feu.`, "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); return;
            }
            performTimedAction(player, ACTION_DURATIONS.COOK,
                () => UI.addChatMessage(`Cuisson de ${raw}...`, "system"),
                () => {
                    State.applyResourceDeduction({ [raw]: 1 });
                    if (buildingKeyForDamage === 'CAMPFIRE') State.applyResourceDeduction({'Bois': 1});

                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); UI.triggerActionFlash('gain');
                    const bldIndex = getBuildingIndexOnTile(tile, buildingKeyForDamage);
                    if(bldIndex !== -1) {
                         const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                         UI.addChatMessage(`${TILE_TYPES[buildingKeyForDamage].name} perd 1 durabilité.`, "system_event");
                        if (damageResult.destroyed) UI.addChatMessage(`${damageResult.name} s'est éteint et effondré !`, "system_event");
                    }
                }, updateUICallbacks );
            break;
        }
        case 'search_zone': {
            let canSearch = false;
            if (tile.type.name === TILE_TYPES.PLAGE.name) {
                 if (tile.actionsLeft && tile.actionsLeft.search_zone > 0) canSearch = true;
                 else UI.addChatMessage("Vous avez déjà fouillé cette plage.", "system");
            } else if ( (tile.type.name === TILE_TYPES.FOREST.name || tile.type.name === TILE_TYPES.PLAINS.name) && tile.searchActionsLeft > 0) {
                 canSearch = true;
            } else {
                 UI.addChatMessage("Vous avez déjà fouillé cette zone.", "system");
            }
            if (!canSearch) return;

            const tileName = tile.type.name;
            let tileKeyForSearchConfig = null;
            for (const key in TILE_TYPES) if (TILE_TYPES[key].name === tileName) { tileKeyForSearchConfig = key; break; }
            const searchConfig = tileKeyForSearchConfig ? SEARCH_ZONE_CONFIG[tileKeyForSearchConfig] : null;

            if (!searchConfig) { UI.addChatMessage("Vous ne pouvez pas fouiller cette zone en détail.", "system"); return; }

            performTimedAction(player, ACTION_DURATIONS.SEARCH,
                () => UI.addChatMessage("Vous fouillez attentivement les environs...", "system"),
                () => {
                    if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
                        tile.actionsLeft.search_zone--;
                    } else if ((tile.type.name === TILE_TYPES.FOREST.name || tile.type.name === TILE_TYPES.PLAINS.name) && typeof tile.searchActionsLeft !== 'undefined') {
                        tile.searchActionsLeft--;
                    }

                    const rand = Math.random();
                    if (rand < searchConfig.noLootChance) { // NoLootChance applied first
                        UI.addChatMessage("Cette recherche n'a pas été fructueuse.", "system");
                    } else { // Proceed to loot tiers
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        if (availableSpace <= 0) {
                            UI.addChatMessage("Vous apercevez quelque chose, mais votre inventaire est plein !", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl); return;
                        }
                        let foundItem = null; const tierRand = Math.random(); let cumulativeChance = 0;
                        const lootTiersOrder = ['common', 'uncommon', 'rare', 'veryRare', 'offTable'];
                        for (const tier of lootTiersOrder) {
                            if (!searchConfig.lootTiers[tier] || !searchConfig.specificLoot[tier] || searchConfig.specificLoot[tier].length === 0) continue;
                            cumulativeChance += searchConfig.lootTiers[tier];
                            if (tierRand < cumulativeChance) {
                                const potentialItemsInTier = searchConfig.specificLoot[tier].filter(itemName => {
                                    const itemDef = ITEM_TYPES[itemName];
                                    if (itemDef && itemDef.teachesRecipe && itemDef.unique) {
                                        return !foundUniqueParchemins.has(itemName);
                                    }
                                    return true;
                                });
                                if (potentialItemsInTier.length > 0) {
                                    foundItem = potentialItemsInTier[Math.floor(Math.random() * potentialItemsInTier.length)];
                                    if (tier === 'offTable' && foundItem) UI.addChatMessage("Vous avez trouvé quelque chose d'inattendu !", "system_event");
                                } break;
                            }
                        }
                        if (!foundItem && tierRand >= cumulativeChance) { // Fallback to general pool if no tier hit but passed noLootChance
                             const nonParcheminFallbacks = ALL_SEARCHABLE_ITEMS.filter(item => {
                                 const itemDef = ITEM_TYPES[item];
                                 if (itemDef && itemDef.teachesRecipe && itemDef.unique) {
                                     return !foundUniqueParchemins.has(item);
                                 }
                                 return true;
                             });
                             if (nonParcheminFallbacks.length > 0) {
                                foundItem = nonParcheminFallbacks[Math.floor(Math.random() * nonParcheminFallbacks.length)];
                                UI.addChatMessage("Vous avez trouvé quelque chose d'ordinaire mais utile.", "system");
                             }
                        }
                        if (foundItem) {
                            const amountFound = 1;
                            State.addResourceToPlayer(foundItem, amountFound);
                            if (ITEM_TYPES[foundItem]?.teachesRecipe && ITEM_TYPES[foundItem]?.unique) {
                                foundUniqueParchemins.add(foundItem);
                            }
                            UI.showFloatingText(`+${amountFound} ${foundItem}`, 'gain');
                            UI.addChatMessage(`Vous avez trouvé: ${amountFound} ${foundItem} !`, 'gain'); UI.triggerActionFlash('gain');
                        } else UI.addChatMessage("Vous n'avez rien trouvé d'intéressant cette fois.", "system");
                    }
                }, updateUICallbacks );
            break;
        }
        case 'take_hidden_item': {
            if (tile.hiddenItem) {
                const itemName = tile.hiddenItem;
                 const itemDef = ITEM_TYPES[itemName];
                if (getTotalResources(player.inventory) >= player.maxInventory && (!player.inventory[itemName] || (itemDef && itemDef.unique))) {
                    UI.addChatMessage("Inventaire plein.", "system"); return;
                }
                State.addResourceToPlayer(itemName, 1);
                UI.showFloatingText(`+1 ${itemName}`, 'gain'); UI.triggerActionFlash('gain');
                UI.addChatMessage(`Vous avez trouvé : ${itemName} !`, 'gain');
                tile.hiddenItem = null;
            } else UI.addChatMessage("Il n'y a rien à prendre ici.", 'system');
            break;
        }
        case 'open_treasure': {
            if (tile.type !== TILE_TYPES.TREASURE_CHEST || tile.isOpened) {
                UI.addChatMessage("Ce n'est pas un trésor ou il a déjà été ouvert.", "system"); return;
            }
            const keyName = TILE_TYPES.TREASURE_CHEST.requiresKey;
            if (!player.inventory[keyName] || player.inventory[keyName] <= 0) {
                UI.addChatMessage(`Vous avez besoin d'une ${keyName} pour ouvrir ceci.`, "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.OPEN_TREASURE,
                () => UI.addChatMessage("Vous déverrouillez le trésor...", "system"),
                () => {
                    State.applyResourceDeduction({ [keyName]: 1 });
                    UI.addChatMessage("Le trésor s'ouvre !", "gain"); UI.triggerActionFlash('gain');
                    tile.isOpened = true;
                    for (const item in TREASURE_COMBAT_KIT) {
                        const amount = TREASURE_COMBAT_KIT[item];
                        if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                            State.addResourceToPlayer(item, amount);
                            UI.showFloatingText(`+${amount} ${item}`, 'gain');
                        } else {
                            State.dropItemOnGround(item, amount);
                            UI.addChatMessage(`${amount} ${item} déposé(s) au sol (inventaire plein).`, 'system');
                        }
                    }
                }, updateUICallbacks);
            break;
        }
        case 'use_building_action': {
            const buildingKey = data.buildingKey;
            const specificActionId = data.specificActionId;
            const buildingInstance = tile.buildings.find(b => b.key === buildingKey);

            if (!buildingInstance || buildingInstance.durability <= 0) {
                UI.addChatMessage("Ce bâtiment est inutilisable ou détruit.", "system"); return;
            }
            const buildingDef = TILE_TYPES[buildingKey];

            let actionDef = null;
            if (buildingDef.action && buildingDef.action.id === specificActionId) {
                actionDef = buildingDef.action;
            } else if (buildingDef.actions) {
                actionDef = buildingDef.actions.find(a => a.id === specificActionId);
            }

            // Handle special cases opening modals first
            if (buildingInstance.key === 'ATELIER' && specificActionId === 'use_atelier') {
                 UI.showWorkshopModal(State.state); return;
            }
            if (buildingInstance.key === 'ETABLI' && specificActionId === 'use_etabli') {
                 UI.showWorkshopModal(State.state); return; // Etabli also uses workshop modal
            }
             if (buildingInstance.key === 'FORGE' && specificActionId === 'use_forge') {
                 UI.showWorkshopModal(State.state); return; // Forge also uses workshop modal
            }


            // For actions that need a specific tool (like mining ore from MINE_TERRAIN or MINE building)
            if (specificActionId === 'search_ore_tile' || specificActionId === 'search_ore_building') {
                if (!player.equipment.weapon || player.equipment.weapon.name !== 'Pioche') {
                    UI.addChatMessage("Vous avez besoin d'une Pioche équipée pour extraire du minerai.", "system");
                    return;
                }
                performToolAction(player, 'weapon', 'mine_ore', (power, toolUsed) => {
                    if (actionDef && actionDef.results) {
                        let foundOre = false;
                        for (const oreResult of actionDef.results) {
                            if (Math.random() < oreResult.chance) {
                                const amount = Math.ceil(Math.random() * 2); // 1 or 2 ore
                                if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                                    State.addResourceToPlayer(oreResult.item, amount);
                                    UI.showFloatingText(`+${amount} ${oreResult.item}`, "gain");
                                    foundOre = true;
                                } else { UI.addChatMessage(`Inventaire plein, impossible de récupérer ${oreResult.item}.`, "system"); break; }
                            }
                        }
                        if (foundOre) UI.triggerActionFlash('gain');
                        else UI.addChatMessage("Vous n'avez trouvé aucun minerai cette fois.", "system");

                        if (buildingKey) { // If it's a MINE building, damage it
                            const bldIdx = getBuildingIndexOnTile(tile, buildingKey);
                            if (bldIdx !== -1) {
                                const damageResult = State.damageBuilding(player.x, player.y, bldIdx, 1);
                                if (damageResult.destroyed) UI.addChatMessage(`${buildingDef.name} s'est effondré !`, "system_event");
                                else UI.addChatMessage(`${buildingDef.name} perd 1 durabilité.`, "system_event");
                            }
                        }
                    }
                }, updateUICallbacks, {}, 'Pioche');
                return; // Action handled
            }


            if (!actionDef) {
                UI.addChatMessage("Définition d'action de bâtiment introuvable.", "system"); return;
            }

            // Check for required item costs (like water for plantations)
            if (actionDef.costItem && actionDef.costAmount) {
                if (!player.inventory[actionDef.costItem] || player.inventory[actionDef.costItem] < actionDef.costAmount) {
                    UI.addChatMessage(`Vous n'avez pas assez de ${actionDef.costItem} (${actionDef.costAmount} requis).`, "system"); return;
                }
            }
            // Check for multiple cost items (e.g. Laboratoire)
            if (actionDef.costItems) {
                 if (!State.hasResources(actionDef.costItems).success) {
                    UI.addChatMessage("Ressources manquantes pour cette action.", "system"); return;
                }
            }

            // Harvests for plantations/animal pens
            if (['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(specificActionId)) {
                if (!buildingInstance.harvestsAvailable || buildingInstance.harvestsAvailable <= 0) {
                    UI.addChatMessage("Rien à récolter pour le moment. Essayez d'arroser/abreuver.", "system");
                    return;
                }
            }
            // Building durability consumption
            let duration = ACTION_DURATIONS.USE_BUILDING_ACTION;
            if (specificActionId === 'generate_plan') duration = ACTION_DURATIONS.GENERATE_PLAN;
            else if (specificActionId === 'observe_weather') duration = ACTION_DURATIONS.OBSERVE_WEATHER;
            else if (specificActionId.startsWith('draw_water_')) duration = ACTION_DURATIONS.PUMP_WATER;


            performTimedAction(player, duration,
                () => UI.addChatMessage(`${actionDef.name}...`, "system"),
                () => {
                    let actionSuccess = true;
                    if (actionDef.costItem && actionDef.costAmount) State.applyResourceDeduction({ [actionDef.costItem]: actionDef.costAmount });
                    if (actionDef.costItems) State.applyResourceDeduction(actionDef.costItems);

                    if (actionDef.result) {
                        for (const item in actionDef.result) {
                            if (['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(specificActionId)) {
                                if (buildingInstance.harvestsAvailable > 0) buildingInstance.harvestsAvailable--;
                            }
                            const amount = actionDef.result[item];
                            if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                                State.addResourceToPlayer(item, amount);
                                UI.showFloatingText(`+${amount} ${item}`, "gain");
                            } else {
                                UI.addChatMessage(`Inventaire plein, impossible de récupérer ${item}.`, "system");
                                actionSuccess = false;
                                break;
                            }
                        }
                    }
                    if (actionDef.durabilityGain) buildingInstance.durability = Math.min(buildingInstance.maxDurability, buildingInstance.durability + actionDef.durabilityGain);
                    // Special cases like observe_weather or generate_plan
                    if (specificActionId === 'observe_weather') UI.addChatMessage("Le ciel est clair pour l'instant...", "system_event"); // Placeholder
                    if (specificActionId === 'generate_plan') UI.addChatMessage("Vous avez passé du temps à chercher, mais n'avez pas encore trouvé de plan clair.", "system_info"); // Placeholder, real plan gain is in config

                    if (actionSuccess) UI.triggerActionFlash('gain');

                    const bldIdx = getBuildingIndexOnTile(tile, buildingKey);
                    if (bldIdx !== -1) {
                        const damageResult = State.damageBuilding(player.x, player.y, bldIdx, 1);
                        if (damageResult.destroyed) UI.addChatMessage(`${buildingDef.name} s'est effondré !`, "system_event");
                        else UI.addChatMessage(`${buildingDef.name} perd 1 durabilité.`, "system_event");
                    }
                }, updateUICallbacks);
            break;
        }
        case 'craft_item_workshop': {
            const { recipeName, costs, yields, quantity } = data;
            let hasEnoughResources = true;
            for (const itemName in costs) {
                if ((player.inventory[itemName] || 0) < costs[itemName] * quantity) {
                    hasEnoughResources = false;
                    break;
                }
            }

            if (!hasEnoughResources) {
                UI.addChatMessage("Ressources insuffisantes pour cette fabrication.", "system_error");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }

            performTimedAction(player, ACTION_DURATIONS.CRAFT * quantity,
                () => UI.addChatMessage(`Fabrication de ${quantity}x ${recipeName}...`, "system"),
                () => {
                    for (const costItemName in costs) {
                        State.applyResourceDeduction({ [costItemName]: costs[costItemName] * quantity });
                        UI.showFloatingText(`-${costs[costItemName] * quantity} ${costItemName}`, 'cost');
                    }
                    for (const yieldItemName in yields) {
                        State.addResourceToPlayer(yieldItemName, yields[yieldItemName] * quantity);
                        UI.showFloatingText(`+${yields[yieldItemName] * quantity} ${yieldItemName}`, 'gain');
                    }
                    UI.triggerActionFlash('gain');
                    UI.addChatMessage(`${quantity}x ${recipeName} fabriqué(s) !`, 'gain');

                    // Atelier, Etabli, Forge durability loss
                    let workshopBuildingKey = null;
                    if (findBuildingOnTile(tile, 'ATELIER')) workshopBuildingKey = 'ATELIER';
                    else if (findBuildingOnTile(tile, 'ETABLI')) workshopBuildingKey = 'ETABLI';
                    else if (findBuildingOnTile(tile, 'FORGE')) workshopBuildingKey = 'FORGE';

                    if (workshopBuildingKey) {
                        const workshopBuildingIndex = tile.buildings.findIndex(b => b.key === workshopBuildingKey);
                        if (workshopBuildingIndex !== -1) {
                            const damageResult = State.damageBuilding(player.x, player.y, workshopBuildingIndex, 1 * quantity);
                            if (damageResult.destroyed) {
                                 UI.addChatMessage(`${TILE_TYPES[workshopBuildingKey].name} s'est effondré en cours de fabrication !`, "system_event");
                                 UI.hideWorkshopModal();
                            }
                        }
                    }
                    if (DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden')) {
                        UI.populateWorkshopModal(State.state);
                    }
                },
                updateUICallbacks
            );
            break;
        }
        case 'dismantle_building': {
            const buildingIndex = data.buildingIndex;
            const buildingToDismantle = tile.buildings[buildingIndex];
            if (!buildingToDismantle) { UI.addChatMessage("Bâtiment introuvable pour le démantèlement.", "system"); return; }

            if (player.hunger < 5 || player.thirst < 5 || player.sleep < 5) {
                UI.addChatMessage("Vous êtes trop épuisé pour démanteler ce bâtiment.", "system"); return;
            }

            performTimedAction(player, ACTION_DURATIONS.DISMANTLE,
                () => {
                    player.hunger -= 5; player.thirst -= 5; player.sleep -= 5;
                    UI.addChatMessage(`Démantèlement de ${TILE_TYPES[buildingToDismantle.key].name}... (-5 Faim, -5 Soif, -5 Sommeil)`, "system");
                },
                () => {
                    const result = State.dismantleBuildingOnTile(player.x, player.y, buildingIndex);
                    UI.addChatMessage(result.message, result.success ? "gain" : "system_error");
                    if (result.success) UI.triggerActionFlash('gain');
                }, updateUICallbacks);
            break;
        }
        case 'open_all_parchemins': {
            let parcheminsUsed = 0;
            let newRecipesLearned = 0;
            const tempInventoryCopy = {...player.inventory};

            for (const itemName in tempInventoryCopy) {
                const itemDef = ITEM_TYPES[itemName];
                if (itemDef && itemDef.teachesRecipe && player.inventory[itemName] > 0) {
                    const count = player.inventory[itemName];
                    for (let i = 0; i < count; i++) {
                        const result = State.consumeItem(itemName);
                        if (result.success) {
                            parcheminsUsed++;
                            if (result.message.includes("Vous avez appris")) newRecipesLearned++;
                        }
                    }
                }
            }
            if (parcheminsUsed > 0) {
                UI.addChatMessage(`${parcheminsUsed} parchemin(s) utilisé(s). ${newRecipesLearned > 0 ? `${newRecipesLearned} nouvelle(s) recette(s) apprise(s) !` : 'Aucune nouvelle recette apprise.'}`, "system_event");
                if (window.fullUIUpdate) window.fullUIUpdate();
            } else {
                UI.addChatMessage("Aucun parchemin à utiliser dans votre inventaire.", "system");
            }
            break;
        }
        // --- NOUVELLES ACTIONS ---
        case 'fire_distress_gun': {
            performToolAction(player, 'weapon', 'fire_distress_gun', (power, toolUsed) => {
                 UI.addChatMessage("Vous tirez une fusée de détresse avec le pistolet ! Le ciel s'illumine.", 'system_event');
                 // Future logic: attract rescue, NPCs, or enemies.
            }, updateUICallbacks, {}, 'Pistolet de détresse');
            break;
        }
        case 'fire_distress_flare': {
            const result = State.consumeItem('Fusée de détresse'); // Usable, one time
            UI.addChatMessage(result.message, result.success ? 'system_event' : 'system_error');
            if (result.success) {
                UI.addChatMessage("Vous allumez une fusée de détresse ! Une lueur rouge intense s'élève.", 'system_event');
                // Future logic
            }
            break;
        }
        case 'place_solar_panel_fixed': {
            const result = State.consumeItem('Panneau solaire fixe'); // Consumes item to place
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            if (result.success) {
                // In a real game, this would place a "building" or "object" on the tile.
                UI.addChatMessage("Vous installez le panneau solaire fixe. Il commence à capter l'énergie.", 'system_event');
            }
            break;
        }
        case 'charge_battery_portable_solar': {
             performToolAction(player, 'weapon', 'charge_battery_portable_solar', (power, toolUsed) => {
                if (player.inventory['Batterie déchargée'] > 0) {
                    State.applyResourceDeduction({'Batterie déchargée': 1});
                    State.addResourceToPlayer('Batterie chargée', 1);
                    UI.addChatMessage("Vous chargez une batterie avec le panneau solaire portable.", 'gain');
                } else {
                    UI.addChatMessage("Vous n'avez pas de batterie déchargée à charger.", 'system');
                }
            }, updateUICallbacks, {}, 'Panneau solaire portable');
            break;
        }
        case 'place_trap': {
            const result = State.consumeItem('Piège');
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            if (result.success) {
                 // Could place a "trap object" on the tile, which might catch small game over time.
                UI.addChatMessage("Vous posez un piège. Avec un peu de chance...", 'system_event');
            }
            break;
        }
        case 'attract_npc_attention': {
             performToolAction(player, 'weapon', 'attract_npc_attention', (power, toolUsed) => {
                UI.addChatMessage("Vous utilisez le sifflet. Un son strident retentit !", 'system_event');
                // Future: NPCs nearby might react or move towards player.
            }, updateUICallbacks, {}, 'Sifflet');
            break;
        }
        case 'find_mine_compass': {
            performToolAction(player, 'weapon', 'find_mine_compass', (power, toolUsed) => {
                UI.addChatMessage("La boussole semble pointer vers une concentration de minerais...", 'system_event');
                // Future: Reveal nearest MINE_TERRAIN or MINE building on minimap.
            }, updateUICallbacks, {}, 'Boussole');
            break;
        }
        case 'repair_building': { // Action pour Kit de réparation
            const buildingIndexToRepair = data.buildingIndex;
            if (buildingIndexToRepair === undefined || !tile.buildings[buildingIndexToRepair]) {
                UI.addChatMessage("Aucun bâtiment sélectionné à réparer.", "system"); return;
            }
            const buildingToRepair = tile.buildings[buildingIndexToRepair];
            const buildingDefToRepair = TILE_TYPES[buildingToRepair.key];

            if (buildingToRepair.durability >= buildingToRepair.maxDurability) {
                UI.addChatMessage(`${buildingDefToRepair.name} n'a pas besoin de réparation.`, "system"); return;
            }

            performToolAction(player, 'weapon', 'repair_building', (power, toolUsed) => {
                if (toolUsed && toolUsed.name === 'Kit de réparation') {
                    const repairAmount = 20; // ou une valeur plus dynamique
                    buildingToRepair.durability = Math.min(buildingToRepair.maxDurability, buildingToRepair.durability + repairAmount);
                    UI.addChatMessage(`${buildingDefToRepair.name} réparé de ${repairAmount} points. Durabilité: ${buildingToRepair.durability}/${buildingToRepair.maxDurability}`, 'gain');
                } else {
                     UI.addChatMessage("Vous avez besoin d'un Kit de réparation équipé.", "system");
                }
            }, updateUICallbacks, {}, 'Kit de réparation');
            break;
        }


        case 'open_large_map': { UI.showLargeMap(State.state); break; }
        case 'talk_to_npc': { if (data.npcId) npcInteractionHandler(data.npcId); break; }
        case 'open_building_inventory': { UI.showInventoryModal(State.state); break; }
        default: UI.addChatMessage(`Action "${actionId}" non reconnue.`, 'system_error');
    }
}