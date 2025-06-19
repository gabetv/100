// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, SEARCHABLE_ITEMS } from './config.js';
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

function performTimedAction(player, duration, onStart, onComplete, updateUICallbacks) {
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
        onComplete();
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
            UI.updateAllUI(State.state); 
            if (window.updatePossibleActions) window.updatePossibleActions();
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
        if (window.updatePossibleActions) window.updatePossibleActions();
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
    if (window.fullUIUpdate) window.fullUIUpdate(); else UI.updateAllUI(State.state);
}

function applyRandomStatCost(player, amount = 1) {
    const statsToCost = ['thirst', 'hunger', 'sleep'];
    const chosenStat = statsToCost[Math.floor(Math.random() * statsToCost.length)];
    let costText = '';

    switch (chosenStat) {
        case 'thirst':
            player.thirst = Math.max(0, player.thirst - amount);
            costText = `-${amount}💧`;
            break;
        case 'hunger':
            player.hunger = Math.max(0, player.hunger - amount);
            costText = `-${amount}🍗`;
            break;
        case 'sleep':
            player.sleep = Math.max(0, player.sleep - amount);
            costText = `-${amount}🌙`;
            break;
    }
    if (costText) {
        UI.showFloatingText(costText, 'cost');
    }
}

export function handlePlayerAction(actionId, data, updateUICallbacks) {
    const { player, map, activeEvent, combatState, enemies } = State.state;
    if (combatState) {
        UI.addChatMessage("Impossible d'agir, vous êtes en combat !", 'system');
        return;
    }
    const tile = map[player.y][player.x];

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

        case 'harvest': {
            const resource = tile.type.resource;
            if (!resource) return;
            
            const costs = {
                thirst: resource.thirstCost || 0,
                hunger: resource.hungerCost || 0,
                sleep: resource.sleepCost || 0,
            };
            if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop épuisé pour cette action.", "system");
                return;
            }
            applyActionCosts(player, costs);

            performTimedAction(player, ACTION_DURATIONS.HARVEST, 
                () => UI.addChatMessage("Récolte...", "system"), 
                () => {
                    let finalYield = (activeEvent && activeEvent.type === 'Abondance' && activeEvent.data && activeEvent.data.resource === resource.type) ? resource.yield * 2 : resource.yield;
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(finalYield, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer(resource.type, amountToHarvest);
                        tile.harvestsLeft--;
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain');
                        UI.triggerActionFlash('gain');
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        else if (amountToHarvest < finalYield) UI.addChatMessage("Récolte partielle due à la limite de la zone ou de l'inventaire.", "system");

                        if (tile.harvestsLeft <= 0 && tile.type.harvests !== Infinity) {
                            State.updateTileType(player.x, player.y, TILE_TYPES.WASTELAND);
                            UI.addChatMessage("Les ressources de cette zone sont épuisées.", "system");
                        }
                    } else { 
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter.", "system"); 
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, 
                updateUICallbacks
            );
            break;
        }
        
        case 'harvest_wood': {
            const costs = { thirst: 2, hunger: 1, sleep: 2 };
             if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop épuisé pour couper du bois.", "system");
                return;
            }
            applyActionCosts(player, costs);
            performToolAction(player, 'weapon', 'harvest_wood', (power) => {
                State.addResourceToPlayer('Bois', power);
                UI.showFloatingText(`+${power} Bois`, 'gain');
                UI.triggerActionFlash('gain');
            }, updateUICallbacks);
            break;
        }

        case 'fish': {
            const costs = { thirst: 1, hunger: 1, sleep: 1 };
            if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour pêcher.", "system");
                return;
            }
            applyActionCosts(player, costs);
            performToolAction(player, 'weapon', 'fish', (power) => {
                const fishCaught = Math.ceil(Math.random() * power); 
                if (fishCaught > 0) {
                    State.addResourceToPlayer('Poisson cru', fishCaught);
                    UI.showFloatingText(`+${fishCaught} Poisson cru`, 'gain');
                    UI.triggerActionFlash('gain');
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
             const costs = { thirst: 2, hunger: 2, sleep: 2 };
             if (player.thirst < costs.thirst || player.hunger < costs.hunger || player.sleep < costs.sleep) {
                UI.addChatMessage("Vous êtes trop affaibli pour chasser.", "system");
                return;
            }
             applyActionCosts(player, costs);
             performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) { 
                        const amount = (weapon.stats?.damage || weapon.power || 1) * (Math.floor(Math.random() * 2) + 1); 
                        State.addResourceToPlayer('Viande crue', amount);
                        UI.showFloatingText(`+${amount} Viande crue`, "gain");
                        UI.triggerActionFlash('gain');
                    } else {
                        UI.addChatMessage("La chasse n'a rien donné.", "system");
                    }
                    if (weapon.hasOwnProperty('currentDurability')) {
                        weapon.currentDurability--;
                        if (weapon.currentDurability <= 0) {
                            UI.addChatMessage(`${weapon.name} s'est cassé !`, 'system');
                            player.equipment.weapon = null;
                            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
                                UI.updateEquipmentModal(State.state);
                            }
                        }
                    }
                },
                updateUICallbacks
            );
            break;
        }

        case 'build': {
            const structureType = data.structure; 
            const buildCosts = structureType === 'shelter_individual' 
                ? { 'Bois': 20 } 
                : { 'Bois': 600, 'Pierre': 150 }; 

            if (!State.hasResources(buildCosts).success) {
                UI.addChatMessage("Ressources insuffisantes pour construire cet abri.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 4, hunger: 2, sleep: 3 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour construire.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT * (structureType === 'shelter_individual' ? 1 : 3), 
                () => UI.addChatMessage(`Construction de ${structureType === 'shelter_individual' ? 'l\'abri individuel' : 'l\'abri collectif'}...`, "system"), 
                () => {
                    State.applyResourceDeduction(buildCosts);
                    for(const item in buildCosts) {
                        UI.showFloatingText(`-${buildCosts[item]} ${item}`, 'cost');
                    }
                    const newStructure = structureType === 'shelter_individual' ? TILE_TYPES.SHELTER_INDIVIDUAL : TILE_TYPES.SHELTER_COLLECTIVE;
                    State.updateTileType(player.x, player.y, newStructure);
                    UI.addChatMessage(`${structureType === 'shelter_individual' ? 'Abri individuel' : 'Abri collectif'} construit !`, "system");
                },
                updateUICallbacks
            );
            break;
        }
        
        case 'dig_mine': {
            const costs = { 'Bois': 100, 'Pierre': 50 }; 
            if (!State.hasResources(costs).success) {
                UI.addChatMessage("Pas assez de matériaux pour étayer la mine.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 5, hunger: 5, sleep: 7 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Creuser une mine est trop éprouvant pour le moment.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.DIG,
                () => UI.addChatMessage("Vous creusez une entrée de mine...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText("-100 Bois, -50 Pierre", 'cost'); 
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
                UI.addChatMessage("Vous n'avez pas assez d'eau pour fertiliser cette terre.", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 1, hunger: 1, sleep: 1 };
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous manquez d'énergie pour cette tâche.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT,
                () => UI.addChatMessage("Vous travaillez la terre...", "system"),
                () => {
                    State.applyResourceDeduction(costs);
                    UI.showFloatingText(`-${Object.values(costs)[0]} ${Object.keys(costs)[0]}`, "cost");
                    State.updateTileType(player.x, player.y, TILE_TYPES.FOREST);
                    UI.addChatMessage("La terre redevient fertile et une jeune forêt pousse.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'sleep': {
            const sleepEffect = tile.type.sleepEffect;
            if (!sleepEffect) return;

            performTimedAction(player, ACTION_DURATIONS.SLEEP, 
                () => UI.addChatMessage("Vous vous endormez pour environ 8 heures...", "system"), 
                () => {
                    player.sleep = Math.min(player.maxSleep, player.sleep + (sleepEffect.sleep || 0)); 
                    player.health = Math.min(player.maxHealth, player.health + (sleepEffect.health || 0));
                    UI.addChatMessage("Vous vous réveillez, un peu reposé.", "system");
                },
                updateUICallbacks
            );
            break;
        }

        case 'cook': {
            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite' };
            let toCook = null;
            let cookedItem = null;

            for (const raw in cookable) {
                if (State.hasResources({ [raw]: 1, 'Bois': 1 }).success) {
                    toCook = raw;
                    cookedItem = cookable[raw];
                    break;
                }
            }

            if (!toCook) {
                UI.addChatMessage("Ressources insuffisantes pour cuisiner (poisson/viande crue et bois).", "system");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }
            const actionCosts = { thirst: 1, sleep: 1 }; 
             if (player.thirst < actionCosts.thirst || player.sleep < actionCosts.sleep) {
                UI.addChatMessage("Vous êtes trop fatigué pour cuisiner.", "system");
                return;
            }
            applyActionCosts(player, actionCosts);

            performTimedAction(player, ACTION_DURATIONS.CRAFT, 
                () => UI.addChatMessage(`Cuisson de ${toCook}...`, "system"), 
                () => {
                    State.applyResourceDeduction({ [toCook]: 1, 'Bois': 1 });
                    State.addResourceToPlayer(cookedItem, 1);
                    UI.showFloatingText(`+1 ${cookedItem}`, "gain"); 
                    UI.triggerActionFlash('gain');
                },
                updateUICallbacks
            );
            break;
        }

        case 'search_zone': {
            const tileName = tile.type.name;
            let tileKeyForSearch = null;

            // Trouver la clé correspondante dans TILE_TYPES pour l'utiliser avec SEARCH_ZONE_CONFIG
            for (const key in TILE_TYPES) {
                if (TILE_TYPES[key].name === tileName) {
                    tileKeyForSearch = key;
                    break;
                }
            }
            
            const searchConfig = tileKeyForSearch ? SEARCH_ZONE_CONFIG[tileKeyForSearch] : null;

            if (!searchConfig) {
                UI.addChatMessage("Vous ne pouvez pas fouiller cette zone en détail.", "system"); // Message générique si pas de config
                return;
            }

            applyRandomStatCost(player, 1); 
            const actionCosts = { thirst: 1, hunger: 1 }; 
            if (player.thirst < actionCosts.thirst || player.hunger < actionCosts.hunger) {
                UI.addChatMessage("Vous êtes trop épuisé pour fouiller attentivement.", "system");
                return;
            }
            applyActionCosts(player, actionCosts); 

            performTimedAction(player, ACTION_DURATIONS.SEARCH,
                () => UI.addChatMessage("Vous fouillez attentivement les environs...", "system"),
                () => {
                    const rand = Math.random();
                    if (rand < searchConfig.combatChance) {
                        UI.addChatMessage("Quelque chose surgit des ombres !", "system");
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
                            UI.addChatMessage("...mais ce n'était rien.", "system"); 
                        }
                    } else if (rand < searchConfig.combatChance + searchConfig.itemChance) {
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        if (availableSpace <= 0) {
                            UI.addChatMessage("Vous trouvez quelque chose, mais votre inventaire est plein !", "system");
                            if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                            return;
                        }

                        let lootPool = SEARCHABLE_ITEMS; 
                        if (searchConfig.possibleLoot && searchConfig.possibleLoot.length > 0) {
                            lootPool = searchConfig.possibleLoot; 
                        }
                        
                        const foundItem = lootPool[Math.floor(Math.random() * lootPool.length)];
                        const amountFound = 1; 

                        State.addResourceToPlayer(foundItem, amountFound);
                        UI.showFloatingText(`+${amountFound} ${foundItem}`, 'gain');
                        UI.addChatMessage(`Vous avez trouvé: ${amountFound} ${foundItem} !`, 'gain');
                        UI.triggerActionFlash('gain');
                    } else {
                        UI.addChatMessage("Cette recherche n'a pas été fructueuse.", "system");
                    }
                },
                updateUICallbacks
            );
            break;
        }
    }
}