// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js'; 
import { findEnemyOnTile } from './enemy.js';
import DOM from './ui/dom.js';

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
    if (player.isBusy || player.animationState) return;

    player.isBusy = true;
    onStart(); 
    if (updateUICallbacks && updateUICallbacks.updatePossibleActions) {
        updateUICallbacks.updatePossibleActions();
    }
    if (updateUICallbacks && updateUICallbacks.updateAllButtonsState) {
        UI.updateAllButtonsState(State.state); 
    }

    setTimeout(() => {
        onComplete(actionData); // Passer actionData à onComplete
        player.isBusy = false;
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
    if (!tool || tool.action !== actionType) {
        UI.addChatMessage(`Vous n'avez pas le bon outil équipé pour cette action.`, 'system');
        if (DOM.equipmentSlotsEl) { 
            UI.triggerShake(DOM.equipmentSlotsEl);
        } else if (DOM.quickSlotsPanel) { 
            UI.triggerShake(DOM.quickSlotsPanel); 
        }
        return;
    }

    performTimedAction(player, ACTION_DURATIONS.HARVEST, 
        () => UI.addChatMessage(`Utilisation de ${tool.name}...`, 'system'),
        () => {
            onComplete(tool.power); 

            if (tool.hasOwnProperty('currentDurability')) { 
                tool.currentDurability--;
                if (tool.currentDurability <= 0) {
                    UI.addChatMessage(`${tool.name} s'est cassé !`, 'system');
                    State.state.player.equipment[toolSlot] = null; 
                }
            }
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                UI.updateEquipmentModal(State.state);
            }
        },
        updateUICallbacks
    );
}

