// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';
import { findEnemyOnTile } from './enemy.js';
import DOM from './ui/dom.js';
import { handleNpcInteraction as npcInteractionHandler } from './npc.js';

function applyActionCosts(player, costs) {
    let floatingTextParts = [];
    if (costs.thirst && player.thirst > 0) { 
        player.thirst = Math.max(0, player.thirst - costs.thirst);
        // floatingTextParts.push(`-${costs.thirst}💧`); // MODIFIÉ (Point 23)
    }
    if (costs.hunger && player.hunger > 0) { 
        player.hunger = Math.max(0, player.hunger - costs.hunger);
        // floatingTextParts.push(`-${costs.hunger}🍗`); // MODIFIÉ (Point 23)
    }
    if (costs.sleep && player.sleep > 0) { 
        player.sleep = Math.max(0, player.sleep - costs.sleep);
        // floatingTextParts.push(`-${costs.sleep}🌙`); // MODIFIÉ (Point 23)
    }
    // if(floatingTextParts.length > 0) UI.showFloatingText(floatingTextParts.join(' '), 'cost'); // MODIFIÉ (Point 23)
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
    const rand = Math.random();
    let selectedStatChoice = null;
    if (rand < 0.10 && player.thirst > 0) selectedStatChoice = availableStats.find(s => s.name === 'thirst');
    else if (rand < 0.50 && player.hunger > 0) selectedStatChoice = availableStats.find(s => s.name === 'hunger');
    else if (player.sleep > 0) selectedStatChoice = availableStats.find(s => s.name === 'sleep');
    if (!selectedStatChoice && availableStats.length > 0) selectedStatChoice = availableStats[Math.floor(Math.random() * availableStats.length)];
    if (selectedStatChoice) {
        chosenStatName = selectedStatChoice.name;
        statIcon = selectedStatChoice.icon;
        player[chosenStatName] = Math.max(0, player[chosenStatName] - amount);
        // const costText = `-${amount}${statIcon}`; // MODIFIÉ (Point 23)
        // UI.showFloatingText(costText, 'cost'); // MODIFIÉ (Point 23)
        const maxStatValue = player[`max${chosenStatName.charAt(0).toUpperCase() + chosenStatName.slice(1)}`];
        if (player[chosenStatName] <= (maxStatValue * 0.1) && player[chosenStatName] > 0 ) UI.addChatMessage(`Attention, votre ${chosenStatName} est très basse !`, "warning");
    }
    return true;
}

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks, actionData = {}) {
    if (player.isBusy || player.animationState) {
        console.warn("[performTimedAction] Joueur occupé ou en animation, action annulée.");
        return;
    }
    console.log(`[performTimedAction] Démarrage action. Durée: ${duration}ms`);
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

function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks, actionData = {}) {
    const tool = player.equipment[toolSlot];

    if (actionType !== null) { 
        const requiredToolName = actionData.actionIdForToolCheck === 'harvest_wood_hache' ? 'Hache' 
                              : (actionData.actionIdForToolCheck === 'harvest_wood_scie' ? 'Scie' : null);
        
        let toolMatchesAction = false;
        if (tool && tool.action === actionType) { 
             toolMatchesAction = true;
        }
        if (requiredToolName && tool && tool.name === requiredToolName) { 
            toolMatchesAction = true;
        } else if (requiredToolName === null && actionType === null) { 
            toolMatchesAction = true; 
        }

        if (!toolMatchesAction && requiredToolName) {
             UI.addChatMessage(`Vous n'avez pas le bon outil (${requiredToolName}) équipé.`, 'system');
             if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
             else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
             return;
        } else if (!toolMatchesAction && actionType !== null) { 
            UI.addChatMessage(`Vous n'avez pas le bon outil équipé (${tool ? tool.name : 'aucun'}) ou il ne convient pas pour cette action.`, 'system');
             if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
             else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
             return;
        }
    }

    performTimedAction(player, ACTION_DURATIONS.HARVEST, 
        () => UI.addChatMessage(`Utilisation de ${tool ? tool.name : 'vos mains'}...`, 'system'),
        () => {
            onComplete(tool ? tool.power : 1); 
            if (tool && tool.hasOwnProperty('currentDurability') && typeof tool.currentDurability === 'number') {
                tool.currentDurability--;
                if (tool.currentDurability <= 0) {
                    UI.addChatMessage(`${tool.name} s'est cassé !`, 'system_warning');
                    State.state.player.equipment[toolSlot] = null;
                }
            } else if (tool && tool.hasOwnProperty('uses')) { 
                 tool.uses--;
                 if (tool.uses <= 0) {
                     UI.addChatMessage(`${tool.name} est épuisé !`, 'system_warning');
                     State.state.player.equipment[toolSlot] = null;
                 }
            }
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
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
            player.equipment.weapon = null;
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
    const { player, map, activeEvent, combatState, enemies, knownRecipes } = State.state;
    console.log(`[handlePlayerAction] Action: ${actionId}, Data:`, JSON.stringify(data));
    if (combatState && actionId !== 'combat_action') {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", "system");
        return;
    }
    const tile = map[player.y][player.x];
    let shouldApplyBaseCost = true;
    switch(actionId) {
        case 'sleep': case 'initiate_combat': case 'take_hidden_item': case 'open_treasure':
        case 'use_building_action': case 'consume_eau_salee': case 'open_large_map':
        case 'talk_to_npc': case 'drop_item_prompt': case 'open_building_inventory':
        case 'plant_tree': // MODIFIÉ (Point 8)
            shouldApplyBaseCost = false;
            break;
    }
    if (shouldApplyBaseCost) applyRandomStatCost(player, 1, actionId);

    let buildingToDamageIndex = -1;
    if (data && data.buildingKeyForDamage) buildingToDamageIndex = getBuildingIndexOnTile(tile, data.buildingKeyForDamage);

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
        case 'consume_eau_salee': { // MODIFIÉ (Point 6 & 7)
            if (player.inventory['Eau salée'] > 0) {
                const result = State.consumeItem('Eau salée');
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                if (result.success && result.floatingTexts) {
                    result.floatingTexts.forEach(text => {
                         if (!text.startsWith('+1💧')) { // Ne pas afficher le +1 soif pour l'eau salée
                             UI.showFloatingText(text, text.startsWith('-') ? 'cost' : 'info')
                         }
                    });
                }
            } else {
                UI.addChatMessage("Vous n'avez plus d'Eau salée.", "system");
            }
            break;
        }
        case 'harvest': {
            const resource = tile.type.resource;
            if (!resource) { console.warn("[handlePlayerAction - harvest] Pas de ressource sur cette tuile."); return; }
            
            if (resource.type === 'Eau salée') { // MODIFIÉ (Point 7)
                 performTimedAction(player, ACTION_DURATIONS.HARVEST,
                    () => UI.addChatMessage(`Récolte d'Eau salée...`, "system"),
                    () => {
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        if (availableSpace > 0) {
                            State.addResourceToPlayer('Eau salée', 1);
                            UI.showFloatingText(`+1 Eau salée`, 'gain'); UI.triggerActionFlash('gain');
                        } else {
                            UI.addChatMessage("Inventaire plein, impossible de récolter l'eau salée.", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                        }
                    }, updateUICallbacks );
                return;
            }

            const specificResourceCosts = { thirst: resource.thirstCost || 0, hunger: resource.hungerCost || 0, sleep: resource.sleepCost || 0 };
            let canProceed = true;
            if (specificResourceCosts.thirst > 0 && player.thirst === 0) canProceed = false;
            if (specificResourceCosts.hunger > 0 && player.hunger === 0) canProceed = false;
            if (specificResourceCosts.sleep > 0 && player.sleep === 0) canProceed = false;
            if (!canProceed) { UI.addChatMessage("Vous êtes trop épuisé pour cette récolte.", "system"); return; }
            
            applyActionCosts(player, specificResourceCosts); // Applique les coûts spécifiques avant l'action
            
            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`Récolte de ${resource.type}...`, "system"),
                () => {
                    let finalYield = (activeEvent && activeEvent.type === 'Abondance' && activeEvent.data && activeEvent.data.resource === resource.type) ? resource.yield * 2 : resource.yield;
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace, tile.harvestsLeft === Infinity ? Infinity : tile.harvestsLeft);
                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        if(tile.harvestsLeft !== Infinity) tile.harvestsLeft -= amountToHarvest;
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain'); UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        else if (amountToHarvest < finalYield) UI.addChatMessage("Récolte partielle due à la limite de la zone ou de l'inventaire.", "system");
                        if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, 'WASTELAND');
                            UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                        }
                    } else {
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : (tile.harvestsLeft <=0 && tile.type.harvests !== Infinity ? "Plus rien à récolter ici." : "Impossible de récolter."), "system");
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks );
            break;
        }
        case 'harvest_wood_hache': // MODIFIÉ (Point 1)
        case 'harvest_wood_scie':  // MODIFIÉ (Point 1)
        case 'harvest_wood_mains': { // MODIFIÉ (Point 1)
            performToolAction(player, 'weapon', 
                actionId === 'harvest_wood_hache' ? 'harvest_wood' : (actionId === 'harvest_wood_scie' ? 'harvest_wood' : null), 
                (powerOverride) => { 
                    const forestTile = map[player.y][player.x];
                    if (forestTile.type.name !== TILE_TYPES.FOREST.name || forestTile.harvestsLeft <= 0) { 
                        UI.addChatMessage("Plus de bois à couper/ramasser ici ou ce n'est pas une forêt.", "system"); return; 
                    }
                    
                    let woodYield = 1; 
                    let toolUsedName = "vos mains";
                    const tool = player.equipment.weapon;

                    if (actionId === 'harvest_wood_hache') {
                        if (tool && tool.name === 'Hache') {
                            woodYield = 3; 
                            toolUsedName = tool.name;
                        } else {
                             UI.addChatMessage("Vous avez besoin d'une Hache équipée.", "system"); return;
                        }
                    } else if (actionId === 'harvest_wood_scie') {
                        if (tool && tool.name === 'Scie') {
                            woodYield = 5; 
                            toolUsedName = tool.name;
                        } else {
                             UI.addChatMessage("Vous avez besoin d'une Scie équipée.", "system"); return;
                        }
                    }
                    
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(woodYield, availableSpace, forestTile.harvestsLeft === Infinity ? Infinity : forestTile.harvestsLeft);
                    
                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Bois', amountToHarvest);
                        if(forestTile.harvestsLeft !== Infinity) forestTile.harvestsLeft -= amountToHarvest;
                        UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain'); UI.triggerActionFlash('gain');
                        UI.addChatMessage(`Vous obtenez ${amountToHarvest} Bois avec ${toolUsedName}.`, 'system');
                        if (amountToHarvest < woodYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle de bois.", "system");
                        
                        if (forestTile.harvestsLeft <= 0 && forestTile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, 'WASTELAND'); UI.addChatMessage("Cette forêt est épuisée.", "system");
                        }
                    } else {
                         UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter du bois.", "system");
                         if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, 
                updateUICallbacks,
                { actionIdForToolCheck: actionId } 
            );
            break;
        }
        case 'fish': {
            performToolAction(player, 'weapon', 'fish', (power) => {
                const fishCaught = Math.ceil(Math.random() * power);
                if (fishCaught > 0) {
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToAdd = Math.min(fishCaught, availableSpace);
                    if (amountToAdd > 0) {
                        State.addResourceToPlayer('Poisson cru', amountToAdd);
                        UI.showFloatingText(`+${amountToAdd} Poisson cru`, 'gain'); UI.triggerActionFlash('gain');
                        if (amountToAdd < fishCaught) UI.addChatMessage("Inventaire plein, une partie du poisson a été relâchée.", "system");
                    } else {
                        UI.addChatMessage("Inventaire plein, impossible de garder le poisson.", "system");
                        if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                } else UI.addChatMessage("Ça ne mord pas aujourd'hui...", "system");
            }, updateUICallbacks);
            break;
        }
        case 'hunt': {
             const weapon = player.equipment.weapon;
             if (!weapon) { UI.addChatMessage("Vous ne pouvez pas chasser sans arme.", "system"); return; }
             performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) {
                        const baseAmount = (weapon.stats?.damage || weapon.power || 1);
                        const amount = baseAmount * (Math.floor(Math.random() * 2) + 1);
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(amount, availableSpace);
                        if(amountToAdd > 0) {
                            State.addResourceToPlayer('Viande crue', amountToAdd);
                            UI.showFloatingText(`+${amountToAdd} Viande crue`, "gain"); UI.triggerActionFlash('gain');
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
                            player.equipment.weapon = null;
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
            const toolRequiredArray = costs.toolRequired; delete costs.toolRequired;
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes pour construire.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); return;
            }
            if (toolRequiredArray) {
                const hasRequiredTool = toolRequiredArray.some(toolName => player.equipment.weapon && player.equipment.weapon.name === toolName);
                if (!hasRequiredTool) { UI.addChatMessage(`Outil requis non équipé : ${toolRequiredArray.join(' ou ')}.`, "system"); return; }
            }
            if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) { UI.addChatMessage("Nombre maximum de bâtiments atteint sur cette tuile.", "system"); return; }
            if (!tile.type.buildable) { UI.addChatMessage("Vous ne pouvez pas construire sur ce type de terrain.", "system"); return; }
            if (tile.type.name !== TILE_TYPES.PLAINS.name && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE' && structureKey !== 'PETIT_PUIT') { // Ajout PETIT_PUIT
                UI.addChatMessage("Ce bâtiment ne peut être construit que sur une Plaine.", "system"); return; 
            }
            performTimedAction(player, ACTION_DURATIONS.BUILD,
                () => UI.addChatMessage(`Construction de ${structureType.name}...`, "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    for (const item in costs) UI.showFloatingText(`-${costs[item]} ${item}`, 'cost');
                    const buildResult = State.addBuildingToTile(player.x, player.y, structureKey);
                    UI.addChatMessage(buildResult.message, buildResult.success ? "gain" : "system");
                    if(buildResult.success) UI.triggerActionFlash('gain');
                }, updateUICallbacks );
            break;
        }
        case 'regenerate_forest': { /* ... */ break; }
        case 'plant_tree': { // MODIFIÉ (Point 8)
            if (tile.type.name !== TILE_TYPES.PLAINS.name) {
                UI.addChatMessage("Vous ne pouvez planter un arbre que sur une Plaine.", "system"); return;
            }
            if (tile.buildings.length > 0) { // MODIFIÉ (Point 21)
                UI.addChatMessage("Vous ne pouvez pas planter d'arbre sur une tuile avec des constructions.", "system"); return;
            }
            const costs = { 'Graine d\'arbre': 5, 'Eau pure': 1 };
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes pour planter l'arbre.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); return;
            }
            performTimedAction(player, ACTION_DURATIONS.PLANT_TREE,
                () => UI.addChatMessage("Vous plantez un jeune arbre...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    for (const item in costs) UI.showFloatingText(`-${costs[item]} ${item}`, 'cost');
                    State.updateTileType(player.x, player.y, 'FOREST');
                    UI.addChatMessage("Un jeune arbre a pris racine, transformant la plaine en forêt !", "gain");
                    UI.triggerActionFlash('gain');
                    applyRandomStatCost(player, 1, "planter arbre"); 
                }, updateUICallbacks );
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
        case 'cook': {
            const campfire = findBuildingOnTile(tile, 'CAMPFIRE');
            if (!campfire) { UI.addChatMessage("Vous avez besoin d'un feu de camp pour cuisiner.", "system"); return; }
            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite', 'Oeuf cru': 'Oeuf cuit' };
            const rawMaterial = data.raw; const cookedItem = cookable[rawMaterial];
            if (!rawMaterial || !cookedItem) { UI.addChatMessage("Ingrédient de cuisine invalide.", "system"); return; }
            if (!State.hasResources({ [rawMaterial]: 1, 'Bois': 1 }).success) {
                UI.addChatMessage(`Ressources insuffisantes pour cuisiner ${rawMaterial}.`, "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage(`Cuisson de ${rawMaterial}...`, "system"),
                () => {
                    State.applyResourceDeduction({ [rawMaterial]: 1, 'Bois': 1 });
                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); UI.triggerActionFlash('gain');
                    const bldIndex = getBuildingIndexOnTile(tile, 'CAMPFIRE');
                    if(bldIndex !== -1) {
                         const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                         UI.addChatMessage(`Feu de Camp perd 1 durabilité.`, "system_event");
                        if (damageResult.destroyed) UI.addChatMessage(`${damageResult.name} s'est éteint et effondré !`, "system_event");
                    }
                }, updateUICallbacks );
            break;
        }
        case 'search_zone': {
            const tileName = tile.type.name;
            let tileKeyForSearch = null;
            for (const key in TILE_TYPES) if (TILE_TYPES[key].name === tileName) { tileKeyForSearch = key; break; }
            const searchConfig = tileKeyForSearch ? SEARCH_ZONE_CONFIG[tileKeyForSearch] : null;
            if (!searchConfig) { UI.addChatMessage("Vous ne pouvez pas fouiller cette zone en détail.", "system"); return; }
            
            performTimedAction(player, ACTION_DURATIONS.SEARCH,
                () => UI.addChatMessage("Vous fouillez attentivement les environs...", "system"),
                () => {
                    const rand = Math.random();
                    if (rand < searchConfig.combatChance) {
                        UI.addChatMessage("Quelque chose surgit des ombres !", "system_event");
                        const enemyTemplate = ENEMY_TYPES[searchConfig.enemyType];
                        if (enemyTemplate) {
                            const encounterEnemy = {
                                id: `enemy_search_${Date.now()}_${Math.random()}`,
                                ...JSON.parse(JSON.stringify(enemyTemplate)),
                                x: player.x, y: player.y,
                                currentHealth: enemyTemplate.health,
                                isSearchEncounter: true 
                            };
                            State.startCombat(player, encounterEnemy); 
                            UI.showCombatModal(State.state.combatState);
                        } else UI.addChatMessage("...mais ce n'était rien d'alarmant.", "system_event");
                    } else if (rand < searchConfig.combatChance + searchConfig.noLootChance) {
                        UI.addChatMessage("Cette recherche n'a pas été fructueuse.", "system");
                    } else {
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
                                    if (itemName.startsWith('Parchemin Atelier')) {
                                        const itemDef = ITEM_TYPES[itemName];
                                        return !(itemDef && itemDef.teachesRecipe && knownRecipes[itemDef.teachesRecipe]);
                                    } return true;
                                });
                                if (potentialItemsInTier.length > 0) {
                                    foundItem = potentialItemsInTier[Math.floor(Math.random() * potentialItemsInTier.length)];
                                    if (tier === 'offTable' && foundItem) UI.addChatMessage("Vous avez trouvé quelque chose d'inattendu !", "system_event");
                                } break;
                            }
                        }
                        if (!foundItem && tierRand >= cumulativeChance) {
                             const nonParcheminFallbacks = ALL_SEARCHABLE_ITEMS.filter(item => !item.startsWith('Parchemin Atelier') || (item.startsWith('Parchemin Atelier') && !(ITEM_TYPES[item]?.teachesRecipe && knownRecipes[ITEM_TYPES[item].teachesRecipe])));
                             if (nonParcheminFallbacks.length > 0) {
                                foundItem = nonParcheminFallbacks[Math.floor(Math.random() * nonParcheminFallbacks.length)];
                                UI.addChatMessage("Vous avez trouvé quelque chose d'ordinaire mais utile.", "system");
                             }
                        }
                        if (foundItem) {
                            const amountFound = 1;
                            State.addResourceToPlayer(foundItem, amountFound);
                            UI.showFloatingText(`+${amountFound} ${foundItem}`, 'gain');
                            UI.addChatMessage(`Vous avez trouvé: ${amountFound} ${foundItem} !`, 'gain'); UI.triggerActionFlash('gain');
                        } else UI.addChatMessage("Vous n'avez rien trouvé d'intéressant cette fois.", "system");
                    }
                }, updateUICallbacks );
            break;
        }
        case 'take_hidden_item': { /* ... */ break; }
        case 'open_treasure': { /* ... */ break; }
        case 'use_building_action': { /* ... */ break; }
        case 'open_large_map': { /* ... */ break; }
        case 'talk_to_npc': { if (data.npcId) npcInteractionHandler(data.npcId); break; }
        // case 'drop_item_prompt': // MODIFIÉ (Point 25) - Supprimé
        case 'open_building_inventory': { 
            UI.showInventoryModal(State.state);
            break;
        }
    }
}