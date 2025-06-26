// js/interactions.js
import { TILE_TYPES, CONFIG, ACTIONS, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import DOM from './ui/dom.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';
import { findEnemyOnTile } from './enemy.js';

// Gestionnaire du menu contextuel
function handleCanvasRightClick(e) {
    e.preventDefault();
    const rect = DOM.mainViewCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    DOM.itemContextMenu.style.left = `${x}px`;
    DOM.itemContextMenu.style.top = `${y}px`;
    DOM.itemContextMenu.classList.remove('hidden');
    
    // Masquer le menu si on clique ailleurs
    setTimeout(() => window.addEventListener('click', () => {
        DOM.itemContextMenu.classList.add('hidden');
    }, { once: true }));
}
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

export function applyRandomStatCost(player, amount = 1) {
    const stats = [
        { name: 'thirst', icon: '💧', condition: player.thirst > 0 },
        { name: 'hunger', icon: '🍗', condition: player.hunger > 0 },
        { name: 'sleep', icon: '🌙', condition: player.sleep > 0 }
    ];
    
    const availableStats = stats.filter(stat => stat.condition);
    
    if (availableStats.length === 0) {
        UI.addChatMessage("Vous êtes à bout de forces !", "warning");
        return false;
    }

    if (player.status.includes('Alcoolisé')) amount = 2;

    // Calcul des poids basés sur les conditions
    const weights = availableStats.map(stat => 
        stat.name === 'thirst' ? 0.33 : 
        stat.name === 'hunger' ? 0.33 : 
        0.34
    );

    let cumulativeWeight = 0;
    const randomValue = Math.random();
    let selectedStat = null;

    for (let i = 0; i < availableStats.length; i++) {
        cumulativeWeight += weights[i];
        if (randomValue < cumulativeWeight) {
            selectedStat = availableStats[i];
            break;
        }
    }

    // Fallback si aucune sélection (normalement impossible)
    selectedStat = selectedStat || availableStats[Math.floor(Math.random() * availableStats.length)];

    // Appliquer la réduction
    player[selectedStat.name] = Math.max(0, player[selectedStat.name] - amount);
    const maxStat = player[`max${selectedStat.name.charAt(0).toUpperCase()}${selectedStat.name.slice(1)}`];
    
    // Avertissement si stat critique
    if (player[selectedStat.name] <= maxStat * 0.2 && player[selectedStat.name] > 0) {
        const messages = {
            sleep: "Attention, vous avez fortement sommeil !",
            hunger: "Attention, vous avez très faim !",
            thirst: "Attention, vous êtes assoiffé !"
        };
        UI.addChatMessage(messages[selectedStat.name] || `Attention, votre ${selectedStat.name} est très bas !`, "warning");
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
    let requiredTool = specificToolName || (actionType ? ITEM_TYPES[tool?.name]?.action : null);
    
    // Vérification de l'outil requis
    if (requiredTool && (!tool || tool.name !== requiredTool)) {
        UI.addChatMessage(`Vous avez besoin d'un(e) ${requiredTool} équipé(e).`, 'system');
        if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
        else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
        return;
    }

    // Détermination de la durée de l'action
    const durationMapping = {
        harvest_wood: 'HARVEST',
        mine_ore: 'HARVEST',
        dig: 'DIG',
        fish: 'HARVEST',
        play_electric_guitar: 'PLAY_GUITAR'
    };
    
    const durationKey = durationMapping[actionType] || (actionType ? actionType.toUpperCase() : 'HARVEST');
    const duration = ACTION_DURATIONS[durationKey] || ACTION_DURATIONS.HARVEST;

    performTimedAction(player, duration,
        () => UI.addChatMessage(`Utilisation de ${tool ? tool.name : 'vos mains'}...`, 'system'),
        () => {
            try {
                onComplete(tool ? (tool.power || 1) : 1, tool);
                
                // Gestion de la durabilité de l'outil
                if (tool) {
                    if (tool.breakChance && Math.random() < tool.breakChance) {
                        UI.addChatMessage(`${tool.name} s'est cassé !`, 'system_warning');
                        State.unequipItem(toolSlot);
                    } else if (tool.uses && tool.currentUses !== undefined) {
                        tool.currentUses--;
                        if (tool.currentUses <= 0) {
                            UI.addChatMessage(`${tool.name} est épuisé !`, 'system_warning');
                            State.unequipItem(toolSlot);
                        }
                    }
                }
            } catch (error) {
                console.error('Erreur dans performToolAction:', error);
                UI.addChatMessage("Une erreur s'est produite lors de l'utilisation de l'outil", 'system_error');
            }
            
            // Mise à jour de l'UI
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
        },
        updateUICallbacks,
        actionData
    );
}

export function canMoveInDirection(player, direction, map, config) {
    let { x: newX, y: newY } = player;
    if (direction === 'north') { newY--; }
    else if (direction === 'south') { newY++; }
    else if (direction === 'west') { newX--; }
    else if (direction === 'east') { newX++; }
    else if (direction === 'northeast') { newY--; newX++; }
    else if (direction === 'northwest') { newY--; newX--; }
    else if (direction === 'southeast') { newY++; newX++; }
    else if (direction === 'southwest') { newY++; newX--; }
    else return false; // Unknown direction

    return newX >= 0 && newX < config.MAP_WIDTH &&
           newY >= 0 && newY < config.MAP_HEIGHT &&
           map[newY] && map[newY][newX] && map[newY][newX].type.accessible;
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
    triggerParticles('combat', window.innerWidth / 2, window.innerHeight / 2);
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

export function findBuildingOnTile(tile, buildingKey) {
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
        ACTIONS.SLEEP, ACTIONS.INITIATE_COMBAT, ACTIONS.TAKE_HIDDEN_ITEM, ACTIONS.OPEN_TREASURE,
        ACTIONS.CONSUME_EAU_SALEE, ACTIONS.OPEN_LARGE_MAP,
        ACTIONS.TALK_TO_NPC, ACTIONS.OPEN_BUILDING_INVENTORY,
        ACTIONS.PLANT_TREE, ACTIONS.SLEEP_BY_CAMPFIRE, ACTIONS.DISMANTLE_BUILDING,
        ACTIONS.CRAFT_ITEM_WORKSHOP, ACTIONS.OPEN_ALL_PARCHEMINS, ACTIONS.SET_LOCK, ACTIONS.REMOVE_LOCK,
        ACTIONS.FIRE_DISTRESS_GUN, ACTIONS.FIRE_DISTRESS_FLARE, ACTIONS.PLACE_SOLAR_PANEL_FIXED, ACTIONS.CHARGE_BATTERY_PORTABLE_SOLAR,
        ACTIONS.PLACE_TRAP, ACTIONS.ATTRACT_NPC_ATTENTION, ACTIONS.FIND_MINE_COMPASS, ACTIONS.OBSERVE_WEATHER, ACTIONS.USE_BUILDING_ACTION
    ];
    if (noBaseCostActions.includes(actionId)) {
        shouldApplyBaseCost = false;
    }

    if (shouldApplyBaseCost) applyRandomStatCost(player, 1, actionId);

    switch(actionId) {
        case ACTIONS.INITIATE_COMBAT: {
            const enemy = findEnemyOnTile(player.x, player.y, enemies);
            if (enemy) {
                State.startCombat(player, enemy);
                UI.showCombatModal(State.state.combatState);
                if (updateUICallbacks && updateUICallbacks.updatePossibleActions) updateUICallbacks.updatePossibleActions();
            } else UI.addChatMessage("Il n'y a plus rien à attaquer ici.", "system");
            break;
        }
        case ACTIONS.CONSUME_EAU_SALEE: {
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
                    result.floatingTexts.forEach(textObj => {
                         const text = typeof textObj === 'string' ? textObj : textObj.text;
                         const type = typeof textObj === 'string' ? (text.startsWith('-') ? 'cost' : 'info') : textObj.type;
                         UI.showFloatingText(text, type);
                    });
                }
                if (window.fullUIUpdate) window.fullUIUpdate();
            } else {
                UI.addChatMessage("Vous n'avez plus d'Eau salée.", "system");
            }
            break;
        }
        case ACTIONS.HARVEST_SALT_WATER: {
            if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                UI.addChatMessage("Vous ne pouvez récolter de l'eau salée que sur la plage.", "system"); 
                return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.harvest_salt_water <= 0) {
                UI.addChatMessage("Vous ne pouvez plus récolter d'eau salée ici pour le moment.", "system"); 
                return;
            }
            
            // Vérification supplémentaire de l'inventaire
            const availableSpace = player.maxInventory - getTotalResources(player.inventory);
            if (availableSpace <= 0) {
                UI.addChatMessage("Inventaire plein, impossible de récolter.", "system");
                if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                return;
            }

            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage(`Récolte d'Eau salée...`, "system"),
                () => {
                    let amount = 1;
                    let toolUsed = null;
                    
                    // Vérification de l'outil après le délai (au cas où l'équipement aurait changé)
                    if (player.equipment.weapon && player.equipment.weapon.name === 'Seau') {
                        amount = 3;
                        toolUsed = player.equipment.weapon;
                    }

                    if (tile.actionsLeft && tile.actionsLeft.harvest_salt_water > 0) tile.actionsLeft.harvest_salt_water--;

                    if (availableSpace >= amount) {
                        State.addResource(player.inventory, 'Eau salée', amount);
                        UI.showFloatingText(`+${amount} Eau salée`, 'gain'); 
                        UI.triggerActionFlash('gain');
                        
                        if (toolUsed && toolUsed.currentDurability !== undefined) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                    } else {
                        UI.addChatMessage("L'inventaire est devenu plein pendant l'action", "system");
                        if (DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks
            );
            break;
        }
        case ACTIONS.HARVEST_SAND: {
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
                    if (tile.actionsLeft && tile.actionsLeft.harvest_sand > 0) tile.actionsLeft.harvest_sand--;

                    if (amountToHarvest > 0) {
                        State.addResource(player.inventory, 'Sable', amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} Sable`, 'gain'); UI.triggerActionFlash('gain');
                        
                        if (toolUsed && toolUsed.hasOwnProperty('currentDurability')) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                        if (amountToHarvest < yieldAmount && availableSpace <= 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                        triggerParticles('harvest', window.innerWidth / 2, window.innerHeight / 2);

                    } else {
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter.", "system");
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                }, updateUICallbacks );
            break;
        }
        case ACTIONS.HARVEST_STONE: { // Generic harvest for stone from MINE_TERRAIN
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
                    
                    if (tile.harvestsLeft !== Infinity && tile.harvestsLeft > 0) tile.harvestsLeft -= 1; // Toujours décrémenter 1 charge
                    
                    if (amountToHarvest > 0) {
                        State.addResource(player.inventory, resource.type, amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} ${resource.type}`, 'gain'); UI.triggerActionFlash('gain');
                        UI.triggerScreenShake();
                        triggerParticles('dust', window.innerWidth / 2, window.innerHeight / 2);
                        if (amountToHarvest < finalYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");

                        if (toolUsed && toolUsed.hasOwnProperty('currentDurability')) {
                            toolUsed.currentDurability--;
                            if (toolUsed.currentDurability <= 0) { 
                                UI.addChatMessage(`${toolUsed.name} s'est cassé !`, 'system_warning');
                                State.unequipItem('weapon');
                            }
                        }
                    } else {
                        UI.addChatMessage(availableSpace <=0 ? "Votre inventaire est plein !" : "Impossible de récolter.", "system");
                        if (availableSpace <=0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                    if (tile.harvestsLeft <= 0 && tile.harvestsLeft !== Infinity) {
                        UI.addChatMessage("Ce filon de pierre est épuisé.", "system");
                    }
                }, updateUICallbacks );
            break;
        }
        case ACTIONS.HARVEST_WOOD_HACHE:
        case ACTIONS.HARVEST_WOOD_SCIE: {
            const requiredToolName = actionId === ACTIONS.HARVEST_WOOD_HACHE ? 'Hache' : 'Scie';
            const forestTileRef = map[player.y][player.x];
            if (forestTileRef.type.name !== TILE_TYPES.FOREST.name || forestTileRef.woodActionsLeft <= 0) {
                UI.addChatMessage("Plus de bois à couper ici ou ce n'est pas une forêt.", "system"); return;
            }
            performToolAction(player, 'weapon', 'harvest_wood',
                (powerOverride, toolUsed) => {
                    let woodYield = 0;
                    if (toolUsed && toolUsed.name === 'Hache') woodYield = 3;
                    else if (toolUsed && toolUsed.name === 'Scie') woodYield = 5;
                    else { UI.addChatMessage(`Vous avez besoin d'un(e) ${requiredToolName} équipé(e).`, "system"); return; }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(woodYield, availableSpace);
                    if (forestTileRef.woodActionsLeft > 0) forestTileRef.woodActionsLeft--;

                    if (amountToHarvest > 0) {
                        State.addResource(player.inventory, 'Bois', amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain'); UI.triggerActionFlash('gain');
                        UI.triggerScreenShake();
                        UI.addChatMessage(`Vous obtenez ${amountToHarvest} Bois avec ${toolUsed.name}.`, 'system');
                        if (amountToHarvest < woodYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                    } else {
                        UI.addChatMessage(availableSpace <= 0 ? "Votre inventaire est plein !" : "Impossible de récolter du bois.", "system");
                        if (availableSpace <= 0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                    if (forestTileRef.woodActionsLeft <= 0) {
                        UI.addChatMessage("Cette partie de la forêt est épuisée pour le bois.", "system");
                    }
                },
                updateUICallbacks, {}, requiredToolName);
            break;
        }
        case ACTIONS.HARVEST_WOOD_MAINS: {
            const forestTileRef = map[player.y][player.x];
            if (forestTileRef.type.name !== TILE_TYPES.FOREST.name || forestTileRef.woodActionsLeft <= 0) {
                UI.addChatMessage("Plus de bois à ramasser ici ou ce n'est pas une forêt.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.HARVEST,
                () => UI.addChatMessage("Vous ramassez du bois à mains nues...", "system"),
                () => {
                    const woodYield = 1; // Rendement de base pour les mains nues
                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(woodYield, availableSpace);
                    if (forestTileRef.woodActionsLeft > 0) forestTileRef.woodActionsLeft--;

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Bois', amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain'); UI.triggerActionFlash('gain');
                        UI.addChatMessage(`Vous obtenez ${amountToHarvest} Bois.`, 'system');
                        if (amountToHarvest < woodYield && availableSpace === 0) UI.addChatMessage("Inventaire plein, récolte partielle.", "system");
                    } else {
                        UI.addChatMessage(availableSpace <= 0 ? "Votre inventaire est plein !" : "Impossible de ramasser du bois.", "system");
                        if (availableSpace <= 0 && DOM.inventoryCapacityEl) UI.triggerShake(DOM.inventoryCapacityEl);
                    }
                    if (forestTileRef.woodActionsLeft <= 0) {
                        UI.addChatMessage("Cette partie de la forêt est épuisée pour le bois.", "system");
                    }
                },
                updateUICallbacks);
            break;
        }
        case ACTIONS.FISH: { 
             if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez pêcher que sur la plage.", "system"); return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.fish <= 0) {
                UI.addChatMessage("Vous ne pouvez plus pêcher ici pour le moment.", "system"); return;
            }
            performToolAction(player, 'weapon', 'fish', (power, toolUsed) => {
                if (tile.actionsLeft && tile.actionsLeft.fish > 0) tile.actionsLeft.fish--;
                if (toolUsed && toolUsed.name === 'Canne à pêche') {
                    const fishCaught = Math.ceil(Math.random() * (toolUsed.power || 1));
                    if (fishCaught > 0) {
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(fishCaught, availableSpace);
                        if (amountToAdd > 0) {
                            State.addResource(player.inventory, 'Poisson cru', amountToAdd);
                            UI.showFloatingText(`+${amountToAdd} Poisson cru`, 'gain'); UI.triggerActionFlash('gain');
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
        case ACTIONS.NET_FISH: { 
             if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez pêcher que sur la plage.", "system"); return;
            }
            performToolAction(player, 'weapon', 'net_fish', (power, toolUsed) => {
                if (toolUsed && toolUsed.name === 'Filet de pêche') {
                    const fishCaught = Math.ceil(Math.random() * 5) + 2; 
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
                } else {
                    UI.addChatMessage("Vous avez besoin d'un Filet de pêche équipé.", "system");
                }
            }, updateUICallbacks, {}, 'Filet de pêche');
            break;
        }
        case ACTIONS.HUNT: {
             const weapon = player.equipment.weapon;
             const currentTileForHunt = map[player.y][player.x];
             if (!currentTileForHunt.huntActionsLeft || currentTileForHunt.huntActionsLeft <= 0) {
                 UI.addChatMessage("Plus d'opportunités de chasse ici pour le moment.", "system"); return;
             }
             if (!weapon || !weapon.stats || weapon.stats.damage <= 0) { 
                 UI.addChatMessage("Vous ne pouvez pas chasser sans arme infligeant des dégâts.", "system"); return;
             }
             if (player.status === 'Drogué') { UI.addChatMessage("Vous ne pouvez pas chasser sous l'effet de la drogue.", "system"); return; }
             performTimedAction(player, ACTION_DURATIONS.SEARCH, 
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (currentTileForHunt.huntActionsLeft > 0) currentTileForHunt.huntActionsLeft--;
                    if (Math.random() < 0.6) { 
                        const baseAmount = (weapon.stats?.damage || 1);
                        const amount = baseAmount * (Math.floor(Math.random() * 2) + 1); 
                        const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                        const amountToAdd = Math.min(amount, availableSpace);
                        if(amountToAdd > 0) {
                            State.addResource(player.inventory, 'Viande crue', amountToAdd);
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
                            State.unequipItem('weapon');
                            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
                            if (DOM.bottomBarEquipmentSlotsEl) UI.updateBottomBarEquipmentPanel(player);
                        }
                    }
                }, updateUICallbacks );
            break;
        }
        case ACTIONS.BUILD_STRUCTURE: {
            const structureKey = data.structureKey;
            const structureType = TILE_TYPES[structureKey];
            if (!structureType) { UI.addChatMessage("Type de structure inconnu.", "system"); return; }

            const costs = { ...structureType.cost };
            const toolRequiredArray = costs.toolRequired;
            delete costs.toolRequired;

            if (player.status.includes('Drogué')) { UI.addChatMessage("Vous ne pouvez pas construire sous l'effet de la drogue.", "system"); return; }

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

            if (tile.type.name === TILE_TYPES.PLAGE.name) {
                UI.addChatMessage("Vous ne pouvez pas construire sur la plage.", "system"); return;
            }
            // Check if the tile is unrevealed and force it to Plains if selected for base construction
            const tileKey = `${player.x},${player.y}`;
            if (!player.visitedTiles.has(tileKey) && !State.state.globallyRevealedTiles.has(tileKey) && 
                (structureKey === 'SHELTER_INDIVIDUAL' || structureKey === 'SHELTER_COLLECTIVE')) {
                State.updateTileType(player.x, player.y, 'PLAINS');
                UI.addChatMessage("Le terrain a été préparé en Plaine pour la construction de la base.", "system");
            }
            if (!tile.type.buildable && structureKey !== 'MINE' && structureKey !== 'CAMPFIRE' && structureKey !== 'PETIT_PUIT') {
                UI.addChatMessage("Vous ne pouvez pas construire sur ce type de terrain.", "system"); return;
            }

            UI.triggerActionFlash('cost');
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
                    if(buildResult.success) {
                        UI.triggerActionFlash('gain');
                        triggerParticles('craft', window.innerWidth / 2, window.innerHeight / 2);
                    }
                }, updateUICallbacks );
            break;
        }
        case ACTIONS.REGENERATE_FOREST: {
            if (tile.type.name !== TILE_TYPES.WASTELAND.name) { UI.addChatMessage("Cette action ne peut être faite que sur une friche.", "system"); return; }
            const costs = TILE_TYPES.WASTELAND.regeneration.cost;
            if (!State.hasResources(costs).success) { UI.addChatMessage("Ressources manquantes pour régénérer.", "system"); return; }
            performTimedAction(player, ACTION_DURATIONS.PLANT_TREE,
                () => UI.addChatMessage("Régénération de la forêt...", "system"),
                () => { State.applyResourceDeduction(costs); State.updateTileType(player.x, player.y, TILE_TYPES.WASTELAND.regeneration.target); UI.addChatMessage("La friche reverdit !", "gain"); UI.triggerActionFlash('gain'); },
                updateUICallbacks);
            break;
        }
        case ACTIONS.PLANT_TREE: {
            if (tile.type.name !== TILE_TYPES.PLAINS.name) { UI.addChatMessage("Vous ne pouvez planter un arbre que sur une Plaine.", "system"); return; }
            if (tile.buildings.length > 0) { UI.addChatMessage("Vous ne pouvez pas planter un arbre ici, il y a déjà une construction.", "system"); return; } 
            const costs = { 'Graine d\'arbre': 5, 'Eau pure': 1 };
            if (!State.hasResources(costs).success) { UI.addChatMessage("Nécessite 5 graines et 1 eau pure.", "system"); return; }
            performTimedAction(player, ACTION_DURATIONS.PLANT_TREE,
                () => UI.addChatMessage("Vous plantez un arbre...", "system"),
                () => { State.applyResourceDeduction(costs); State.updateTileType(player.x, player.y, 'FOREST'); UI.addChatMessage("Un jeune arbre pousse !", "gain"); UI.triggerActionFlash('gain'); },
                updateUICallbacks);
            break;
        } 
        case ACTIONS.SLEEP: {
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
                        const bldIndex = actionDataPassed.buildingIndex !== undefined ? actionDataPassed.buildingIndex : getBuildingIndexOnTile(tile, actionDataPassed.buildingKeyForDamage);
                        if(bldIndex !== -1) {
                            const damageResult = State.damageBuilding(player.x, player.y, bldIndex, 1);
                            UI.addChatMessage(`${TILE_TYPES[actionDataPassed.buildingKeyForDamage].name} perd 1 durabilité.`, "system_event");
                            if (damageResult.destroyed) UI.addChatMessage(`${damageResult.name} s'est effondré !`, "system_event");
                        }
                    }
                }, updateUICallbacks, { buildingKeyForDamage, buildingIndex: getBuildingIndexOnTile(tile, buildingKeyForDamage) } );
            break;
        }
        case ACTIONS.SLEEP_BY_CAMPFIRE: {
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
                    const cfIndex = findBuildingOnTile(tile, 'CAMPFIRE') ? tile.buildings.findIndex(b => b.key === 'CAMPFIRE') : -1;
                    if (cfIndex !== -1) {
                        const damageResult = State.damageBuilding(player.x, player.y, cfIndex, 1);
                         if (damageResult.destroyed) UI.addChatMessage("Le Feu de Camp s'est éteint et effondré !", "system_event");
                    }
                }, updateUICallbacks);
            break;
        }
        case ACTIONS.COOK: { 
            const { raw, buildingKeyForDamage } = data; 
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

                    State.addResource(player.inventory, cookedItem, 1);
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
        case ACTIONS.SEARCH_ZONE: {
            let canSearch = false;
            let actionCounterToDecrement = null;

            if (tile.type.name === TILE_TYPES.PLAGE.name) {
                 if (tile.actionsLeft && tile.actionsLeft.search_zone > 0) {
                     canSearch = true;
                     actionCounterToDecrement = () => tile.actionsLeft.search_zone--;
                 } else UI.addChatMessage("Vous avez déjà fouillé cette plage.", "system");
            } else if ( (tile.type.name === TILE_TYPES.FOREST.name || tile.type.name === TILE_TYPES.PLAINS.name) && tile.searchActionsLeft > 0) {
                 canSearch = true;
                 actionCounterToDecrement = () => tile.searchActionsLeft--;
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
                    if(actionCounterToDecrement) actionCounterToDecrement(); // Décrémente le compteur, peu importe le résultat

                    const rand = Math.random();
                    if (rand < searchConfig.noLootChance) { 
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
                        if (!foundItem && tierRand >= cumulativeChance) { 
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
                            State.addResource(player.inventory, foundItem, amountFound);
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
        case ACTIONS.TAKE_HIDDEN_ITEM: {
            if (tile.hiddenItem) {
                const itemName = tile.hiddenItem;
                 const itemDef = ITEM_TYPES[itemName];
                if (getTotalResources(player.inventory) >= player.maxInventory && (!player.inventory[itemName] || (itemDef && itemDef.unique))) {
                    UI.addChatMessage("Inventaire plein.", "system"); return;
                }
                State.addResource(player.inventory, itemName, 1);
                UI.showFloatingText(`+1 ${itemName}`, 'gain'); UI.triggerActionFlash('gain');
                UI.addChatMessage(`Vous avez trouvé : ${itemName} !`, 'gain');
                tile.hiddenItem = null;
            } else UI.addChatMessage("Il n'y a rien à prendre ici.", 'system');
            break;
        }
        case ACTIONS.OPEN_TREASURE: {
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
        case ACTIONS.USE_BUILDING_ACTION: {
            const buildingKey = data.buildingKey;
            const specificActionId = data.specificActionId;
            const buildingInstance = buildingKey ? tile.buildings.find(b => b.key === buildingKey) : null; // buildingKey can be null for terrain actions

            if (buildingKey === null && specificActionId === 'play_electric_guitar') { 
                 performToolAction(player, 'weapon', 'play_electric_guitar', (power, toolUsed) => {
                    player.health = Math.min(player.maxHealth, player.health + 3);
                    player.sleep = Math.max(0, player.sleep - 1);
                    UI.addChatMessage("Une mélodie électrisante remplit l'air ! (+3 Santé, -1 Sommeil)", 'system_event');
                 }, updateUICallbacks, {}, 'Guitare');
                 return;
            }


            if (buildingKey && (!buildingInstance || buildingInstance.durability <= 0)) { // Only check if buildingKey is not null
                UI.addChatMessage("Ce bâtiment est inutilisable ou détruit.", "system"); return;
            }
            const buildingDef = buildingKey ? TILE_TYPES[buildingKey] : null; // buildingDef is null for terrain actions

            let actionDef = null;
            if (buildingDef && buildingDef.action && buildingDef.action.id === specificActionId) { 
                actionDef = buildingDef.action;
            } else if (buildingDef && buildingDef.actions) {
                actionDef = buildingDef.actions.find(a => a.id === specificActionId);
            } else if (buildingKey === null && specificActionId === 'search_ore_tile') { 
                 actionDef = TILE_TYPES.MINE_TERRAIN.action;
            }


            if (buildingInstance && buildingInstance.key === 'ATELIER' && specificActionId === 'use_atelier') {
                 UI.showWorkshopModal(State.state); return;
            }
            if (buildingInstance && buildingInstance.key === 'ETABLI' && specificActionId === 'use_etabli') {
                 UI.showWorkshopModal(State.state); return; 
            }
             if (buildingInstance && buildingInstance.key === 'FORGE' && specificActionId === 'use_forge') {
                 UI.showWorkshopModal(State.state); return; 
            }

            if (specificActionId === 'listen_radio_if_charged') {
                UI.addChatMessage("La radio grésille mais vous n'entendez rien d'intéressant pour le moment.", "system");
                return;
            }

            if (specificActionId === 'attempt_call_if_charged') {
                UI.addChatMessage("Vous essayez de passer un appel, mais il n'y a aucun signal.", "system");
                return;
            }


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
                                const amount = Math.ceil(Math.random() * 2); 
                                if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                                    State.addResource(player.inventory, oreResult.item, amount);
                                    UI.showFloatingText(`+${amount} ${oreResult.item}`, "gain");
                                    foundOre = true;
                                } else { UI.addChatMessage(`Inventaire plein, impossible de récupérer ${oreResult.item}.`, "system"); break; }
                            }
                        }
                        if (foundOre) UI.triggerActionFlash('gain');
                        else UI.addChatMessage("Vous n'avez trouvé aucun minerai cette fois.", "system");

                        if (buildingKey && buildingDef) { 
                            const bldIdx = getBuildingIndexOnTile(tile, buildingKey);
                            if (bldIdx !== -1) {
                                const damageResult = State.damageBuilding(player.x, player.y, bldIdx, 1);
                                if (damageResult.destroyed) UI.addChatMessage(`${buildingDef.name} s'est effondré !`, "system_event");
                            }
                        }
                    } 
                }, updateUICallbacks, {}, 'Pioche');
                return; 
            }


            if (!actionDef) {
                UI.addChatMessage("Définition d'action de bâtiment introuvable.", "system"); return;
            }

            if (actionDef.costItem && actionDef.costAmount) {
                if (!player.inventory[actionDef.costItem] || player.inventory[actionDef.costItem] < actionDef.costAmount) {
                    UI.addChatMessage(`Vous n'avez pas assez de ${actionDef.costItem} (${actionDef.costAmount} requis).`, "system"); return;
                }
            }
            if (actionDef.costItems) {
                 if (!State.hasResources(actionDef.costItems).success) {
                    UI.addChatMessage("Ressources manquantes pour cette action.", "system"); return;
                }
            }

            if (buildingInstance && ['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(specificActionId)) {
                if (!buildingInstance.harvestsAvailable || buildingInstance.harvestsAvailable <= 0) {
                    UI.addChatMessage("Rien à récolter pour le moment. Essayez d'arroser/abreuver.", "system");
                    return;
                }
            }
            let duration = ACTION_DURATIONS.USE_BUILDING_ACTION;
            if (specificActionId === 'generate_plan') duration = ACTION_DURATIONS.GENERATE_PLAN;
            else if (specificActionId === 'observe_weather') duration = ACTION_DURATIONS.OBSERVE_WEATHER;
            else if (specificActionId.startsWith('draw_water_')) duration = ACTION_DURATIONS.PUMP_WATER;
            else if (specificActionId.startsWith('boil_')) duration = ACTION_DURATIONS.BOIL_WATER;


            performTimedAction(player, duration,
                () => UI.addChatMessage(`${actionDef.name}...`, "system"),
                () => {
                    let actionSuccess = true;
                    if (actionDef.costItem && actionDef.costAmount) State.applyResourceDeduction({ [actionDef.costItem]: actionDef.costAmount });
                    if (actionDef.costItems) State.applyResourceDeduction(actionDef.costItems);
                    if (actionDef.costWood) State.applyResourceDeduction({ 'Bois': actionDef.costWood });


                    if (actionDef.result) {
                        for (const item in actionDef.result) {
                            if (buildingInstance && ['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(specificActionId)) {
                                if (buildingInstance.harvestsAvailable > 0) { 
                                    buildingInstance.harvestsAvailable--;
                                } else {
                                    UI.addChatMessage("Rien à récolter (plus de charges).", "system_info");
                                    actionSuccess = false; 
                                    break;
                                }
                            }
                            const amount = actionDef.result[item];
                            if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                                State.addResource(player.inventory, item, amount);
                                UI.showFloatingText(`+${amount} ${item}`, "gain");
                            } else {
                                UI.addChatMessage(`Inventaire plein, impossible de récupérer ${item}.`, "system");
                                actionSuccess = false;
                                break;
                            }
                        }
                    }
                    if (buildingInstance && actionDef.durabilityGain) buildingInstance.durability = Math.min(buildingInstance.maxDurability, buildingInstance.durability + actionDef.durabilityGain);
                    if (buildingInstance && (specificActionId === 'water_plantation' || specificActionId === 'abreuver_animaux')) {
                        if (buildingInstance.harvestsAvailable < buildingInstance.maxHarvestsPerCycle) {
                            buildingInstance.harvestsAvailable = Math.min(buildingInstance.maxHarvestsPerCycle, buildingInstance.harvestsAvailable + 1);
                            UI.addChatMessage(`${buildingDef.name} a été entretenu. Récoltes disponibles: ${buildingInstance.harvestsAvailable}/${buildingInstance.maxHarvestsPerCycle}.`, "system_event");
                        } else {
                            UI.addChatMessage(`${buildingDef.name} n'a pas besoin de plus d'entretien pour le moment.`, "system_info");
                            actionSuccess = false; 
                        }
                    }

                    if (specificActionId === 'observe_weather') UI.addChatMessage("Le ciel est clair pour l'instant...", "system_event"); 
                    if (specificActionId === 'generate_plan') UI.addChatMessage("Vous avez passé du temps à chercher, mais n'avez pas encore trouvé de plan clair.", "system_info"); 

                    if (actionSuccess) {
                        UI.triggerActionFlash('gain');
                        if (buildingDef && buildingKey) { // S'assurer que buildingDef existe (pour les actions sur bâtiments)
                            const bldIdx = getBuildingIndexOnTile(tile, buildingKey);
                            if (bldIdx !== -1) {
                                const damageResult = State.damageBuilding(player.x, player.y, bldIdx, 1);
                                if (damageResult.destroyed) UI.addChatMessage(`${buildingDef.name} s'est effondré !`, "system_event");
                            }
                        }
                    }                    
                }, updateUICallbacks);
            break;
        }
        case ACTIONS.CRAFT_ITEM_WORKSHOP: {
            const { recipeName, costs, yields, quantity } = data;
            let hasEnoughResources = true;
            let resourcesFromGround = {};
            let resourcesFromInventory = {};
            const isAtCamp = shelterLocation && player.x === shelterLocation.x && player.y === shelterLocation.y;

            // First, check total resources availability (inventory + ground if at camp)
            for (const itemName in costs) {
                const requiredAmount = costs[itemName] * quantity;
                const inventoryAmount = player.inventory[itemName] || 0;
                let totalAvailable = inventoryAmount;
                if (isAtCamp && tile.groundItems[itemName]) {
                    totalAvailable += tile.groundItems[itemName];
                }
                if (totalAvailable < requiredAmount) {
                    hasEnoughResources = false;
                    break;
                }
                // Plan deduction: prioritize ground items if at camp
                if (isAtCamp && tile.groundItems[itemName]) {
                    const fromGround = Math.min(requiredAmount, tile.groundItems[itemName]);
                    resourcesFromGround[itemName] = fromGround;
                    const remaining = requiredAmount - fromGround;
                    if (remaining > 0) {
                        resourcesFromInventory[itemName] = remaining;
                    }
                } else {
                    resourcesFromInventory[itemName] = requiredAmount;
                }
            }

            if (!hasEnoughResources) {
                UI.addChatMessage("Ressources insuffisantes pour cette fabrication.", "system_error");
                if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
                return;
            }

            UI.triggerActionFlash('cost');
            performTimedAction(player, ACTION_DURATIONS.CRAFT * quantity,
                () => UI.addChatMessage(`Fabrication de ${quantity}x ${recipeName}...`, "system"),
                () => {
                    // Deduct from ground items first if at camp
                    for (const itemName in resourcesFromGround) {
                        const amount = resourcesFromGround[itemName];
                        if (amount > 0) {
                            tile.groundItems[itemName] -= amount;
                            if (tile.groundItems[itemName] <= 0) delete tile.groundItems[itemName];
                            UI.showFloatingText(`-${amount} ${itemName} (sol)`, 'cost');
                        }
                    }
                    // Then deduct from inventory
                    for (const itemName in resourcesFromInventory) {
                        const amount = resourcesFromInventory[itemName];
                        if (amount > 0) {
                            State.applyResourceDeduction({ [itemName]: amount });
                            UI.showFloatingText(`-${amount} ${itemName}`, 'cost');
                        }
                    }
                    // Add crafted items
                    for (const yieldItemName in yields) {
                        State.addResource(player.inventory, yieldItemName, yields[yieldItemName] * quantity);
                        UI.showFloatingText(`+${yields[yieldItemName] * quantity} ${yieldItemName}`, 'gain');
                    }
                    UI.triggerActionFlash('gain');
                    UI.addChatMessage(`${quantity}x ${recipeName} fabriqué(s) !`, 'gain');

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
        case ACTIONS.DISMANTLE_BUILDING: {
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
        case ACTIONS.OPEN_ALL_PARCHEMINS: {
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
        case ACTIONS.FIRE_DISTRESS_GUN: {
            performToolAction(player, 'weapon', 'fire_distress_gun', (power, toolUsed) => {
                 UI.addChatMessage("Vous tirez une fusée de détresse avec le pistolet ! Le ciel s'illumine.", 'system_event');
            }, updateUICallbacks, {}, 'Pistolet de détresse');
            break;
        }
        case ACTIONS.FIRE_DISTRESS_FLARE: {
            const result = State.consumeItem('Fusée de détresse'); 
            UI.addChatMessage(result.message, result.success ? 'system_event' : 'system_error');
            if (result.success) {
                UI.addChatMessage("Vous allumez une fusée de détresse ! Une lueur rouge intense s'élève.", 'system_event');
            }
            break;
        }
        case ACTIONS.PLACE_SOLAR_PANEL_FIXED: {
            const result = State.consumeItem('Panneau solaire fixe'); 
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            if (result.success) {
                UI.addChatMessage("Vous installez le panneau solaire fixe. Il commence à capter l'énergie.", 'system_event');
            }
            break;
        }
        case ACTIONS.CHARGE_BATTERY_PORTABLE_SOLAR: {
             performToolAction(player, 'weapon', 'charge_battery_portable_solar', (power, toolUsed) => {
                if (player.inventory['Batterie déchargée'] > 0) {
                    State.applyResourceDeduction({'Batterie déchargée': 1});
                    State.addResource(player.inventory, 'Batterie chargée', 1);
                    UI.addChatMessage("Vous chargez une batterie avec le panneau solaire portable.", 'gain');
                } else {
                    UI.addChatMessage("Vous n'avez pas de batterie déchargée à charger.", 'system');
                }
            }, updateUICallbacks, {}, 'Panneau solaire portable');
            break;
        }
        case ACTIONS.PLACE_TRAP: {
            const result = State.consumeItem('Piège');
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            if (result.success) {
                UI.addChatMessage("Vous posez un piège. Avec un peu de chance...", 'system_event');
            }
            break;
        }
        case ACTIONS.ATTRACT_NPC_ATTENTION: {
             performToolAction(player, 'weapon', 'attract_npc_attention', (power, toolUsed) => {
                UI.addChatMessage("Vous utilisez le sifflet. Un son strident retentit !", 'system_event');
            }, updateUICallbacks, {}, 'Sifflet');
            break; 
        }
        case ACTIONS.FIND_MINE_COMPASS: {
            performToolAction(player, 'weapon', 'find_mine_compass', (power, toolUsed) => {
                UI.addChatMessage("La boussole semble pointer vers une concentration de minerais...", 'system_event');
            }, updateUICallbacks, {}, 'Boussole');
            break;
        }
        case ACTIONS.REPAIR_BUILDING: { 
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
                    const repairAmount = 20; 
                    buildingToRepair.durability = Math.min(buildingToRepair.maxDurability, buildingToRepair.durability + repairAmount);
                    UI.addChatMessage(`${buildingDefToRepair.name} réparé de ${repairAmount} points. Durabilité: ${buildingToRepair.durability}/${buildingToRepair.maxDurability}`, 'gain');
                } else {
                     UI.addChatMessage("Vous avez besoin d'un Kit de réparation équipé.", "system");
                }
            }, updateUICallbacks, {}, 'Kit de réparation');
            break;
        }
        case ACTIONS.SET_LOCK: {
            const { buildingKey, buildingIndex } = data;
            const buildingInstance = tile.buildings[buildingIndex];
            if (!buildingInstance || buildingInstance.key !== buildingKey || buildingInstance.isLocked) {
                UI.addChatMessage("Impossible de poser un cadenas ici.", "system"); return;
            }
            if (!player.inventory['Cadenas'] || player.inventory['Cadenas'] <= 0) {
                UI.addChatMessage("Vous n'avez pas de cadenas.", "system"); return;
            }
            performTimedAction(player, ACTION_DURATIONS.SET_LOCK,
                () => UI.addChatMessage(`Pose du cadenas sur ${TILE_TYPES[buildingKey].name}...`, "system"),
                () => {
                    UI.showLockModal((code) => { 
                        if (code && code.length === 3) {
                            buildingInstance.isLocked = true;
                            buildingInstance.lockCode = code;
                            player.inventory['Cadenas']--;
                            if (player.inventory['Cadenas'] <= 0) delete player.inventory['Cadenas'];
                            UI.addChatMessage(`Cadenas posé sur ${TILE_TYPES[buildingKey].name}. Code défini.`, "system_event");
                            UI.hideLockModal();
                        } else {
                            UI.addChatMessage("Code invalide. Le cadenas n'a pas été posé.", "system_error");
                        }
                    }, true); 
                }, updateUICallbacks);
            break;
        }
        case ACTIONS.REMOVE_LOCK: {
            const { buildingKey, buildingIndex } = data;
            const buildingInstance = tile.buildings[buildingIndex];
            if (!buildingInstance || buildingInstance.key !== buildingKey || !buildingInstance.isLocked) {
                UI.addChatMessage("Aucun cadenas à retirer ou bâtiment incorrect.", "system"); return;
            }
            const invSpace = player.maxInventory - getTotalResources(player.inventory);
            if (invSpace < 1 && (!player.inventory['Cadenas'] || player.inventory['Cadenas'] === 0) ) { 
                 UI.addChatMessage("Inventaire plein, impossible de récupérer le cadenas.", "system"); return;
            }

            buildingInstance.isLocked = false;
            buildingInstance.lockCode = null;
            State.addResource(player.inventory, 'Cadenas', 1);
            tile.playerHasUnlockedThisSession = false; 
            UI.addChatMessage(`Cadenas retiré de ${TILE_TYPES[buildingKey].name} et ajouté à votre inventaire.`, "system_event");
            break;
        }


        case ACTIONS.OPEN_LARGE_MAP: { UI.showLargeMap(State.state); break; } 
        case ACTIONS.TALK_TO_NPC: { if (data.npcId) npcInteractionHandler(data.npcId); break; } 
        case ACTIONS.OPEN_BUILDING_INVENTORY: {
            const { buildingKey, buildingIndex } = data;
            const buildingInstance = tile.buildings[buildingIndex];
            if (!buildingInstance || buildingInstance.key !== buildingKey) { UI.addChatMessage("Coffre introuvable.", "system"); return; }

            if (buildingInstance.isLocked && !tile.playerHasUnlockedThisSession) {
                const now = Date.now();
                if (tile.lastLockAttemptTimestamp && (now - tile.lastLockAttemptTimestamp) < 20000) {
                    UI.addChatMessage("Veuillez attendre avant de réessayer le code.", "system_error"); return;
                }
                UI.showLockModal((code) => {
                    if (code === buildingInstance.lockCode) {
                        tile.playerHasUnlockedThisSession = true; 
                        UI.hideLockModal(); UI.showInventoryModal(State.state);
                    } else {
                        UI.addChatMessage("Ce n'est pas le bon code.", "system_error"); tile.lastLockAttemptTimestamp = Date.now(); UI.hideLockModal();
                    }
                }, false);
            } else UI.showInventoryModal(State.state); 
            break;
        }
        default: UI.addChatMessage(`Action "${actionId}" non reconnue.`, 'system_error');
    }
}
