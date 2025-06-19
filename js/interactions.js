// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js'; 
import { findEnemyOnTile } from './enemy.js';
import DOM from './ui/dom.js';

// ... applyActionCosts, applyRandomStatCost ... (inchangés)
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

function applyRandomStatCost(player, amount = 1, actionNameForLog = "") {
    const statsToCost = ['thirst', 'hunger', 'sleep'];
    const chosenStat = statsToCost[Math.floor(Math.random() * statsToCost.length)];
    let costText = '';
    let statIcon = '';

    switch (chosenStat) {
        case 'thirst':
            player.thirst = Math.max(0, player.thirst - amount);
            statIcon = '💧';
            break;
        case 'hunger':
            player.hunger = Math.max(0, player.hunger - amount);
            statIcon = '🍗';
            break;
        case 'sleep':
            player.sleep = Math.max(0, player.sleep - amount);
            statIcon = '🌙';
            break;
    }
    costText = `-${amount}${statIcon}`;
    
    if (costText) {
        UI.showFloatingText(costText, 'cost');
    }
        
    if (player.thirst <= 0 && player.hunger <= 0 && player.sleep <= 0) {
         UI.addChatMessage("Vous êtes complètement épuisé !", "warning");
         return false; 
    }
    if (player[chosenStat] <= (player[`max${chosenStat.charAt(0).toUpperCase() + chosenStat.slice(1)}`] * 0.1) && player[chosenStat] > 0 ) { 
        UI.addChatMessage(`Attention, votre ${chosenStat} est très basse !`, "warning");
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
    if(typeof onStart === 'function') onStart(); // Vérifier si c'est une fonction
    
    if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
        updateUICallbacks.updatePossibleActions();
    }
    if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) {
        UI.updateAllButtonsState(State.state); 
    }

    setTimeout(() => {
        console.log("[performTimedAction] Timeout terminé. Exécution de onComplete.");
        if(typeof onComplete === 'function') onComplete(actionData); // Vérifier et passer actionData
        player.isBusy = false;
        console.log("[performTimedAction] Joueur n'est plus occupé.");
        if (updateUICallbacks && updateUICallbacks.updateAllUI) {
            updateUICallbacks.updateAllUI(); 
        }
        if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
            updateUICallbacks.updatePossibleActions();
        }
        if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) {
            UI.updateAllButtonsState(State.state);
        }
    }, duration);
}

function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks) {
    const tool = player.equipment[toolSlot];
    console.log("[performToolAction] Outil récupéré:", JSON.stringify(tool), "Action attendue:", actionType);

    if (!tool || tool.action !== actionType) {
        console.error("[performToolAction] ERREUR: Outil non trouvé ou action incorrecte.", "Outil:", JSON.stringify(tool), "Action de l'outil:", tool ? tool.action : "N/A", "Action attendue:", actionType);
        UI.addChatMessage(`Vous n'avez pas le bon outil équipé (${tool ? tool.name : 'aucun'}) ou il ne convient pas pour cette action.`, 'system');
        if (DOM.equipmentSlotsEl) { 
            UI.triggerShake(DOM.equipmentSlotsEl);
        } else if (DOM.quickSlotsPanel) { 
            UI.triggerShake(DOM.quickSlotsPanel); 
        }
        return;
    }

    console.log("[performToolAction] Outil correct, lancement de performTimedAction pour", actionType);
    performTimedAction(player, ACTION_DURATIONS.HARVEST, 
        () => { // onStart de performTimedAction
            console.log("[performToolAction -> performTimedAction] onStart: Utilisation de", tool.name);
            UI.addChatMessage(`Utilisation de ${tool.name}...`, 'system');
        },
        () => { // onComplete de performTimedAction
            console.log("[performToolAction -> performTimedAction] onComplete: Exécution du callback de l'action outil.");
            onComplete(tool.power); // Appel du onComplete passé à performToolAction (ex: celui qui ajoute le bois)

            if (tool.hasOwnProperty('currentDurability')) { 
                tool.currentDurability--;
                console.log(`[performToolAction] Durabilité de ${tool.name} réduite à ${tool.currentDurability}`);
                if (tool.currentDurability <= 0) {
                    UI.addChatMessage(`${tool.name} s'est cassé !`, 'system_warning');
                    State.state.player.equipment[toolSlot] = null; 
                }
            }
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
            UI.updateQuickSlots(player); 
            // Important: Il faut aussi rafraîchir les actions possibles car l'outil peut s'être cassé
            if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
                updateUICallbacks.updatePossibleActions();
            }
        },
        updateUICallbacks
    );
}

