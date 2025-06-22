// js/interactions.js
import { TILE_TYPES, CONFIG, ACTION_DURATIONS, ORE_TYPES, COMBAT_CONFIG, ITEM_TYPES, SEARCH_ZONE_CONFIG, ENEMY_TYPES, ALL_SEARCHABLE_ITEMS, TREASURE_COMBAT_KIT } from './config.js';
import * as UI from './ui.js';
import * as State from './state.js';
import { getTotalResources } from './player.js';
import { findEnemyOnTile } from './enemy.js';
import DOM from './ui/dom.js';
import { handleNpcInteraction as npcInteractionHandler } from './npc.js';

function applyActionCosts(player, costs) {
    // Ne pas afficher de texte flottant ici pour les coûts de stats, car applyRandomStatCost le fait déjà ou est désactivé.
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
        return true; // Indique que le coût a été "appliqué" (le joueur est à 0 partout)
    }
    const rand = Math.random();
    let selectedStatChoice = null;

    // Prioriser la soif si elle est basse, puis la faim, puis le sommeil
    if (rand < 0.10 && player.thirst > 0) selectedStatChoice = availableStats.find(s => s.name === 'thirst');
    else if (rand < 0.50 && player.hunger > 0) selectedStatChoice = availableStats.find(s => s.name === 'hunger');
    else if (player.sleep > 0) selectedStatChoice = availableStats.find(s => s.name === 'sleep');

    // Fallback si aucun n'a été choisi par la priorité (ex: soif et faim sont à 0)
    if (!selectedStatChoice && availableStats.length > 0) {
        selectedStatChoice = availableStats[Math.floor(Math.random() * availableStats.length)];
    }

    if (selectedStatChoice) {
        chosenStatName = selectedStatChoice.name;
        statIcon = selectedStatChoice.icon;
        player[chosenStatName] = Math.max(0, player[chosenStatName] - amount);
        // UI.showFloatingText(`-${amount}${statIcon}`, 'cost'); // Point 23: Texte flottant pour coûts désactivé
        const maxStatValue = player[`max${chosenStatName.charAt(0).toUpperCase() + chosenStatName.slice(1)}`];
        if (player[chosenStatName] <= (maxStatValue * 0.1) && player[chosenStatName] > 0 ) { // Avertir si la stat devient très basse
            UI.addChatMessage(`Attention, votre ${chosenStatName} est très basse !`, "warning");
        }
    }
    return true; // Toujours retourner true pour indiquer que la fonction a été exécutée
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
        if(typeof onComplete === 'function') onComplete(actionData); // Passer actionData à onComplete
        player.isBusy = false;
        console.log("[performTimedAction] Joueur n'est plus occupé.");
        if (updateUICallbacks && updateUICallbacks.updateAllUI) updateUICallbacks.updateAllUI();
    }, duration);
}