// ... (handleCombatAction, playerAttack, playerFlee, enemyAttack - inchangés pour l'instant)
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
    if (combatState) {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", 'system');
        return;
    }
    const tile = map[player.y][player.x];

    let shouldApplyBaseCost = true;
    switch(actionId) {
        case 'sleep':
        case 'initiate_combat': 
        case 'take_hidden_item': 
        case 'open_treasure':
        // Les actions de bâtiment ne coûtent pas de stats de base, mais peuvent avoir leurs propres coûts
        case 'build_structure':
        case 'use_building_action':
            shouldApplyBaseCost = false;
            break;
    }

    if (shouldApplyBaseCost) {
        if (!applyRandomStatCost(player, 1, actionId)) { 
            // return; // On pourrait bloquer ici si trop épuisé
        }
    }

    // Gestion de la durabilité des bâtiments pour certaines actions
    let buildingToDamageIndex = -1;
    if (data && data.buildingKeyForDamage) {
        buildingToDamageIndex = getBuildingIndexOnTile(tile, data.buildingKeyForDamage);
    }


    switch(actionId) {
        // ... (initiate_combat, harvest, harvest_wood, fish, hunt - relativement inchangés pour l'instant)
        // ... (SAUF que hunt/fish pourraient être liés à des bâtiments plus tard)

        case 'build_structure': {
            const structureKey = data.structureKey;
            const structureType = TILE_TYPES[structureKey];
            if (!structureType) {
                UI.addChatMessage("Type de structure inconnu.", "system");
                return;
            }

            // Vérifier les coûts
            const costs = { ...structureType.cost }; // Copier pour ne pas modifier l'original
            const toolRequiredArray = costs.toolRequired;
            delete costs.toolRequired; // Retirer du check de ressources standard

            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Ressources insuffisantes.", "system");
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
            
            // Vérifier les conditions de la tuile
             if (tile.buildings.length >= CONFIG.MAX_BUILDINGS_PER_TILE) {
                UI.addChatMessage("Nombre maximum de bâtiments atteint sur cette tuile.", "system");
                return;
            }
            if (!tile.type.buildable) {
                UI.addChatMessage("Vous ne pouvez pas construire sur ce type de terrain.", "system");
                return;
            }
            // Condition spécifique pour Plaine (sauf exceptions)
            if (tile.type.name !== TILE_TYPES.PLAINS.name && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE') {
                 UI.addChatMessage("Ce bâtiment ne peut être construit que sur une Plaine.", "system");
                 return;
            }


            performTimedAction(player, ACTION_DURATIONS.BUILD,
                () => UI.addChatMessage(`Construction de ${structureType.name}...`, "system"),
                () => {
                    State.applyResourceDeduction(costs); // Déduire les ressources matérielles
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


        case 'sleep': { // Modifié pour utiliser le bâtiment sur la tuile
            let sleepEffect = null;
            let buildingKeyForDamage = null;

            const shelterInd = findBuildingOnTile(tile, 'SHELTER_INDIVIDUAL');
            const shelterCol = findBuildingOnTile(tile, 'SHELTER_COLLECTIVE');
            const forteresse = findBuildingOnTile(tile, 'FORTERESSE');

            if (forteresse) {
                sleepEffect = TILE_TYPES.FORTERESSE.sleepEffect;
                buildingKeyForDamage = 'FORTERESSE';
            } else if (shelterCol) {
                sleepEffect = TILE_TYPES.SHELTER_COLLECTIVE.sleepEffect;
                buildingKeyForDamage = 'SHELTER_COLLECTIVE';
            } else if (shelterInd) {
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

                    if(actionDataPassed.buildingKeyForDamage) {
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
                { buildingKeyForDamage } // Passer la clé du bâtiment à endommager
            );
            break;
        }

        case 'cook': { // Doit vérifier le Feu de Camp
            const campfire = findBuildingOnTile(tile, 'CAMPFIRE');
            if (!campfire) {
                UI.addChatMessage("Vous avez besoin d'un feu de camp pour cuisiner.", "system");
                return;
            }

            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite', 'Oeuf cru': 'Oeuf cuit' }; // Ajout oeuf
            let toCook = null;
            let cookedItem = null;

            for (const raw in cookable) {
                if (State.hasResources({ [raw]: 1, 'Bois': 1 }).success) { // Bois toujours nécessaire pour cuisiner sur feu
                    toCook = raw;
                    cookedItem = cookable[raw];
                    break;
                }
            }

            if (!toCook) {
                UI.addChatMessage("Ressources insuffisantes pour cuisiner (ingrédient cru et bois).", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Cuisson de ${toCook}...`, "system"), 
                (actionDataPassed) => { 
                    State.applyResourceDeduction({ [toCook]: 1, 'Bois': 1 });
                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); 
                    UI.triggerActionFlash('gain');

                    // Endommager le feu de camp
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

        // ... (search_zone, take_hidden_item, open_treasure - inchangés pour l'instant)
        
        case 'build_campfire_action': { // Modifié pour utiliser le système de construction générique
            handlePlayerAction('build_structure', { structureKey: 'CAMPFIRE' }, updateUICallbacks);
            break;
        }

        // Actions spécifiques des nouveaux bâtiments
        case 'use_building_action': {
            const buildingKey = data.buildingKey; // ex: 'PETIT_PUIT'
            const buildingOnTile = findBuildingOnTile(tile, buildingKey);
            const buildingType = TILE_TYPES[buildingKey];

            if (!buildingOnTile || !buildingType || !buildingType.action && !buildingType.actions) {
                UI.addChatMessage("Ce bâtiment ne peut pas être utilisé ainsi ou est introuvable.", "system");
                return;
            }

            let specificAction = null;
            if (buildingType.actions) { // Si plusieurs actions possibles pour ce bâtiment
                specificAction = buildingType.actions.find(act => act.id === data.specificActionId);
            } else if (buildingType.action) { // Si une seule action principale
                specificAction = buildingType.action;
            }

            if (!specificAction) {
                 UI.addChatMessage("Action inconnue pour ce bâtiment.", "system");
                 return;
            }
            
            // Gestion des coûts en items pour l'action (ex: arroser)
            if (specificAction.costItem && player.inventory[specificAction.costItem] < 1) {
                UI.addChatMessage(`Vous avez besoin de 1 ${specificAction.costItem} pour cette action.`, "system");
                return;
            }


            performTimedAction(player, ACTION_DURATIONS.USE_BUILDING_ACTION,
                () => UI.addChatMessage(`${specificAction.name}...`, "system"),
                (actionDataPassed) => {
                    const bldIndex = getBuildingIndexOnTile(tile, actionDataPassed.buildingKey);
                    if(bldIndex === -1) return; // Bâtiment disparu ?

                    if (specificAction.costItem) {
                        State.applyResourceDeduction({ [specificAction.costItem]: 1 });
                        UI.showFloatingText(`-1 ${specificAction.costItem}`, 'cost');
                    }

                    if (specificAction.result) {
                        for (const item in specificAction.result) {
                            State.addResourceToPlayer(item, specificAction.result[item]);
                            UI.showFloatingText(`+${specificAction.result[item]} ${item}`, "gain");
                        }
                        UI.triggerActionFlash('gain');
                    }
                    if (specificAction.durabilityGain) {
                        tile.buildings[bldIndex].durability = Math.min(tile.buildings[bldIndex].maxDurability, tile.buildings[bldIndex].durability + specificAction.durabilityGain);
                        UI.addChatMessage(`${buildingType.name} gagne ${specificAction.durabilityGain} durabilité.`, "system_event");
                    }

                    // Logique pour la mine (chercher du minerai)
                    if (specificAction.id === 'search_ore') {
                        let found = false;
                        const rand = Math.random();
                        let cumulativeChance = 0;
                        for (const ore of buildingType.action.results) {
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

                    // Logique pour la bibliothèque (générer plan) - ceci devrait être un intervalle de temps, pas une action directe
                    // Pour l'instant, action directe pour test
                    if (specificAction.id === 'generate_plan') {
                         State.addResourceToPlayer('Plan d\'ingénieur', 1);
                         UI.showFloatingText(`+1 Plan d'ingénieur`, 'gain');
                         UI.addChatMessage(`Vous avez trouvé un Plan d'ingénieur !`, 'gain');
                    }
                    
                    // Logique pour l'observatoire
                    if (specificAction.id === 'observe_weather') {
                        // TODO: Implémenter la logique pour prédire la prochaine catastrophe
                        UI.addChatMessage("Vous scrutez l'horizon... (Logique de prédiction à implémenter)", "system_event");
                    }
                    
                    // Logique pour Atelier, Forge, Laboratoire (Placeholder)
                    if (specificAction.id === 'use_atelier' || specificAction.id === 'use_forge' || specificAction.id === 'use_laboratoire') {
                        UI.addChatMessage(`Vous ouvrez l'interface de ${buildingType.name}. (UI à implémenter)`, "system_event");
                        // Ici, on ouvrirait une modale dédiée
                    }


                    // Endommager le bâtiment après utilisation (sauf si gain de durabilité)
                    if (!specificAction.durabilityGain) {
                        const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                        UI.addChatMessage(`${buildingType.name} perd 1 durabilité.`, "system_event");
                        if (damageResult.destroyed) {
                            UI.addChatMessage(`${damageResult.name} s'est effondré !`, "system_event");
                        }
                    }
                },
                updateUICallbacks,
                { buildingKey } // Passer la clé du bâtiment
            );
            break;
        }

    }
}