// ... (handleCombatAction, playerAttack, playerFlee, enemyAttack - inchangés)
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
    
    if (weapon && weapon.hasOwnProperty('currentDurability')) {
        weapon.currentDurability--;
        if (weapon.currentDurability <= 0) {
            combatState.log.unshift(`${weapon.name} s'est cassé !`);
            player.equipment.weapon = null; 
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
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
        if (State.state.player) { 
            if (window.fullUIUpdate) window.fullUIUpdate(); else UI.updateAllUI(State.state);
        }
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
        if (window.fullUIUpdate) window.fullUIUpdate(); else UI.updateAllUI(State.state);

    } else {
        combatState.log.unshift("Votre tentative de fuite a échoué !");
        UI.updateCombatUI(combatState);
    }
}

function enemyAttack() {
    const { combatState, player } = State.state;
    if (!combatState) return; 
    
    const defense = (player.equipment.body?.stats?.defense || 0) + (player.equipment.head?.stats?.defense || 0) + (player.equipment.feet?.stats?.defense || 0);
    const damageTaken = Math.max(0, combatState.enemy.damage - defense);

    player.health = Math.max(0, player.health - damageTaken);
    combatState.log.unshift(`${combatState.enemy.name} vous inflige ${damageTaken} dégâts.`);

    if (player.health <= 0) {
        combatState.log.unshift("Vous avez été vaincu...");
    }
    
    UI.updateCombatUI(combatState); 
    if (window.fullUIUpdate) {
        window.fullUIUpdate(); 
    } else {
        UI.updateAllUI(State.state); 
    }
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
    const { player, map, activeEvent, combatState, enemies } = State.state;
    console.log(`[handlePlayerAction] Action: ${actionId}, Data:`, JSON.stringify(data)); // Log au début

    if (combatState && actionId !== 'combat_action') { // Permettre les actions de combat
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", "system");
        return;
    }
    const tile = map[player.y][player.x];

    let shouldApplyBaseCost = true;
    switch(actionId) {
        case 'sleep':
        case 'initiate_combat': 
        case 'take_hidden_item': 
        case 'open_treasure':
        case 'build_structure':
        case 'use_building_action':
            shouldApplyBaseCost = false;
            break;
    }

    if (shouldApplyBaseCost) {
        if (!applyRandomStatCost(player, 1, actionId)) { 
            // return; 
        }
    }

    let buildingToDamageIndex = -1;
    if (data && data.buildingKeyForDamage) {
        buildingToDamageIndex = getBuildingIndexOnTile(tile, data.buildingKeyForDamage);
    }

    switch(actionId) {
        case 'initiate_combat': {
            const enemy = findEnemyOnTile(player.x, player.y, enemies);
            if (enemy) {
                State.startCombat(player, enemy);
                UI.showCombatModal(State.state.combatState);
                if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
                    updateUICallbacks.updatePossibleActions();
                }
            } else {
                UI.addChatMessage("Il n'y a plus rien à attaquer ici.", "system");
            }
            break;
        }

        case 'harvest': { // Récolte de ressource du terrain
            const resource = tile.type.resource;
            if (!resource) {
                console.warn("[handlePlayerAction - harvest] Pas de ressource sur cette tuile de terrain.");
                return;
            }
            
            const specificResourceCosts = {
                thirst: resource.thirstCost || 0,
                hunger: resource.hungerCost || 0,
                sleep: resource.sleepCost || 0,
            };
            if (player.thirst < specificResourceCosts.thirst || player.hunger < specificResourceCosts.hunger || player.sleep < specificResourceCosts.sleep) {
                UI.addChatMessage("Vous êtes trop épuisé pour cette récolte spécifique.", "system");
                return; 
            }
            applyActionCosts(player, specificResourceCosts); 

            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage(`Récolte de ${resource.type}...`, "system"), 
                () => { 
                    let finalYield = (activeEvent && activeEvent.type === 'Abondance' && activeEvent.data && activeEvent.data.resource === resource.type) ? resource.yield * 2 : resource.yield;
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace, tile.harvestsLeft === Infinity ? Infinity : tile.harvestsLeft);


                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        if(tile.harvestsLeft !== Infinity) tile.harvestsLeft -= amountToHarvest;
                        
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain');
                        UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        else if (amountToHarvest < finalYield) UI.addChatMessage("Récolte partielle due à la limite de la zone ou de l'inventaire.", "system");

                        if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, 'WASTELAND'); // Passer la clé du type de terrain
                            UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                        }
                    } else { 
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : (tile.harvestsLeft <=0 && tile.type.harvests !== Infinity ? "Plus rien à récolter ici." : "Impossible de récolter."), "system"); 
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, 
                updateUICallbacks
            );
            break;
        }
        
        case 'harvest_wood': {
            console.log("[handlePlayerAction] Tentative de harvest_wood");
            performToolAction(player, 'weapon', 'harvest_wood', (power) => {
                console.log("[handlePlayerAction - harvest_wood callback] Récolte de bois, puissance:", power);
                // La tuile Forêt a aussi 'harvestsLeft', il faut la gérer comme pour 'harvest'
                const forestTile = map[player.y][player.x];
                if (forestTile.type.name !== TILE_TYPES.FOREST.name || forestTile.harvestsLeft <= 0) {
                    UI.addChatMessage("Plus de bois à couper ici ou ce n'est pas une forêt.", "system");
                    return;
                }
                 const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                 const amountToHarvest = Math.min(power, availableSpace, forestTile.harvestsLeft === Infinity ? Infinity : forestTile.harvestsLeft);

                if (amountToHarvest > 0) {
                    State.addResourceToPlayer('Bois', amountToHarvest);
                     if(forestTile.harvestsLeft !== Infinity) forestTile.harvestsLeft -= amountToHarvest;

                    UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain');
                    UI.triggerActionFlash('gain');
                    if (amountToHarvest < power && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle de bois.", "system");

                    if (forestTile.harvestsLeft <= 0 && forestTile.type.harvests !== Infinity) {
                        State.updateTileType(player.x, player.y, 'WASTELAND');
                        UI.addChatMessage("Cette forêt est épuisée.", "system");
                    }
                } else {
                     UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter du bois.", "system"); 
                     if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                }

            }, updateUICallbacks);
            break;
        }

        case 'fish': { // Similaire, vérifier la tuile pour les ressources de pêche si applicable
            performToolAction(player, 'weapon', 'fish', (power) => {
                const fishCaught = Math.ceil(Math.random() * power); 
                if (fishCaught > 0) {
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToAdd = Math.min(fishCaught, availableSpace);
                    if (amountToAdd > 0) {
                        State.addResourceToPlayer('Poisson cru', amountToAdd);
                        UI.showFloatingText(`+${amountToAdd} Poisson cru`, 'gain');
                        UI.triggerActionFlash('gain');
                        if (amountToAdd < fishCaught) UI.addChatMessage("Inventaire plein, une partie du poisson a été relâchée.", "system");
                    } else {
                        UI.addChatMessage("Inventaire plein, impossible de garder le poisson.", "system");
                         if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                } else {
                    UI.addChatMessage("Ça ne mord pas aujourd'hui...", "system");
                }
            }, updateUICallbacks);
            break;
        }

        case 'hunt': {
             const weapon = player.equipment.weapon;
             if (!weapon) {
                 UI.addChatMessage("Vous ne pouvez pas chasser sans arme.", "system");
                 return;
             }
             performTimedAction(player, ACTION_DURATIONS.CRAFT,  // CRAFT est peut-être long pour chasser
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => { 
                    if (Math.random() < 0.6) { 
                        const baseAmount = (weapon.stats?.damage || weapon.power || 1);
                        const amount = baseAmount * (Math.floor(Math.random() * 2) + 1); 
                        
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(amount, availableSpace);

                        if(amountToAdd > 0) {
                            State.addResourceToPlayer('Viande crue', amountToAdd);
                            UI.showFloatingText(`+${amountToAdd} Viande crue`, "gain");
                            UI.triggerActionFlash('gain');
                             if (amountToAdd < amount) UI.addChatMessage("Inventaire plein, une partie de la chasse a été laissée.", "system");
                        } else {
                            UI.addChatMessage("Inventaire plein, impossible de ramener la viande.", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                        }
                    } else {
                        UI.addChatMessage("La chasse n'a rien donné.", "system");
                    }
                    if (weapon.hasOwnProperty('currentDurability')) {
                        weapon.currentDurability--;
                        if (weapon.currentDurability <= 0) {
                            UI.addChatMessage(`${weapon.name} s'est cassé !`, 'system_warning');
                            player.equipment.weapon = null;
                            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                                UI.updateEquipmentModal(State.state);
                            }
                             UI.updateQuickSlots(player);
                        }
                    }
                },
                updateUICallbacks
            );
            break;
        }
        
        // BUILD A ÉTÉ REMPLACÉ PAR build_structure
        // case 'build': { ... }

        case 'build_structure': { // Logique déplacée ici depuis main.js
            const structureKey = data.structureKey;
            const structureType = TILE_TYPES[structureKey];
            if (!structureType) {
                UI.addChatMessage("Type de structure inconnu.", "system");
                return;
            }

            const costs = { ...structureType.cost }; 
            const toolRequiredArray = costs.toolRequired;
            delete costs.toolRequired; 

            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes pour construire.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            if (toolRequiredArray) {
                const hasRequiredTool = toolRequiredArray.some(toolName => 
                    player.equipment.weapon && player.equipment.weapon.name === toolName
                );
                if (!hasRequiredTool) {
                    UI.addChatMessage(`Outil requis non équipé : ${toolRequiredArray.join(' ou ')}.`, "system");
                    return;
                }
            }
            
             if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) {
                UI.addChatMessage("Nombre maximum de bâtiments atteint sur cette tuile.", "system");
                return;
            }
            if (!tile.type.buildable) {
                UI.addChatMessage("Vous ne pouvez pas construire sur ce type de terrain.", "system");
                return;
            }
            if (tile.type.name !== TILE_TYPES.PLAINS.name && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE') {
                 UI.addChatMessage("Ce bâtiment ne peut être construit que sur une Plaine.", "system");
                 return;
            }

            performTimedAction(player, ACTION_DURATIONS.BUILD,
                () => UI.addChatMessage(`Construction de ${structureType.name}...`, "system"),
                () => {
                    State.applyResourceDeduction(costs); 
                    for (const item in costs) {
                        UI.showFloatingText(`-${costs[item]} ${item}`, 'cost');
                    }
                    const buildResult = State.addBuildingToTile(player.x, player.y, structureKey);
                    UI.addChatMessage(buildResult.message, buildResult.success ? "gain" : "system");
                    if(buildResult.success) UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;
        }
        
        case 'dig_mine': { // Devient une action de construction pour la MINE
             handlePlayerAction('build_structure', { structureKey: 'MINE' }, updateUICallbacks);
            break;
        }


        case 'regenerate_forest': { // Modifier pour prendre en compte le terrain
            const costs = TILE_TYPES.WASTELAND.regeneration.cost;
            if (tile.type.name !== TILE_TYPES.WASTELAND.name) {
                UI.addChatMessage("Cette action ne peut être effectuée que sur une Friche.", "system");
                return;
            }
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Vous n'avez pas assez d'eau pour fertiliser cette terre.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage("Vous travaillez la terre...", "system"),
                () => { 
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText(`-${Object.values(costs)[0]} ${Object.keys(costs)[0]}`, "cost");
                    State.updateTileType(player.x, player.y, 'FOREST'); // Passer la clé du type de terrain
                    UI.addChatMessage("La terre redevient fertile et une jeune forêt pousse.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'sleep': { 
            let sleepEffect = null;
            let buildingKeyForDamage = null;
            let buildingToDamage = null;

            const shelterInd = findBuildingOnTile(tile, 'SHELTER_INDIVIDUAL');
            const shelterCol = findBuildingOnTile(tile, 'SHELTER_COLLECTIVE');
            const forteresse = findBuildingOnTile(tile, 'FORTERESSE');

            if (forteresse) {
                buildingToDamage = forteresse;
                sleepEffect = TILE_TYPES.FORTERESSE.sleepEffect;
                buildingKeyForDamage = 'FORTERESSE';
            } else if (shelterCol) {
                buildingToDamage = shelterCol;
                sleepEffect = TILE_TYPES.SHELTER_COLLECTIVE.sleepEffect;
                buildingKeyForDamage = 'SHELTER_COLLECTIVE';
            } else if (shelterInd) {
                buildingToDamage = shelterInd;
                sleepEffect = TILE_TYPES.SHELTER_INDIVIDUAL.sleepEffect;
                buildingKeyForDamage = 'SHELTER_INDIVIDUAL';
            }

            if (!sleepEffect) {
                 UI.addChatMessage("Vous ne trouvez pas d'endroit sûr pour dormir ici.", "system");
                 return;
            }

            performTimedAction(player, ACTION_DURATIONS.SLEEP, 
                () => UI.addChatMessage("Vous vous endormez pour environ 8 heures...", "system"), 
                (actionDataPassed) => { 
                    player.sleep = Math.min(player.maxSleep, player.sleep + (sleepEffect.sleep || 0)); 
                    player.health = Math.min(player.maxHealth, player.health + (sleepEffect.health || 0));
                    UI.addChatMessage("Vous vous réveillez, un peu reposé.", "system");

                    if(actionDataPassed.buildingKeyForDamage) { // Utiliser la donnée passée
                        const bldIndex = getBuildingIndexOnTile(tile, actionDataPassed.buildingKeyForDamage);
                        if(bldIndex !== -1) {
                            const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                             UI.addChatMessage(`${TILE_TYPES[actionDataPassed.buildingKeyForDamage].name} perd 1 durabilité.`, "system_event");
                            if (damageResult.destroyed) {
                                UI.addChatMessage(`${damageResult.name} s'est effondré !`, "system_event");
                            }
                        }
                    }
                },
                updateUICallbacks,
                { buildingKeyForDamage } 
            );
            break;
        }

        case 'cook': { 
            const campfire = findBuildingOnTile(tile, 'CAMPFIRE');
            if (!campfire) {
                UI.addChatMessage("Vous avez besoin d'un feu de camp pour cuisiner.", "system");
                return;
            }

            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite', 'Oeuf cru': 'Oeuf cuit' };
            const rawMaterial = data.raw; // 'Poisson cru', 'Viande crue', ou 'Oeuf cru'
            const cookedItem = cookable[rawMaterial];

            if (!rawMaterial || !cookedItem) {
                UI.addChatMessage("Ingrédient de cuisine invalide.", "system");
                return;
            }
            
            if (!State.hasResources({ [rawMaterial]: 1, 'Bois': 1 }).success) {
                 UI.addChatMessage(`Ressources insuffisantes pour cuisiner ${rawMaterial} (nécessite aussi 1 Bois).`, "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }

            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Cuisson de ${rawMaterial}...`, "system"), 
                () => { // Renommer actionDataPassed si besoin pour éviter conflit de scope
                    State.applyResourceDeduction({ [rawMaterial]: 1, 'Bois': 1 });
                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); 
                    UI.triggerActionFlash('gain');

                    const bldIndex = getBuildingIndexOnTile(tile, 'CAMPFIRE');
                    if(bldIndex !== -1) {
                         const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                         UI.addChatMessage(`Feu de Camp perd 1 durabilité.`, "system_event");
                        if (damageResult.destroyed) {
                            UI.addChatMessage(`${damageResult.name} s'est éteint et effondré !`, "system_event");
                        }
                    }
                },
                updateUICallbacks
            );
            break;
        }

        case 'search_zone': {
            const tileName = tile.type.name; // Utiliser le type de terrain de base pour la recherche
            let tileKeyForSearch = null;
            for (const key in TILE_TYPES) {
                if (TILE_TYPES[key].name === tileName) {
                    tileKeyForSearch = key;
                    break;
                }
            }
            const searchConfig = tileKeyForSearch ? SEARCH_ZONE_CONFIG[tileKeyForSearch] : null;

            if (!searchConfig) {
                UI.addChatMessage("Vous ne pouvez pas fouiller cette zone en détail.", "system");
                return;
            }
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
                                x: player.x, 
                                y: player.y,
                                currentHealth: enemyTemplate.health,
                            };
                            State.addEnemy(encounterEnemy); 
                            State.startCombat(player, encounterEnemy);
                            UI.showCombatModal(State.state.combatState);
                        } else {
                            UI.addChatMessage("...mais ce n'était rien d'alarmant.", "system_event"); 
                        }
                    } else if (rand < searchConfig.combatChance + searchConfig.noLootChance) {
                        UI.addChatMessage("Cette recherche n'a pas été fructueuse.", "system");
                    } else {
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        if (availableSpace <= 0) {
                            UI.addChatMessage("Vous apercevez quelque chose, mais votre inventaire est plein !", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                            return;
                        }

                        let foundItem = null;
                        const tierRand = Math.random(); 
                        let cumulativeChance = 0;

                        // Loot spécifique par tiers
                        for (const tier of ['common', 'uncommon', 'rare', 'veryRare']) {
                            cumulativeChance += searchConfig.lootTiers[tier];
                            if (tierRand < cumulativeChance && searchConfig.specificLoot[tier].length > 0) {
                                foundItem = searchConfig.specificLoot[tier][Math.floor(Math.random() * searchConfig.specificLoot[tier].length)];
                                break;
                            }
                        }
                        // Loot "offTable" (parchemins et autres items rares non listés directement)
                        if (!foundItem && searchConfig.lootTiers.offTable > 0 && tierRand < cumulativeChance + searchConfig.lootTiers.offTable && searchConfig.specificLoot.offTable && searchConfig.specificLoot.offTable.length > 0) {
                             foundItem = searchConfig.specificLoot.offTable[Math.floor(Math.random() * searchConfig.specificLoot.offTable.length)];
                             UI.addChatMessage("Vous avez trouvé quelque chose d'inattendu !", "system_event");
                        }
                        // Fallback sur ALL_SEARCHABLE_ITEMS si rien de spécifique n'est trouvé et qu'il reste de la probabilité
                        if (!foundItem && tierRand >= cumulativeChance + (searchConfig.lootTiers.offTable || 0) && ALL_SEARCHABLE_ITEMS.length > 0) {
                             foundItem = ALL_SEARCHABLE_ITEMS[Math.floor(Math.random() * ALL_SEARCHABLE_ITEMS.length)];
                             UI.addChatMessage("Vous avez trouvé quelque chose d'ordinaire mais utile.", "system");
                        }


                        if (foundItem) {
                            const amountFound = 1; 
                            State.addResourceToPlayer(foundItem, amountFound);
                            UI.showFloatingText(`+${amountFound} ${foundItem}`, 'gain');
                            UI.addChatMessage(`Vous avez trouvé: ${amountFound} ${foundItem} !`, 'gain');
                            UI.triggerActionFlash('gain');
                        } else {
                            UI.addChatMessage("Vous n'avez rien trouvé d'intéressant cette fois.", "system");
                        }
                    }
                },
                updateUICallbacks
            );
            break;
        }

        case 'take_hidden_item': {
            if (tile.hiddenItem) {
                const itemName = tile.hiddenItem;
                const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                if (availableSpace < 1 ) { 
                    UI.addChatMessage("Votre inventaire est plein !", "system");
                    if(DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    return;
                }
                
                UI.addChatMessage(`Vous avez trouvé : ${itemName} !`, 'gain');
                State.addResourceToPlayer(itemName, 1);
                UI.showFloatingText(`+1 ${itemName}`, 'gain');
                tile.hiddenItem = null; 
                if (updateUICallbacks && updateUICallbacks.updateAllUI) updateUICallbacks.updateAllUI();
                 if (updateUICallbacks && updateUICallbacks.updatePossibleActions) updateUICallbacks.updatePossibleActions(); 
            } else {
                UI.addChatMessage("Il n'y a rien à prendre ici.", "system");
            }
            break;
        }

        case 'open_treasure': {
            if (tile.type === TILE_TYPES.TREASURE_CHEST && !tile.isOpened) {
                if (player.inventory[TILE_TYPES.TREASURE_CHEST.requiresKey] > 0) {
                    performTimedAction(player, ACTION_DURATIONS.OPEN_TREASURE, 
                        () => UI.addChatMessage("Vous essayez d'ouvrir le trésor...", "system"),
                        () => {
                            State.applyResourceDeduction({ [TILE_TYPES.TREASURE_CHEST.requiresKey]: 1 });
                            UI.showFloatingText(`-1 ${TILE_TYPES.TREASURE_CHEST.requiresKey}`, 'cost');
                            UI.addChatMessage("Le trésor s'ouvre ! Vous trouvez un kit de combat complet !", "gain");
                            
                            let inventoryFullMessageShown = false;
                            
                            for (const itemName in TREASURE_COMBAT_KIT) {
                                const amountToPotentiallyAdd = TREASURE_COMBAT_KIT[itemName];
                                let amountActuallyAdded = 0;

                                for (let i=0; i < amountToPotentiallyAdd; i++) {
                                    const currentTotalResources = getTotalResources(player.inventory);
                                    if (currentTotalResources < player.maxInventory) {
                                        State.addResourceToPlayer(itemName, 1);
                                        amountActuallyAdded++;
                                    } else {
                                        if (!inventoryFullMessageShown) {
                                            UI.addChatMessage("Votre inventaire est plein, vous ne pouvez pas tout prendre !", "warning");
                                            if(DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                                            inventoryFullMessageShown = true;
                                        }
                                        UI.addChatMessage(`Vous laissez ${amountToPotentiallyAdd - amountActuallyAdded} ${itemName} dans le coffre.`, "system_event");
                                        break; 
                                    }
                                }
                                if (amountActuallyAdded > 0) {
                                     UI.showFloatingText(`+${amountActuallyAdded} ${itemName}`, 'gain');
                                }
                            }
                            UI.triggerActionFlash('gain');
                            tile.isOpened = true; 
                        },
                        updateUICallbacks
                    );

                } else {
                    UI.addChatMessage(`Il vous faut une ${TILE_TYPES.TREASURE_CHEST.requiresKey} pour ouvrir ceci.`, "system");
                    if(DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                }
            } else if (tile.type === TILE_TYPES.TREASURE_CHEST && tile.isOpened) {
                UI.addChatMessage("Ce trésor a déjà été ouvert.", "system");
            } else {
                UI.addChatMessage("Il n'y a pas de trésor à ouvrir ici.", "system");
            }
            break;
        }

        case 'build_campfire_action': { 
            handlePlayerAction('build_structure', { structureKey: 'CAMPFIRE' }, updateUICallbacks);
            break;
        }

        case 'use_building_action': {
            const buildingKey = data.buildingKey; 
            const buildingOnTileInstance = findBuildingOnTile(tile, buildingKey); // C'est l'instance du bâtiment
            const buildingDef = TILE_TYPES[buildingKey]; // C'est la définition du type de bâtiment

            if (!buildingOnTileInstance || !buildingDef) {
                UI.addChatMessage("Ce bâtiment ne peut pas être utilisé ainsi ou est introuvable.", "system");
                return;
            }
            
            // Trouver l'action spécifique
            let specificActionDef = null;
            if (buildingDef.actions) { 
                specificActionDef = buildingDef.actions.find(act => act.id === data.specificActionId);
            } else if (buildingDef.action && buildingDef.action.id === data.specificActionId) { 
                specificActionDef = buildingDef.action;
            }


            if (!specificActionDef) {
                 UI.addChatMessage("Action inconnue pour ce bâtiment.", "system");
                 return;
            }
            
            if (specificActionDef.costItem && (!player.inventory[specificActionDef.costItem] || player.inventory[specificActionDef.costItem] < 1)) {
                UI.addChatMessage(`Vous avez besoin de 1 ${specificActionDef.costItem} pour : ${specificActionDef.name}.`, "system");
                return;
            }


            performTimedAction(player, ACTION_DURATIONS.USE_BUILDING_ACTION,
                () => UI.addChatMessage(`${specificActionDef.name}...`, "system"),
                (actionDataPassed) => { // actionDataPassed contient { buildingKey }
                    const bldIndex = getBuildingIndexOnTile(tile, actionDataPassed.buildingKey);
                    if(bldIndex === -1) {
                         UI.addChatMessage("Le bâtiment a disparu !", "system_error");
                         return;
                    }

                    if (specificActionDef.costItem) {
                        State.applyResourceDeduction({ [specificActionDef.costItem]: 1 });
                        UI.showFloatingText(`-1 ${specificActionDef.costItem}`, 'cost');
                    }

                    if (specificActionDef.result) {
                        for (const item in specificActionDef.result) {
                            State.addResourceToPlayer(item, specificActionDef.result[item]);
                            UI.showFloatingText(`+${specificActionDef.result[item]} ${item}`, "gain");
                        }
                        UI.triggerActionFlash('gain');
                    }
                    if (specificActionDef.durabilityGain) {
                        tile.buildings[bldIndex].durability = Math.min(tile.buildings[bldIndex].maxDurability, tile.buildings[bldIndex].durability + specificActionDef.durabilityGain);
                        UI.addChatMessage(`${buildingDef.name} gagne ${specificActionDef.durabilityGain} durabilité.`, "system_event");
                    }

                    if (specificActionDef.id === 'search_ore') {
                        let found = false;
                        const rand = Math.random();
                        let cumulativeChance = 0;
                        for (const ore of buildingDef.action.results) { // Assumer buildingDef.action ici car search_ore est unique
                            cumulativeChance += ore.chance;
                            if (rand < cumulativeChance) {
                                State.addResourceToPlayer(ore.item, 1);
                                UI.showFloatingText(`+1 ${ore.item}`, 'gain');
                                UI.addChatMessage(`Vous avez trouvé: 1 ${ore.item} !`, 'gain');
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            UI.addChatMessage("Vous n'avez rien trouvé d'intéressant cette fois.", "system");
                        }
                    }
                    if (specificActionDef.id === 'generate_plan') {
                         State.addResourceToPlayer('Plan d\'ingénieur', 1);
                         UI.showFloatingText(`+1 Plan d'ingénieur`, 'gain');
                         UI.addChatMessage(`Vous avez trouvé un Plan d'ingénieur !`, 'gain');
                    }
                    if (specificActionDef.id === 'observe_weather') {
                        UI.addChatMessage("Vous scrutez l'horizon... (Logique de prédiction à implémenter)", "system_event");
                    }
                    if (['use_atelier', 'use_forge', 'use_laboratoire'].includes(specificActionDef.id)) {
                        UI.addChatMessage(`Vous ouvrez l'interface de ${buildingDef.name}. (UI à implémenter)`, "system_event");
                    }

                    if (!specificActionDef.durabilityGain) { // N'endommager que si l'action ne donne pas de durabilité
                        const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                        UI.addChatMessage(`${buildingDef.name} perd 1 durabilité.`, "system_event");
                        if (damageResult.destroyed) {
                            UI.addChatMessage(`${damageResult.name} s'est effondré !`, "system_event");
                        }
                    }
                },
                updateUICallbacks,
                { buildingKey } 
            );
            break;
        }
    }
}