// Modifiée pour gérer la durabilité des outils plus génériquement
function performToolAction(player, toolSlot, actionType, onComplete, updateUICallbacks, actionData = {}, specificToolName = null) {
    const tool = player.equipment[toolSlot];

    if (specificToolName) { // Si un nom d'outil spécifique est requis (ex: "Pelle en bois")
        if (!tool || tool.name !== specificToolName) {
            UI.addChatMessage(`Vous avez besoin d'un(e) ${specificToolName} équipé(e).`, 'system');
            if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
            else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
            return;
        }
    } else if (actionType) { // Si un type d'action est requis (ex: 'dig', 'harvest_wood')
        if (!tool || tool.action !== actionType) {
            UI.addChatMessage(`Vous n'avez pas le bon outil équipé pour cette action.`, 'system');
             if (DOM.equipmentSlotsEl) UI.triggerShake(DOM.equipmentSlotsEl);
             else if (DOM.bottomBarEquipmentSlotsEl) UI.triggerShake(DOM.bottomBarEquipmentSlotsEl);
            return;
        }
    }
    // Si ni specificToolName ni actionType, on assume que l'action peut se faire à mains nues ou que la vérification est ailleurs

    performTimedAction(player, ACTION_DURATIONS.HARVEST, // Ou une autre durée si pertinent
        () => UI.addChatMessage(`Utilisation de ${tool ? tool.name : 'vos mains'}...`, 'system'),
        () => {
            onComplete(tool ? tool.power : 1, tool); // Passer l'outil à onComplete
            if (tool && tool.hasOwnProperty('currentDurability') && typeof tool.currentDurability === 'number') {
                tool.currentDurability--;
                if (tool.currentDurability <= 0) {
                    UI.addChatMessage(`${tool.name} s'est cassé !`, 'system_warning');
                    State.unequipItem(toolSlot); // Utiliser la fonction de State pour déséquiper proprement
                }
            } else if (tool && tool.hasOwnProperty('uses')) { // Pour les objets avec "uses" (comme la carte)
                 tool.uses--; // Cette logique est mieux dans State.consumeItem pour la carte
                 if (tool.uses <= 0) {
                     UI.addChatMessage(`${tool.name} est épuisé !`, 'system_warning');
                     State.unequipItem(toolSlot);
                 }
            }
            // Mettre à jour l'UI de l'équipement après une possible casse/épuisement
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
            State.unequipItem('weapon'); // Utiliser State.unequipItem
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
    switch(actionId) {
        case 'sleep': case 'initiate_combat': case 'take_hidden_item': case 'open_treasure':
        case 'use_building_action': case 'consume_eau_salee': case 'open_large_map':
        case 'talk_to_npc': /* 'drop_item_prompt' supprimé */ case 'open_building_inventory':
        case 'plant_tree': case 'sleep_by_campfire': case 'dismantle_building':
            shouldApplyBaseCost = false; // Ces actions ont leurs propres coûts ou pas de coût de stat de base
            break;
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
        case 'consume_eau_salee': { // Point 2, 4
            if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                UI.addChatMessage("Vous ne pouvez boire de l'eau salée que sur la plage.", "system"); return;
            }
            if (player.thirst > player.maxThirst - 2) {
                 UI.addChatMessage("Vous n'avez pas assez soif pour risquer de boire ceci.", "system"); return;
            }
            if (player.inventory['Eau salée'] > 0) {
                const result = State.consumeItem('Eau salée'); // La logique d'effet est dans State.consumeItem
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                if (result.success && result.floatingTexts) {
                    result.floatingTexts.forEach(text => {
                         if (!text.includes('💧')) { // Ne pas afficher le +1 soif pour l'eau salée
                             UI.showFloatingText(text, text.startsWith('-') ? 'cost' : 'info')
                         }
                    });
                }
            } else {
                UI.addChatMessage("Vous n'avez plus d'Eau salée.", "system");
            }
            break;
        }
        case 'harvest_salt_water': { // Point 7 (Récolter Eau Salée) et Point 1 (Actions Plage)
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
                    let toolUsedForSaltWater = null;
                    if (player.equipment.weapon && player.equipment.weapon.name === 'Seau') {
                        amount = 3;
                        toolUsedForSaltWater = player.equipment.weapon;
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    if (availableSpace >= amount) {
                        State.addResourceToPlayer('Eau salée', amount);
                        UI.showFloatingText(`+${amount} Eau salée`, 'gain'); UI.triggerActionFlash('gain');
                        tile.actionsLeft.harvest_salt_water--;

                        if (toolUsedForSaltWater && toolUsedForSaltWater.hasOwnProperty('currentDurability')) {
                            toolUsedForSaltWater.currentDurability--;
                            if (toolUsedForSaltWater.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsedForSaltWater.name} s'est cassé !`, 'system_warning');
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
        case 'harvest_sand': { // Point 1 (Actions Plage) et Point 9 (Récolter Sable)
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
                    let toolUsedForSand = null;
                    if (player.equipment.weapon) {
                        const weaponName = player.equipment.weapon.name;
                        if (weaponName === 'Pelle en bois' || weaponName === 'Seau') {
                            yieldAmount = 3;
                            toolUsedForSand = player.equipment.weapon;
                        } else if (weaponName === 'Pelle en fer') {
                            yieldAmount = 5;
                            toolUsedForSand = player.equipment.weapon;
                        }
                    }

                    const availableSpace = player.maxInventory - getTotalResources(player.inventory);
                    const amountToHarvest = Math.min(yieldAmount, availableSpace);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Sable', amountToHarvest);
                        UI.showFloatingText(`+${amountToHarvest} Sable`, 'gain'); UI.triggerActionFlash('gain');
                        tile.actionsLeft.harvest_sand--;

                        if (toolUsedForSand && toolUsedForSand.hasOwnProperty('currentDurability')) {
                            toolUsedForSand.currentDurability--;
                            if (toolUsedForSand.currentDurability <= 0) {
                                UI.addChatMessage(`${toolUsedForSand.name} s'est cassé !`, 'system_warning');
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
        case 'harvest': {
            const resource = tile.type.resource;
            if (!resource || resource.type === 'Sable' || resource.type === 'Eau salée') {
                console.warn("[handlePlayerAction - harvest] Action générique appelée pour une ressource gérée spécifiquement ou absente."); return;
            }
            if (tile.harvestsLeft <= 0 && tile.harvestsLeft !== Infinity) {
                 UI.addChatMessage("Plus rien à récolter ici.", "system"); return;
            }

            const specificResourceCosts = { thirst: resource.thirstCost || 0, hunger: resource.hungerCost || 0, sleep: resource.sleepCost || 0 };
            let canProceed = true;
            if (specificResourceCosts.thirst > 0 && player.thirst === 0) canProceed = false;
            if (specificResourceCosts.hunger > 0 && player.hunger === 0) canProceed = false;
            if (specificResourceCosts.sleep > 0 && player.sleep === 0) canProceed = false;
            if (!canProceed) { UI.addChatMessage("Vous êtes trop épuisé pour cette récolte.", "system"); return; }

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
        case 'harvest_wood_hache':
        case 'harvest_wood_scie':
        case 'harvest_wood_mains': {
            const requiredToolName = actionId === 'harvest_wood_hache' ? 'Hache' : (actionId === 'harvest_wood_scie' ? 'Scie' : null);
            performToolAction(player, 'weapon',
                'harvest_wood',
                (powerOverride, toolUsed) => {
                    const forestTile = map[player.y][player.x];
                    if (forestTile.type.name !== TILE_TYPES.FOREST.name || forestTile.harvestsLeft <= 0) {
                        UI.addChatMessage("Plus de bois à couper/ramasser ici ou ce n'est pas une forêt.", "system"); return;
                    }

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
                    const amountToHarvest = Math.min(woodYield, availableSpace, forestTile.harvestsLeft === Infinity ? Infinity : forestTile.harvestsLeft);

                    if (amountToHarvest > 0) {
                        State.addResourceToPlayer('Bois', amountToHarvest);
                        if(forestTile.harvestsLeft !== Infinity) forestTile.harvestsLeft -= amountToHarvest;
                        UI.showFloatingText(`+${amountToHarvest} Bois`, 'gain'); UI.triggerActionFlash('gain');
                        UI.addChatMessage(`Vous obtenez ${amountToHarvest} Bois avec ${toolUsedNameForMessage}.`, 'system');
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
                {},
                requiredToolName
            );
            break;
        }
        case 'fish': { // Point 1 (Actions Plage)
             if (tile.type.name !== TILE_TYPES.PLAGE.name) {
                 UI.addChatMessage("Vous ne pouvez pêcher que sur la plage.", "system"); return;
            }
            if (!tile.actionsLeft || tile.actionsLeft.fish <= 0) {
                UI.addChatMessage("Vous ne pouvez plus pêcher ici pour le moment.", "system"); return;
            }
            performToolAction(player, 'weapon', 'fish', (power, toolUsed) => {
                const fishCaught = Math.ceil(Math.random() * power);
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
            }, updateUICallbacks, {}, 'Canne à pêche'); // S'assurer que 'Canne à pêche' est requis
            break;
        }
        case 'hunt': {
             const weapon = player.equipment.weapon;
             if (!weapon) { UI.addChatMessage("Vous ne pouvez pas chasser sans arme.", "system"); return; }
             performTimedAction(player, ACTION_DURATIONS.CRAFT, // Durée de chasse
                () => UI.addChatMessage(`Vous chassez avec ${weapon.name}...`, "system"),
                () => {
                    if (Math.random() < 0.6) { // Chance de succès
                        const baseAmount = (weapon.stats?.damage || weapon.power || 1);
                        const amount = baseAmount * (Math.floor(Math.random() * 2) + 1); // Rendement basé sur l'arme
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
                }
            }

            if (!hasRequiredToolForBuild) {
                 UI.addChatMessage(`Outil requis non équipé : ${toolRequiredArray.join(' ou ')}.`, "system"); return;
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

                    if (actualToolUsed && actualToolUsed.isFireStarter && structureKey === 'CAMPFIRE') { // Point 16: Consommer durabilité
                        if (actualToolUsed.hasOwnProperty('currentDurability')) {
                            actualToolUsed.currentDurability--;
                            if (actualToolUsed.currentDurability <= 0) {
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
        case 'regenerate_forest': { /* ... (logique existante) ... */ break; }
        case 'plant_tree': { /* ... (logique existante) ... */ break; }
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
                (actionDataPassed) => { // actionDataPassed contient buildingKeyForDamage
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
                }, updateUICallbacks, { buildingKeyForDamage } ); // Passer buildingKeyForDamage dans actionData
            break;
        }
        case 'sleep_by_campfire': { // Point 18
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
        case 'cook': {
            const campfire = findBuildingOnTile(tile, 'CAMPFIRE');
            if (!campfire) { UI.addChatMessage("Vous avez besoin d'un feu de camp pour cuisiner.", "system"); return; }
            if (campfire.durability <= 0) { UI.addChatMessage("Le feu de camp est éteint et inutilisable.", "system"); return;}

            const cookable = { 'Poisson cru': 'Poisson cuit', 'Viande crue': 'Viande cuite', 'Oeuf cru': 'Oeuf cuit' };
            const rawMaterial = data.raw; const cookedItem = cookable[rawMaterial];
            if (!rawMaterial || !cookedItem) { UI.addChatMessage("Ingrédient de cuisine invalide.", "system"); return; }
            // Points 29,30,31: Vérification déjà faite dans updatePossibleActions pour afficher le bouton
            if (!player.inventory[rawMaterial] || player.inventory[rawMaterial] < 1) {
                UI.addChatMessage(`Vous n'avez pas de ${rawMaterial} à cuisiner.`, "system"); return;
            }
            if (!State.hasResources({ 'Bois': 1 }).success) {
                UI.addChatMessage(`Il faut du Bois pour alimenter le feu.`, "system");
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
        case 'search_zone': { // Point 1 (Actions Plage)
            if (tile.type.name === TILE_TYPES.PLAGE.name) {
                 if (!tile.actionsLeft || tile.actionsLeft.search_zone <= 0) {
                    UI.addChatMessage("Vous ne pouvez plus fouiller cette plage pour le moment.", "system"); return;
                }
            }

            const tileName = tile.type.name;
            let tileKeyForSearch = null;
            for (const key in TILE_TYPES) if (TILE_TYPES[key].name === tileName) { tileKeyForSearch = key; break; }
            const searchConfig = tileKeyForSearch ? SEARCH_ZONE_CONFIG[tileKeyForSearch] : null;
            if (!searchConfig) { UI.addChatMessage("Vous ne pouvez pas fouiller cette zone en détail.", "system"); return; }

            performTimedAction(player, ACTION_DURATIONS.SEARCH,
                () => UI.addChatMessage("Vous fouillez attentivement les environs...", "system"),
                () => {
                    if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) { // Décrémenter l'action pour la plage
                        tile.actionsLeft.search_zone--;
                    }
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
                                    const itemDef = ITEM_TYPES[itemName];
                                    if (itemDef && itemDef.teachesRecipe && itemDef.unique) { // Point 23: Parchemins uniques
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
                        if (!foundItem && tierRand >= cumulativeChance) { // Fallback si aucun tier n'a été touché
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
                            if (ITEM_TYPES[foundItem]?.teachesRecipe && ITEM_TYPES[foundItem]?.unique) { // Point 23
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
                tile.hiddenItem = null; // L'objet est pris
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
                    // Ajouter le contenu du trésor à l'inventaire du joueur ou au sol si plein
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
            const buildingInstance = tile.buildings.find(b => b.key === buildingKey); // Devrait être tile.buildings[data.buildingIndex] si index est passé
            if (!buildingInstance || buildingInstance.durability <= 0) {
                UI.addChatMessage("Ce bâtiment est inutilisable ou détruit.", "system"); return;
            }
            const buildingDef = TILE_TYPES[buildingKey];
            const actionDef = (buildingDef.actions || (buildingDef.action ? [buildingDef.action] : [])).find(a => a.id === specificActionId);

            if (!actionDef) { UI.addChatMessage("Action de bâtiment inconnue.", "system"); return; }

            if (actionDef.costItem && (!player.inventory[actionDef.costItem] || player.inventory[actionDef.costItem] < 1)) {
                UI.addChatMessage(`Vous n'avez pas de ${actionDef.costItem} pour cette action.`, "system"); return;
            }

            performTimedAction(player, ACTION_DURATIONS.USE_BUILDING_ACTION,
                () => UI.addChatMessage(`${actionDef.name}...`, "system"),
                () => {
                    let actionSuccess = true;
                    if (actionDef.costItem) State.applyResourceDeduction({ [actionDef.costItem]: 1 });
                    if (actionDef.result) {
                        for (const item in actionDef.result) {
                            const amount = actionDef.result[item];
                            if (getTotalResources(player.inventory) + amount <= player.maxInventory) {
                                State.addResourceToPlayer(item, amount);
                                UI.showFloatingText(`+${amount} ${item}`, "gain");
                            } else {
                                UI.addChatMessage(`Inventaire plein, impossible de récupérer ${item}.`, "system");
                                actionSuccess = false; // L'action principale a eu lieu, mais le résultat n'est pas stocké
                                break;
                            }
                        }
                    }
                    if (actionDef.durabilityGain) buildingInstance.durability = Math.min(buildingInstance.maxDurability, buildingInstance.durability + actionDef.durabilityGain);

                    // Logique spécifique pour certaines actions de bâtiment
                    if (specificActionId === 'use_laboratoire' && data.craftItem === 'Antiseptique') { // Point 38
                         const costs = { 'Kit de Secours': 2, 'Recette médicinale': 1 };
                         if (!State.hasResources(costs).success) {
                            UI.addChatMessage("Ressources manquantes pour fabriquer l'Antiseptique.", "system"); actionSuccess = false;
                         } else {
                            State.applyResourceDeduction(costs);
                            State.addResourceToPlayer('Antiseptique', 1);
                            UI.showFloatingText(`+1 Antiseptique`, "gain");
                         }
                    } else if (specificActionId === 'boil_stagnant_water_campfire') { // Point 27
                        if (!player.inventory['Eau croupie'] || player.inventory['Eau croupie'] < 1) {
                            UI.addChatMessage("Vous n'avez pas d'Eau croupie à faire bouillir.", "system"); actionSuccess = false;
                        } else if (!State.hasResources({ 'Bois': 1 }).success) {
                             UI.addChatMessage("Il faut du Bois pour alimenter le feu.", "system"); actionSuccess = false;
                        } else {
                            State.applyResourceDeduction({ 'Eau croupie': 1, 'Bois': 1 });
                            State.addResourceToPlayer('Eau pure', 1);
                            UI.showFloatingText(`+1 Eau pure`, "gain");
                        }
                    } else if (specificActionId === 'boil_salt_water_campfire') { // Point 28
                        if (!player.inventory['Eau salée'] || player.inventory['Eau salée'] < 1) {
                            UI.addChatMessage("Vous n'avez pas d'Eau salée à faire bouillir.", "system"); actionSuccess = false;
                        } else if (!State.hasResources({ 'Bois': 1 }).success) {
                             UI.addChatMessage("Il faut du Bois pour alimenter le feu.", "system"); actionSuccess = false;
                        } else {
                            State.applyResourceDeduction({ 'Eau salée': 1, 'Bois': 1 });
                            State.addResourceToPlayer('Sel', 1);
                            UI.showFloatingText(`+1 Sel`, "gain");
                        }
                    }


                    if (actionSuccess) UI.triggerActionFlash('gain');

                    const bldIdx = getBuildingIndexOnTile(tile, buildingKey); // Récupérer l'index correct
                    if (bldIdx !== -1) { // S'assurer que l'index est valide
                        const damageResult = State.damageBuilding(player.x, player.y, bldIdx, 1); // Utiliser l'index
                        if (damageResult.destroyed) UI.addChatMessage(`${buildingDef.name} s'est effondré !`, "system_event");
                        else UI.addChatMessage(`${buildingDef.name} perd 1 durabilité.`, "system_event");
                    }

                }, updateUICallbacks);
            break;
        }
        case 'dismantle_building': { // Point 14
            const buildingIndex = data.buildingIndex; // Assurez-vous que l'index est correctement passé
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
        case 'open_large_map': { UI.showLargeMap(State.state); break; }
        case 'talk_to_npc': { if (data.npcId) npcInteractionHandler(data.npcId); break; }
        case 'open_building_inventory': { UI.showInventoryModal(State.state); break; }
        default: UI.addChatMessage(`Action "${actionId}" non reconnue.`, 'system_error');
    }
}