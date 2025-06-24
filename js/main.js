// js/main.js
import * as UI from './ui.js';
import { initDOM } from './ui/dom.js'; // Correction du chemin
import DOM from './ui/dom.js'; // Correction du chemin
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES, ITEM_TYPES, SEARCH_ZONE_CONFIG } from './config.js';
import * as State from './state.js';
import { decayStats, getTotalResources } from './player.js';
import { updateNpcs, npcChatter } from './npc.js';
import { updateEnemies, findEnemyOnTile, spawnSingleEnemy } from './enemy.js';
import * as Interactions from './interactions.js';
import { initAdminControls } from './admin.js';

let lastFrameTimestamp = 0;
let lastStatDecayTimestamp = 0;
let draggedItemInfo = null;

function updatePossibleActions() {
    if (!DOM.actionsEl) return;
    const oldScrollTop = DOM.actionsEl.scrollTop;
    DOM.actionsEl.innerHTML = '';

    if (!State.state || !State.state.player) return;
    const { player, map, combatState, enemies, knownRecipes, tutorialState } = State.state;

    if (tutorialState.active && !tutorialState.isTemporarilyHidden && tutorialState.step > 0) {
        const p = document.createElement('p');
        p.textContent = "Actions désactivées pendant le tutoriel.";
        p.style.textAlign = 'center';
        p.style.padding = '10px';
        DOM.actionsEl.appendChild(p);
        DOM.actionsEl.scrollTop = oldScrollTop;
        return;
    }

    if (!map || !map[player.y] || !map[player.y][player.x]) return;

    const tile = map[player.y][player.x];
    const tileType = tile.type;
    const enemyOnTile = findEnemyOnTile(player.x, player.y, enemies);

    const createButton = (text, actionId, data = {}, disabled = false, title = '', parent = DOM.actionsEl) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled || (tutorialState.active && !tutorialState.isTemporarilyHidden && tutorialState.step > 0) || player.isBusy;
        button.title = title;
        button.onclick = (e) => {
            if ((tutorialState.active && !tutorialState.isTemporarilyHidden && tutorialState.step > 0) || player.isBusy) return;
            handleGlobalPlayerAction(actionId, data);
        };
        parent.appendChild(button);
        return button;
    };


    if (combatState || player.isBusy) {
        const statusDiv = document.createElement('div');
        statusDiv.style.textAlign = 'center';
        statusDiv.style.padding = '12px';
        if (combatState) {
            statusDiv.textContent = `EN COMBAT CONTRE ${combatState.enemy.name}!`;
            statusDiv.style.color = 'var(--accent-color)';
            statusDiv.style.fontWeight = 'bold';
        } else {
            statusDiv.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        }
        DOM.actionsEl.appendChild(statusDiv);
        DOM.actionsEl.scrollTop = oldScrollTop;
        return;
    }

    if (enemyOnTile) {
        const enemyStatus = document.createElement('div');
        enemyStatus.style.textAlign = 'center';
        enemyStatus.style.padding = '12px';
        enemyStatus.style.color = 'var(--accent-color)';
        enemyStatus.innerHTML = `<strong>DANGER !</strong><br>Un ${enemyOnTile.name} vous bloque le passage.`;
        DOM.actionsEl.appendChild(enemyStatus);
        createButton(`⚔️ Attaquer ${enemyOnTile.name}`, 'initiate_combat');
        DOM.actionsEl.scrollTop = oldScrollTop;
        return;
    }

    const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;

    if (tileType.name === TILE_TYPES.PLAGE.name) {
        const canSearchPlage = tile.actionsLeft && tile.actionsLeft.search_zone > 0;
        createButton(`🔎 Fouiller la plage (${tile.actionsLeft?.search_zone || 0})`, 'search_zone', {}, !canSearchPlage || isInventoryFull,
            !canSearchPlage ? "Plus d'actions de fouille ici" : (isInventoryFull ? "Inventaire plein" : "Chercher des objets"));

        const canHarvestSand = tile.actionsLeft && tile.actionsLeft.harvest_sand > 0;
        createButton(`⏳ Récolter Sable (${tile.actionsLeft?.harvest_sand || 0})`, 'harvest_sand', {}, !canHarvestSand || isInventoryFull,
            !canHarvestSand ? "Plus d'actions de récolte de sable" : (isInventoryFull ? "Inventaire plein" : "Récolter du sable"));

        const canFishPlage = tile.actionsLeft && tile.actionsLeft.fish > 0;
        const hasCaneEquipped = player.equipment.weapon && player.equipment.weapon.name === 'Canne à pêche';
        const hasNetEquipped = player.equipment.weapon && player.equipment.weapon.name === 'Filet de pêche';

        if (hasCaneEquipped) {
             createButton(`🎣 Pêcher (Canne) (${tile.actionsLeft?.fish || 0})`, 'fish', {}, !canFishPlage || isInventoryFull,
                !canFishPlage ? "Plus d'actions de pêche" : (isInventoryFull ? "Inventaire plein" : "Pêcher du poisson"));
        }
        if (hasNetEquipped && player.equipment.weapon.currentUses > 0) {
            createButton(`🥅 Pêcher (Filet) (${player.equipment.weapon.currentUses || ITEM_TYPES['Filet de pêche'].uses} uses)`, 'net_fish', {}, isInventoryFull,
                isInventoryFull ? "Inventaire plein" : "Pêcher au filet");
        }

        const canHarvestSaltWater = tile.actionsLeft && tile.actionsLeft.harvest_salt_water > 0;
        createButton(`💧 Récolter Eau Salée (${tile.actionsLeft?.harvest_salt_water || 0})`, 'harvest_salt_water', {}, !canHarvestSaltWater || isInventoryFull,
            !canHarvestSaltWater ? "Plus d'actions de récolte d'eau salée" : (isInventoryFull ? "Inventaire plein" : "Récolter de l'eau salée"));
    } else if (tileType.name === TILE_TYPES.FOREST.name || tileType.name === TILE_TYPES.PLAINS.name) {
        const canSearchHere = tile.searchActionsLeft > 0;
        createButton(`🔎 Fouiller la zone (${tile.searchActionsLeft || 0})`, 'search_zone', {}, !canSearchHere || isInventoryFull,
            !canSearchHere ? "Zone déjà fouillée" : (isInventoryFull ? "Inventaire plein" : "Chercher des objets..."));
    }

    if (tileType.name === TILE_TYPES.FOREST.name || tileType.name === TILE_TYPES.PLAINS.name) {
        const equippedWeaponForActionsHunt = player.equipment.weapon;
        const canHunt = equippedWeaponForActionsHunt && (equippedWeaponForActionsHunt.stats && equippedWeaponForActionsHunt.stats.damage > 0);
        const huntActionsAvailable = tile.huntActionsLeft > 0;
        let huntDisabledReason = "";
        if (!huntActionsAvailable) huntDisabledReason = "Plus de chasse ici.";
        else if (!canHunt) huntDisabledReason = "Nécessite une arme infligeant des dégâts.";
        else if (player.status.includes('Drogué')) huntDisabledReason = "Impossible de chasser sous l'effet de la drogue.";
        createButton(`🏹 Chasser (${tile.huntActionsLeft || 0})`, 'hunt', {}, !huntActionsAvailable || !canHunt || player.status.includes('Drogué'), huntDisabledReason);
    }

    if (tileType.name === TILE_TYPES.PLAINS.name) {
        const canPlant = State.hasResources({ 'Graine d\'arbre': 5, 'Eau pure': 1 }).success;
        if (tile.buildings.length === 0) {
            createButton("🌱 Planter Arbre", 'plant_tree', {}, !canPlant, !canPlant ? "Nécessite 5 graines, 1 eau pure" : "Transformer cette plaine en forêt");
        }
    }
    if (tileType.name === TILE_TYPES.WASTELAND.name) {
        const costsRegen = TILE_TYPES.WASTELAND.regeneration.cost;
        const canRegen = State.hasResources(costsRegen).success;
        createButton("🌳 Régénérer Forêt", 'regenerate_forest', {}, !canRegen, !canRegen ? `Nécessite ${costsRegen['Eau pure']} Eau pure, ${costsRegen['Graine d\'arbre']} Graines` : "Transformer cette friche en forêt");
    }


    if (tile.type === TILE_TYPES.TREASURE_CHEST) {
        if (!tile.isOpened) {
            const hasKey = player.inventory[TILE_TYPES.TREASURE_CHEST.requiresKey] > 0;
            createButton("💎 Ouvrir le Trésor", 'open_treasure', {}, !hasKey || isInventoryFull,
                !hasKey ? `Nécessite : ${TILE_TYPES.TREASURE_CHEST.requiresKey}` : (isInventoryFull ? "Inventaire plein pour recevoir le contenu" : "Utiliser la clé pour ouvrir"));
        } else {
            const p = document.createElement('p');
            p.textContent = "Ce trésor a déjà été vidé.";
            p.style.textAlign = 'center';
            DOM.actionsEl.appendChild(p);
        }
    }

    if (tile.hiddenItem) {
        createButton(`🔑 Prendre ${tile.hiddenItem}`, 'take_hidden_item', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : `Ramasser ${tile.hiddenItem}`);
    }

    if (tileType.resource && (tile.harvestsLeft > 0 || tile.harvestsLeft === Infinity) && !findEnemyOnTile(player.x, player.y, enemies) && !Interactions.findBuildingOnTile(tile, 'MINE')) {
        if (tileType.name === TILE_TYPES.FOREST.name) {
            const canHarvestWood = tile.woodActionsLeft > 0;
            const equippedWeapon = player.equipment.weapon;
            if (equippedWeapon) {
                if (equippedWeapon.name === 'Hache') {
                    createButton(`🪓 Couper Bois (Hache) (${tile.woodActionsLeft || 0})`, 'harvest_wood_hache', {}, isInventoryFull || !canHarvestWood, isInventoryFull ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
                } else if (equippedWeapon.name === 'Scie') {
                    createButton(`🪚 Scier Bois (Scie) (${tile.woodActionsLeft || 0})`, 'harvest_wood_scie', {}, isInventoryFull || !canHarvestWood, isInventoryFull ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
                }
            }
            if (!equippedWeapon) {
                createButton(`✋ Ramasser Bois (${tile.woodActionsLeft || 0})`, 'harvest_wood_mains', {}, isInventoryFull || !canHarvestWood, isInventoryFull ? "Inventaire plein" : (!canHarvestWood ? "Plus de bois ici" : ""));
            }
        } else if (tileType.name === TILE_TYPES.MINE_TERRAIN.name) {
            const canHarvestStone = tile.harvestsLeft > 0;
            const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
            createButton(`${resourceIcon} Récolter Pierre (${tile.harvestsLeft || 0})`, 'harvest', {}, isInventoryFull || !canHarvestStone, isInventoryFull ? "Inventaire plein" : (!canHarvestStone ? "Plus de pierre ici" : ""));
        }
    }

    const hasPiocheEquipped = player.equipment.weapon && player.equipment.weapon.name === 'Pioche';
    if (tileType.name === TILE_TYPES.MINE_TERRAIN.name && hasPiocheEquipped && !Interactions.findBuildingOnTile(tile, 'MINE')) {
        createButton("⛏️ Chercher Minerais (Terrain)", 'use_building_action', { buildingKey: null, specificActionId: 'search_ore_tile' });
    }
    if (player.equipment.weapon && player.equipment.weapon.name === 'Guitare') {
        createButton("🎸 Jouer de la guitare électrique", 'use_building_action', { buildingKey: null, specificActionId: 'play_electric_guitar' });
    }

    if (player.inventory['Eau salée'] > 0 && tileType.name === TILE_TYPES.PLAGE.name && player.thirst <= player.maxThirst - ITEM_TYPES['Eau salée'].effects.thirst) {
        createButton("🚱 Boire Eau Salée", 'consume_eau_salee', {itemName: 'Eau salée'});
    }

    const parcheminCount = State.countItemTypeInInventory('teachesRecipe');
    if (parcheminCount >= 2) {
        createButton("📜 Ouvrir tous les Parchemins", 'open_all_parchemins');
    }


    if (!combatState) {
        const npcsOnTile = State.state.npcs.filter(npc => npc.x === player.x && npc.y === player.y);
        npcsOnTile.forEach(npc => {
            createButton(`💬 Parler à ${npc.name}`, 'talk_to_npc', { npcId: npc.id });
        });
    }

    if (tile.type.buildable && tile.buildings.length < CONFIG.MAX_BUILDINGS_PER_TILE && tile.type.name !== TILE_TYPES.PLAGE.name) {
        const mainBuildButton = document.createElement('button');
        mainBuildButton.id = 'main-build-btn';
        mainBuildButton.textContent = "🏗️ Construire...";
        mainBuildButton.disabled = (tutorialState.active && !tutorialState.isTemporarilyHidden && tutorialState.step > 0) || player.isBusy;
        mainBuildButton.onclick = () => {
            if ((tutorialState.active && !tutorialState.isTemporarilyHidden && tutorialState.step > 0) || player.isBusy) return;
            UI.showBuildModal(State.state);
        };
        DOM.actionsEl.appendChild(mainBuildButton);
    }

    if (tile.buildings && tile.buildings.length > 0) {
        const buildingsHeader = document.createElement('h4');
        buildingsHeader.textContent = "Actions des Bâtiments";
        DOM.actionsEl.appendChild(buildingsHeader);

        tile.buildings.forEach((buildingInstance, index) => {
            const buildingDef = TILE_TYPES[buildingInstance.key];
            if (!buildingDef) return;

            const buildingNameDisplay = document.createElement('p');
            buildingNameDisplay.innerHTML = `<strong>${buildingDef.name}</strong> (Durabilité: ${buildingInstance.durability}/${buildingInstance.maxDurability})`;
            if (buildingDef.maxHarvestsPerCycle) {
                buildingNameDisplay.innerHTML += ` (Récoltes: ${buildingInstance.harvestsAvailable || 0}/${buildingInstance.maxHarvestsPerCycle || 0})`;
            }
            buildingNameDisplay.style.marginBottom = '5px';
            buildingNameDisplay.style.borderTop = '1px solid #ccc';
            buildingNameDisplay.style.paddingTop = '5px';
            DOM.actionsEl.appendChild(buildingNameDisplay);

            if (buildingDef.sleepEffect && buildingInstance.durability > 0) {
                 createButton("😴 Dormir (8h)", 'sleep', { buildingKeyForDamage: buildingInstance.key, buildingIndex: index });
            }

            if (buildingInstance.durability > 0 && player.hunger >= 5 && player.thirst >= 5 && player.sleep >= 5) {
                createButton(`🔩 Démanteler ${buildingDef.name}`, 'dismantle_building', { buildingKey: buildingInstance.key, buildingIndex: index }, false, "Récupérer une partie des matériaux (-5 Faim/Soif/Sommeil)");
            } else if (buildingInstance.durability > 0) {
                 createButton(`🔩 Démanteler ${buildingDef.name}`, 'dismantle_building', { buildingKey: buildingInstance.key, buildingIndex: index }, true, "Trop fatigué pour démanteler (5 Faim/Soif/Sommeil requis)");
            }

            if ((buildingInstance.key === 'SHELTER_INDIVIDUAL' || buildingInstance.key === 'SHELTER_COLLECTIVE')) {
                if (buildingInstance.isLocked && tile.playerHasUnlockedThisSession) {
                    createButton("🔓 Retirer Cadenas", 'remove_lock', { buildingKey: buildingInstance.key, buildingIndex: index });
                } else if (!buildingInstance.isLocked && player.inventory['Cadenas'] > 0) {
                    createButton("🔒 Poser Cadenas", 'set_lock', { buildingKey: buildingInstance.key, buildingIndex: index });
                }
            }

            if (buildingDef.actions && buildingInstance.durability > 0) {
                buildingDef.actions.forEach(actionInfo => {
                    let disabledAction = false;
                    let titleAction = actionInfo.name;
                    let actionCostText = "";

                    if (actionInfo.costItem && actionInfo.costAmount) {
                        if (!player.inventory[actionInfo.costItem] || player.inventory[actionInfo.costItem] < actionInfo.costAmount) {
                            disabledAction = true;
                            actionCostText += ` (Nécessite ${actionInfo.costAmount} ${actionInfo.costItem})`;
                        }
                    }
                    if (actionInfo.costItems) {
                        for (const item in actionInfo.costItems) {
                            if(!player.inventory[item] || player.inventory[item] < actionInfo.costItems[item]) {
                                disabledAction = true;
                                actionCostText += ` (Nécessite ${actionInfo.costItems[item]} ${item})`;
                            }
                        }
                    }
                    if (buildingInstance.key === 'CAMPFIRE' && actionInfo.id !== 'sleep_by_campfire') {
                        const woodNeeded = actionInfo.costWood || 1;
                        if (!player.inventory['Bois'] || player.inventory['Bois'] < woodNeeded) {
                            disabledAction = true;
                            actionCostText += ` (Nécessite ${woodNeeded} Bois)`;
                        }
                    }

                    if (['harvest_bananeraie', 'harvest_sucrerie', 'harvest_cocoteraie', 'harvest_poulailler', 'harvest_enclos_cochons'].includes(actionInfo.id)) {
                        if (!buildingInstance.harvestsAvailable || buildingInstance.harvestsAvailable <= 0) {
                            disabledAction = true;
                            titleAction = "Rien à récolter (arrosez/abreuvez)";
                        } else if (isInventoryFull) {
                            disabledAction = true;
                            titleAction = "Inventaire plein";
                        }
                    }
                    if (actionInfo.id === 'sleep_by_campfire' && player.sleep >= player.maxSleep) {
                        disabledAction = true;
                        titleAction = "Sommeil au maximum";
                    }

                    titleAction += actionCostText;
                    createButton(actionInfo.name, 'use_building_action', { buildingKey: buildingInstance.key, specificActionId: actionInfo.id }, disabledAction, titleAction);
                });
            }

            if (buildingInstance.key === 'MINE' && buildingInstance.durability > 0 && hasPiocheEquipped) { // Utilisation de Interactions.findBuildingOnTile est implicite
                createButton("⛏️ Chercher Minerais (Bât.)", 'use_building_action', { buildingKey: 'MINE', specificActionId: 'search_ore_building' });
            }
            if ((buildingInstance.key === 'ATELIER' || buildingInstance.key === 'ETABLI' || buildingInstance.key === 'FORGE') && buildingInstance.durability > 0) {
                 createButton(`🛠️ Utiliser ${buildingDef.name}`, 'use_building_action', { buildingKey: buildingInstance.key, specificActionId: TILE_TYPES[buildingInstance.key].action.id});
            }

            const kitReparationEquipped = player.equipment.weapon && player.equipment.weapon.name === 'Kit de réparation';
            if (kitReparationEquipped && buildingInstance.durability < buildingInstance.maxDurability && player.equipment.weapon.currentUses > 0) {
                createButton(`🛠️ Réparer ${buildingDef.name}`, 'repair_building', { buildingKey: buildingInstance.key, buildingIndex: index }, false, `Utiliser Kit de réparation (${player.equipment.weapon.currentUses || ITEM_TYPES['Kit de réparation'].uses} uses)`);
            }


            if (buildingDef.inventory && buildingInstance.durability > 0) {
                const openChestButton = createButton( `🧰 Ouvrir le Coffre (${buildingDef.name})`, 'open_building_inventory', { buildingKey: buildingInstance.key, buildingIndex: index });
            }
        });
    }
    DOM.actionsEl.scrollTop = oldScrollTop;
}

function handleEvents() {
    if (!State.state || !State.state.activeEvent) return;
    const { activeEvent } = State.state;
    if (activeEvent.duration > 0) {
        activeEvent.duration--;
        if (activeEvent.duration === 0) {
            UI.addChatMessage(`L'événement "${activeEvent.type}" est terminé.`, "system");
            activeEvent.type = 'none';
            activeEvent.data = null;
        }
        return;
    }
    if (Math.random() > 0.85) {
        const eventType = Math.random() < 0.5 ? 'Tempête' : 'Abondance';
        if (eventType === 'Tempête') {
            activeEvent.type = 'Tempête';
            activeEvent.duration = 1;
            UI.addChatMessage("Une tempête approche ! Il sera plus difficile de survivre.", "system_event");
        } else {
            const abundantResourceList = ['Poisson cru', 'Pierre', 'Feuilles'];
            const abundantResource = abundantResourceList[Math.floor(Math.random() * abundantResourceList.length)];
            activeEvent.type = 'Abondance';
            activeEvent.duration = 2;
            activeEvent.data = { resource: abundantResource };
            // Message "les ... sont abondants" supprimé
        }
    }
}

function gameLoop(currentTime) {
    if (!State.state || !State.state.player) {
        requestAnimationFrame(gameLoop);
        return;
    }
    const { player, isGameOver, combatState, tutorialState } = State.state;
    const activeNonNormalStatuses = player.status.filter(s => s !== 'normale');
    if (activeNonNormalStatuses.length >= 4) {
        if(!isGameOver) endGame(false);
        return;
    }
    if (isGameOver) return;
    if (player.health <= 0) {
        if(!isGameOver) endGame(false);
        return;
    }
    if (lastFrameTimestamp === 0) lastFrameTimestamp = currentTime;
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (!tutorialState.active || tutorialState.completed) {
        if (!combatState) {
            if (currentTime - lastStatDecayTimestamp > CONFIG.STAT_DECAY_INTERVAL_MS) {
                const decayResult = decayStats(State.state);
                if(decayResult && decayResult.message) UI.addChatMessage(decayResult.message, 'system');
                lastStatDecayTimestamp = currentTime;
            }
            if (!player.animationState && !player.isBusy) {
                updateNpcs(State.state, deltaTime);
            }
        }
    }


    if (player.animationState) {
        const anim = player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50);
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;

        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                State.applyPlayerMove(anim.direction);
                UI.renderScene(State.state);
                if (tutorialState.active && tutorialState.step === 0 && tutorialState.isTemporarilyHidden) {
                    UI.playerMovedForTutorial();
                }
                anim.type = 'in';
                anim.progress = 0;
            } else {
                player.animationState = null;
                player.isBusy = false;
                fullUIUpdate();
            }
        }
    }

    UI.renderScene(State.state);
    requestAnimationFrame(gameLoop);
}

function handleNavigation(direction) {
    if (!State.state || !State.state.player) return;
    const { player, map, enemies, combatState, tutorialState } = State.state;

    if (tutorialState.active && tutorialState.step > 0 && !tutorialState.isTemporarilyHidden) {
        UI.addChatMessage("Veuillez suivre les instructions du tutoriel.", "system");
        return;
    }
    if (tutorialState.active && tutorialState.step === 0 && !tutorialState.isTemporarilyHidden) {
        UI.addChatMessage("Cliquez d'abord sur 'Compris, je vais bouger !' dans le message du tutoriel.", "system");
        return;
    }


    if (player.isBusy || player.animationState || combatState) {
        return;
    }

    const currentEnemyOnTile = findEnemyOnTile(player.x, player.y, enemies);
    if (currentEnemyOnTile) {
        UI.addChatMessage("Vous ne pouvez pas fuir, vous devez combattre !", "system");
        State.startCombat(player, currentEnemyOnTile);
        UI.showCombatModal(State.state.combatState);
        updatePossibleActions();
        return;
    }

    let newX = player.x, newY = player.y;
    if (direction === 'north') { newY--; }
    else if (direction === 'south') { newY++; }
    else if (direction === 'west') { newX--; }
    else if (direction === 'east') { newX++; }
    else if (direction === 'northeast') { newY--; newX++; }
    else if (direction === 'northwest') { newY--; newX--; }
    else if (direction === 'southeast') { newY++; newX++; }
    else if (direction === 'southwest') { newY++; newX--; }

    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
        if (DOM[`nav${direction.toUpperCase()}`] || DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`]) {
            const navButton = DOM[`nav${direction.toUpperCase()}`] || DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`];
            if (navButton) UI.triggerShake(navButton);
        }
        return;
    }

    if (!Interactions.applyRandomStatCost(player, 1, "déplacement")) {
    }

    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };

    updatePossibleActions();
}

function handleSpecificConsume(statType) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;

    if (player.isBusy || player.animationState) {
        UI.addChatMessage("Vous êtes occupé.", "system");
        return;
    }

    let itemToConsume = null;
    const inventory = player.inventory;
    switch (statType) {
        case 'health':
            if (inventory['Kit de Secours'] > 0 && player.status.includes('Malade')) itemToConsume = 'Kit de Secours';
            else if (inventory['Médicaments'] > 0 && (player.status.includes('Malade') || player.status.includes('Drogué'))) itemToConsume = 'Médicaments';
            else if (inventory['Antiseptique'] > 0 && (player.status.includes('Blessé') || player.status.includes('Malade')) && player.health < player.maxHealth) itemToConsume = 'Antiseptique';
            else if (inventory['Bandage'] > 0 && player.health < player.maxHealth) itemToConsume = 'Bandage';
            else if (inventory['Savon'] > 0 && player.health < player.maxHealth) itemToConsume = 'Savon';
            else if (inventory['Huile de coco'] > 0 && player.health < player.maxHealth) itemToConsume = 'Huile de coco';
            break;
        case 'thirst':
            if (inventory['Eau pure'] > 0 && player.thirst < player.maxThirst) itemToConsume = 'Eau pure';
            else if (inventory['Noix de coco'] > 0 && player.thirst < player.maxThirst) itemToConsume = 'Noix de coco';
            else if (inventory['Alcool'] > 0 && player.thirst < player.maxThirst -1 ) itemToConsume = 'Alcool';
            break;
        case 'hunger':
            const foodItems = ['Viande cuite', 'Poisson cuit', 'Oeuf cuit', 'Barre Énergétique', 'Banane', 'Sucre', 'Sel'];
            for (const food of foodItems) {
                if (inventory[food] > 0 && player.hunger < player.maxHunger) {
                    itemToConsume = food;
                    break;
                }
            }
            break;
        default: UI.addChatMessage("Type de consommation inconnu via bouton rapide.", "system"); return;
    }

    if (!itemToConsume) {
        let message = "Vous n'avez rien pour ";
        let targetButton = null;
        if (statType === 'health' && DOM.consumeHealthBtn) { message += "vous soigner (ou vous n'êtes pas dans l'état requis / santé max)."; targetButton = DOM.consumeHealthBtn; }
        else if (statType === 'thirst' && DOM.consumeThirstBtn) { message += "étancher votre soif (ou soif max)."; targetButton = DOM.consumeThirstBtn; }
        else if (statType === 'hunger' && DOM.consumeHungerBtn) { message += "calmer votre faim (ou faim max)."; targetButton = DOM.consumeHungerBtn; }
        UI.addChatMessage(message, "system");
        if (targetButton) UI.triggerShake(targetButton);
        return;
    }
    const result = State.consumeItem(itemToConsume);
    UI.addChatMessage(result.message, result.success ? (itemToConsume === 'Porte bonheur' ? 'system_event' : 'system') : 'system_error');
    if (result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(textObjOrString => {
                const text = typeof textObjOrString === 'string' ? textObjOrString : textObjOrString.text;
                const type = typeof textObjOrString === 'string' ? (text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info')) : textObjOrString.type;

                if (text.toLowerCase().includes('statut:')) UI.showFloatingText(text, type);
                else if (itemToConsume === 'Porte bonheur' && text.includes('+1')) UI.showFloatingText(text, type);
                else if (!text.toLowerCase().includes('statut:') && itemToConsume !== 'Porte bonheur') {
                    UI.showFloatingText(text, type);
                }
            });
        }
        fullUIUpdate();
    } else { if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); }
}


function handleConsumeClick(itemName) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }

    const itemDef = ITEM_TYPES[itemName];
    const isInstance = typeof player.inventory[itemName] === 'object';
    
    // Si c'est une instance (objet avec durabilité), on ne peut pas le "consommer" comme ça
    if (isInstance) {
        if (itemDef && itemDef.slot) { // Tentative d'équipement
            const equipResult = State.equipItem(itemName);
            UI.addChatMessage(equipResult.message, equipResult.success ? 'system' : 'system_error');
            if (equipResult.success) fullUIUpdate();
        } else {
             UI.addChatMessage(`"${itemName}" ne peut pas être utilisé directement comme ça.`, "system");
        }
        return;
    }

    if (itemDef && itemDef.effects) {
        if ((itemName === 'Eau pure' || itemName === 'Eau salée' || itemName === 'Eau croupie' || itemName === 'Noix de coco') && player.thirst >= player.maxThirst) {
            const msg = itemName === 'Noix de coco' || itemName === 'Eau pure' ? "Vous n'avez pas soif." : "Vous n'avez pas soif, vous devriez économiser cette eau précieuse.";
            UI.addChatMessage(msg, "system"); return;
        }
        const onlyHungerEffect = Object.keys(itemDef.effects).length === 1 && itemDef.effects.hunger && itemDef.effects.hunger > 0;
        if (onlyHungerEffect && player.hunger >= player.maxHunger) {
            UI.addChatMessage("Vous n'avez pas faim.", "system"); return;
        }
        if ((itemName === 'Savon' || itemName === 'Bandage' || itemName === 'Huile de coco') && player.health >= player.maxHealth) {
            UI.addChatMessage("Votre santé est au maximum.", "system"); return;
        }
        if (itemName === 'Alcool' && player.thirst >= player.maxThirst -1) {
            UI.addChatMessage("Vous n'avez pas assez soif pour boire de l'alcool.", "system"); return;
        }
        if (itemName === 'Banane' && player.hunger > player.maxHunger - 2) { UI.addChatMessage("Vous n'avez pas assez faim pour une banane.", "system"); return; }
        if (itemName === 'Canne à sucre' && player.hunger > player.maxHunger - 3) { UI.addChatMessage("Vous n'avez pas assez faim pour de la canne à sucre.", "system"); return; }
        if (itemName === 'Oeuf cru' && player.hunger > player.maxHunger - 2) { UI.addChatMessage("Vous n'avez pas assez faim pour un oeuf cru.", "system"); return; }
        if (itemName === 'Poisson cru' && player.hunger > player.maxHunger - 3) { UI.addChatMessage("Vous n'avez pas assez faim pour du poisson cru.", "system"); return; }
        if (itemName === 'Sel') {
            const selDef = ITEM_TYPES['Sel'];
            if (player.hunger > player.maxHunger - (selDef.effects.hunger || 0) ) {
                UI.addChatMessage("Vous n'avez pas assez faim pour manger du sel.", "system"); return;
            }
        }

        if (itemName === 'Antiseptique' && player.health >= player.maxHealth) {
            UI.addChatMessage("Votre santé est au maximum, l'antiseptique ne sera pas utilisé.", "system"); return;
        }
    }

    if (itemName === 'Eau salée') {
         handleGlobalPlayerAction('consume_eau_salee', {itemName: 'Eau salée'});
         return;
    }
    if (itemDef && itemDef.slot && ['weapon', 'shield', 'body', 'head', 'feet', 'bag'].includes(itemDef.slot)) {
        const equipResult = State.equipItem(itemName);
        UI.addChatMessage(equipResult.message, equipResult.success ? 'system' : 'system_error');
        if (equipResult.success) fullUIUpdate();
        return;
    }
    if (itemName === 'Batterie chargée' && player.equipment.weapon && (player.equipment.weapon.name === 'Radio déchargée' || player.equipment.weapon.name === 'Téléphone déchargé' || player.equipment.weapon.name === 'Guitare déchargé')) {
        const result = State.consumeItem(itemName);
        UI.addChatMessage(result.message, result.success ? 'system_event' : 'system_error');
        if (result.success) fullUIUpdate();
        return;
    }
    if (itemDef && itemDef.type === 'usable' && itemDef.action) {
        handleGlobalPlayerAction(itemDef.action, { itemName: itemName });
        return;
    }

    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'key' && itemDef.type !== 'usable') ) {
        if (itemDef && !itemDef.teachesRecipe) {
            UI.addChatMessage(`"${itemName}" n'est pas consommable directement depuis l'inventaire de cette manière.`, "system");
        }
        return;
    }

    const result = State.consumeItem(itemName);
    UI.addChatMessage(result.message, result.success ? (itemName.startsWith('Parchemin') || itemName === 'Porte bonheur' || itemName === 'Batterie chargée' ? 'system_event' : 'system') : 'system_error');
    if(result.success) {
        if (itemName !== 'Breuvage étrange' || (result.floatingTexts && result.floatingTexts.some(ft => (typeof ft === 'string' ? ft : ft.text).includes('+')))) {
             UI.triggerActionFlash('gain');
        }
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(textObjOrString => {
                const text = typeof textObjOrString === 'string' ? textObjOrString : textObjOrString.text;
                const type = typeof textObjOrString === 'string' ? (text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info')) : textObjOrString.type;
                UI.showFloatingText(text, type);
            });
        }
        fullUIUpdate();
    } else { if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); }
}

window.fullUIUpdate = function() {
    if (!State.state || !State.state.player) {
        console.warn("fullUIUpdate: State or player not ready.");
        return;
    }
    UI.updateAllUI(State.state);
    updatePossibleActions();

    if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.updateEquipmentModal(State.state);
    if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.showInventoryModal(State.state);
    if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) {
        if (State.state && State.state.config) {
            UI.drawLargeMap(State.state, State.state.config);
            UI.populateLargeMapLegend();
        }
    }
    if (DOM.buildModal && !DOM.buildModal.classList.contains('hidden')) {
        UI.populateBuildModal(State.state);
    }
    if (DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden')) {
        UI.populateWorkshopModal(State.state);
    }
    if (DOM.bottomBarEl) {
        UI.updateGroundItemsPanel(State.state.map[State.state.player.y][State.state.player.x]);
    }

    const navDirections = {
        'north': DOM.navNorth, 'south': DOM.navSouth, 'east': DOM.navEast, 'west': DOM.navWest,
        'northeast': DOM.navNE, 'northwest': DOM.navNW, 'southeast': DOM.navSE, 'southwest': DOM.navSW
    };

    const tutorialIsActiveAndNeedsActionBlocking = State.state.tutorialState.active &&
                                                 !State.state.tutorialState.isTemporarilyHidden &&
                                                 State.state.tutorialState.step > 0;
    const playerIsActuallyBusy = State.state.player.isBusy || !!State.state.player.animationState;

    for (const dir in navDirections) {
        const btn = navDirections[dir];
        if (btn) {
            const shouldBeVisible = Interactions.canMoveInDirection(State.state.player, dir, State.state.map, CONFIG);
            btn.style.display = shouldBeVisible ? 'flex' : 'none';
            btn.disabled = tutorialIsActiveAndNeedsActionBlocking || playerIsActuallyBusy;
        }
    }
};
window.State = State;

window.updatePossibleActions = updatePossibleActions;
window.UI = UI;

window.handleGlobalPlayerAction = (actionId, data) => {
    const { tutorialState } = State.state;

    if (actionId === 'tutorial_hide_and_move') {
        if (tutorialState.active && tutorialState.step === 0) {
            tutorialState.isTemporarilyHidden = true;
            if (DOM.tutorialOverlay) DOM.tutorialOverlay.classList.add('hidden');
            if (UI.highlightElement) UI.highlightElement(null, true);
            if (window.fullUIUpdate) window.fullUIUpdate();
        }
        return;
    }
    if (actionId === 'tutorial_next') {
        if (tutorialState.active) {
            UI.advanceTutorial();
        }
        return;
    }
    if (actionId === 'tutorial_skip') {
        if (tutorialState.active) {
            UI.skipTutorial();
        }
        return;
    }

    if (tutorialState.active &&
        !tutorialState.isTemporarilyHidden &&
        tutorialState.step > 0) {
        UI.addChatMessage("Veuillez terminer ou passer le tutoriel pour effectuer d'autres actions.", "system");
        return;
    }

    Interactions.handlePlayerAction(actionId, data, {
        updateAllUI: window.fullUIUpdate,
        updatePossibleActions: window.updatePossibleActions,
        updateAllButtonsState: () => window.UI.updateAllButtonsState(State.state)
    });
};


function dailyUpdate() {
    if (!State.state || State.state.isGameOver || (State.state.tutorialState.active && !State.state.tutorialState.completed && !State.state.tutorialState.isTemporarilyHidden)) return;

    if (State.state.day >= CONFIG.VICTORY_DAY) { endGame(true); return; }
    State.state.day++;
    handleEvents();
    if (State.state.day % CONFIG.ENEMY_SPAWN_CHECK_DAYS === 0) {
        if (State.state.enemies.length < CONFIG.MAX_ENEMIES) {
            const newEnemy = spawnSingleEnemy(State.state.map);
            if (newEnemy) {
                State.addEnemy(newEnemy);
                UI.addChatMessage("Vous sentez une présence hostile non loin...", "system");
            }
        }
    }
    State.state.map.flat().forEach(tile => {
        if (tile.type.name === TILE_TYPES.PLAGE.name && tile.type.actionsAvailable) {
            tile.actionsLeft = {...TILE_TYPES.PLAGE.actionsAvailable};
        }
        if (tile.type.name === TILE_TYPES.FOREST.name) {
            tile.woodActionsLeft = TILE_TYPES.FOREST.woodActionsLeft;
            tile.huntActionsLeft = TILE_TYPES.FOREST.huntActionsLeft;
            tile.searchActionsLeft = TILE_TYPES.FOREST.searchActionsLeft;
        }
        if (tile.type.name === TILE_TYPES.PLAINS.name) {
            tile.huntActionsLeft = TILE_TYPES.PLAINS.huntActionsLeft;
            tile.searchActionsLeft = TILE_TYPES.PLAINS.searchActionsLeft;
        }
        if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name && tile.type.harvests) {
             tile.harvestsLeft = tile.type.harvests;
        }
        tile.buildings.forEach(buildingInstance => {
            const buildingDef = TILE_TYPES[buildingInstance.key];
            if (buildingDef && buildingDef.maxHarvestsPerCycle && buildingInstance.harvestsAvailable < buildingDef.maxHarvestsPerCycle) {
            }
        });
    });
    window.fullUIUpdate();
}

function handleDragStart(e) {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) { e.preventDefault(); return; }
    const itemEl = e.target instanceof Element ? e.target.closest('.inventory-item[draggable="true"]') : null;
    if (!itemEl) return;
    const ownerEl = itemEl.closest('[data-owner], .equipment-slot[data-owner], .equipment-slot-small[data-owner]');
    if (!ownerEl) { console.warn("Drag Start: Owner element not found for", itemEl); return; }

    draggedItemInfo = {
        element: itemEl,
        itemName: itemEl.dataset.itemName,
        itemCount: parseInt(itemEl.dataset.itemCount || '1', 10),
        sourceOwner: ownerEl.dataset.owner,
        sourceSlotType: itemEl.dataset.slotType || ownerEl.dataset.slotType
    };
    setTimeout(() => itemEl.classList.add('dragging'), 0);
}
function handleDragOver(e) {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) { return; }
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (dropZone) dropZone.classList.add('drag-over');
}
function handleDragLeave(e) {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) { return; }
    const dropZone = e.target.closest('.droppable');
    if (dropZone) dropZone.classList.remove('drag-over');
}
function handleDragEnd() {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) { return; }
    if (draggedItemInfo && draggedItemInfo.element) draggedItemInfo.element.classList.remove('dragging');
    document.querySelectorAll('.droppable.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDrop(e) {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) { e.preventDefault(); return; }
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    
    if (!draggedItemInfo) {
        if (dropZone) dropZone.classList.remove('drag-over');
        return;
    }
    if (!dropZone) {
        if (draggedItemInfo.element) draggedItemInfo.element.classList.remove('dragging');
        draggedItemInfo = null;
        return;
    }

    const destOwner = dropZone.dataset.owner;
    const destSlotType = dropZone.dataset.slotType;

    const itemName = draggedItemInfo.itemName;
    const itemCount = draggedItemInfo.itemCount;
    const sourceOwner = draggedItemInfo.sourceOwner;
    const sourceSlotType = draggedItemInfo.sourceSlotType;
    
    let transferActionInitiated = false;

    if (destOwner === 'equipment') {
        const itemDef = ITEM_TYPES[itemName];
        if (sourceOwner === 'player-inventory') {
            if (itemDef && itemDef.slot === destSlotType) {
                State.equipItem(itemName);
            } else { UI.addChatMessage("Cet objet ne va pas dans cet emplacement.", "system"); }
        }
    } else if (destOwner === 'player-inventory') {
        if (sourceOwner === 'equipment' && sourceSlotType) {
            State.unequipItem(sourceSlotType);
        } else if (sourceOwner === 'ground') {
            if (itemCount > 1) {
                transferActionInitiated = true;
                UI.showQuantityModal(`Ramasser ${itemName}`, itemCount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                    }
                    window.fullUIUpdate();
                    draggedItemInfo = null; 
                });
            } else {
                const result = State.pickUpItemFromGround(itemName, 1);
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            }
        }
    } else if (dropZone.closest('#inventory-modal')) {
        let transferType = '';
        if (sourceOwner === 'player-inventory' && destOwner === 'shared') transferType = 'deposit';
        else if (sourceOwner === 'shared' && destOwner === 'player-inventory') transferType = 'withdraw';

        if (transferType) {
            const currentTransferType = transferType; 
            if (itemCount > 1) {
                transferActionInitiated = true;
                UI.showQuantityModal(itemName, itemCount, amount => {
                    if (amount > 0) {
                        const transferResult = State.applyBulkInventoryTransfer(itemName, amount, currentTransferType);
                        UI.addChatMessage(transferResult.message, transferResult.success ? 'system' : 'system_error');
                    }
                    window.fullUIUpdate();
                    draggedItemInfo = null; 
                });
            } else {
                const transferResult = State.applyBulkInventoryTransfer(itemName, 1, currentTransferType);
                UI.addChatMessage(transferResult.message, transferResult.success ? 'system' : 'system_error');
            }
        }
    } else if (destOwner === 'ground' && sourceOwner === 'player-inventory') {
        if (itemCount > 1) {
            transferActionInitiated = true;
            UI.showQuantityModal(`Déposer ${itemName}`, itemCount, (amount) => {
                if (amount > 0) {
                    const result = State.dropItemOnGround(itemName, amount);
                    UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                }
                window.fullUIUpdate();
                draggedItemInfo = null; 
            });
        } else {
            const result = State.dropItemOnGround(itemName, 1);
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
        }
    }

    if (!transferActionInitiated) {
        draggedItemInfo = null;
    }
    
    window.fullUIUpdate();
    if (dropZone) dropZone.classList.remove('drag-over');
}


function setupDragAndDropForContainer(containerElement) {
    if (!containerElement) return;
    containerElement.addEventListener('dragstart', handleDragStart);
    containerElement.addEventListener('dragover', handleDragOver);
    containerElement.addEventListener('dragleave', handleDragLeave);
    containerElement.addEventListener('dragend', handleDragEnd);
    containerElement.addEventListener('drop', handleDrop);
}

function handleEquipmentSlotClick(slotType) {
    if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return;
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }
    if (player.equipment[slotType]) {
        const unequipResult = State.unequipItem(slotType);
        UI.addChatMessage(unequipResult.message, unequipResult.success ? 'system' : 'system_error');
        if (unequipResult.success) window.fullUIUpdate();
    }
}

function setupEventListeners() {
    if (!DOM.navNorth) { console.error("DOM non initialisé avant setupEventListeners"); return; }

    DOM.navNorth.addEventListener('click', () => handleNavigation('north'));
    DOM.navSouth.addEventListener('click', () => handleNavigation('south'));
    DOM.navEast.addEventListener('click', () => handleNavigation('east'));
    DOM.navWest.addEventListener('click', () => handleNavigation('west'));
    DOM.navNE.addEventListener('click', () => handleNavigation('northeast'));
    DOM.navNW.addEventListener('click', () => handleNavigation('northwest'));
    DOM.navSE.addEventListener('click', () => handleNavigation('southeast'));
    DOM.navSW.addEventListener('click', () => handleNavigation('southwest'));


    if (DOM.consumeHealthBtn) DOM.consumeHealthBtn.addEventListener('click', () => { if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return; handleSpecificConsume('health'); });
    if (DOM.consumeThirstBtn) DOM.consumeThirstBtn.addEventListener('click', () => { if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return; handleSpecificConsume('thirst'); });
    if (DOM.consumeHungerBtn) DOM.consumeHungerBtn.addEventListener('click', () => { if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return; handleSpecificConsume('hunger'); });

    if (DOM.closeEquipmentModalBtn) DOM.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);
    if (DOM.closeBuildModalBtn) DOM.closeBuildModalBtn.addEventListener('click', UI.hideBuildModal);
    if (DOM.closeWorkshopModalBtn) DOM.closeWorkshopModalBtn.addEventListener('click', UI.hideWorkshopModal);

    if (DOM.enlargeMapBtn) DOM.enlargeMapBtn.addEventListener('click', () => {if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return; handleGlobalPlayerAction('open_large_map', {})});
    if (DOM.closeLargeMapBtn) DOM.closeLargeMapBtn.addEventListener('click', UI.hideLargeMap);

    if (DOM.toggleChatSizeBtn && DOM.bottomBarChatPanelEl) {
        DOM.toggleChatSizeBtn.addEventListener('click', () => {
            DOM.bottomBarChatPanelEl.classList.toggle('chat-enlarged');
            if (DOM.bottomBarEl) DOM.bottomBarEl.classList.toggle('chat-enlarged');
            if (DOM.toggleChatSizeBtn) DOM.toggleChatSizeBtn.textContent = DOM.bottomBarChatPanelEl.classList.contains('chat-enlarged') ? '⌄' : '⌃';
            if (DOM.chatMessagesEl) DOM.chatMessagesEl.scrollTop = DOM.chatMessagesEl.scrollHeight;
        });
    }

    if (DOM.closeInventoryModalBtn) DOM.closeInventoryModalBtn.addEventListener('click', UI.hideInventoryModal);

    if (DOM.inventoryCategoriesEl) {
        DOM.inventoryCategoriesEl.addEventListener('click', e => {
            if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return;
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                const itemName = itemEl.dataset.itemName;
                const itemDef = ITEM_TYPES[itemName];
                if (itemDef && itemDef.slot && ['bag', 'shield', 'body', 'feet', 'head', 'weapon'].includes(itemDef.slot)) {
                    const equipResult = State.equipItem(itemName);
                    UI.addChatMessage(equipResult.message, equipResult.success ? 'system' : 'system_error');
                    if (equipResult.success) window.fullUIUpdate();
                } else {
                    handleConsumeClick(itemName);
                }
            } else {
                const header = e.target.closest('.category-header');
                if (header) { header.classList.toggle('open');
                    if (header.nextElementSibling) header.nextElementSibling.classList.toggle('visible');
                }
            }
        });
        setupDragAndDropForContainer(DOM.inventoryCategoriesEl);
    }

    if (DOM.bottomBarGroundItemsEl) {
        DOM.bottomBarGroundItemsEl.addEventListener('click', e => {
            if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return;
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                const itemName = itemEl.dataset.itemName;
                const maxAmount = parseInt(itemEl.dataset.itemCount, 10);
                UI.showQuantityModal(`Ramasser ${itemName}`, maxAmount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                        window.fullUIUpdate();
                    }
                });
            }
        });
         setupDragAndDropForContainer(DOM.bottomBarGroundItemsEl);
    }

    if (DOM.equipmentModal) setupDragAndDropForContainer(DOM.equipmentModal);
    if (DOM.inventoryModal) setupDragAndDropForContainer(DOM.inventoryModal);
    if (DOM.buildModal) setupDragAndDropForContainer(DOM.buildModal);
    if (DOM.workshopModal) setupDragAndDropForContainer(DOM.workshopModal);

    if (DOM.bottomBarEquipmentSlotsEl) {
        setupDragAndDropForContainer(DOM.bottomBarEquipmentSlotsEl);
        DOM.bottomBarEquipmentSlotsEl.addEventListener('click', e => {
            if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return;
            const slotEl = e.target.closest('.equipment-slot-small.droppable, .equipment-slot-container-small');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item');
                if (itemContent && itemContent.closest('.equipment-slot-small')) {
                     handleEquipmentSlotClick(slotEl.dataset.slotType);
                }
            }
        });
    }
    if (DOM.equipmentSlotsEl) {
        DOM.equipmentSlotsEl.addEventListener('click', e => {
            if (State.state.tutorialState.active && !State.state.tutorialState.isTemporarilyHidden && State.state.tutorialState.step > 0) return;
            const slotEl = e.target.closest('.equipment-slot.droppable');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item');
                if (itemContent) handleEquipmentSlotClick(slotEl.dataset.slotType);
            }
        });
    }

    if (DOM.tutorialNextButton) {
        DOM.tutorialNextButton.addEventListener('click', () => {
            const action = DOM.tutorialNextButton.dataset.action || 'tutorial_next';
            handleGlobalPlayerAction(action, {});
        });
    }
    if (DOM.tutorialSkipButton) {
        DOM.tutorialSkipButton.addEventListener('click', () => {
            handleGlobalPlayerAction('tutorial_skip', {});
        });
    }


    window.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            if (DOM.tutorialOverlay && !DOM.tutorialOverlay.classList.contains('hidden') && !State.state.tutorialState.isTemporarilyHidden) { /* Ne rien faire si tutoriel actif et visible */ }
            else if (DOM.lockModal && !DOM.lockModal.classList.contains('hidden')) UI.hideLockModal();
            else if (DOM.workshopModal && !DOM.workshopModal.classList.contains('hidden')) UI.hideWorkshopModal();
            else if (DOM.buildModal && !DOM.buildModal.classList.contains('hidden')) UI.hideBuildModal();
            else if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.hideEquipmentModal();
            else if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            else if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) UI.hideLargeMap();
            else if (DOM.combatModal && !DOM.combatModal.classList.contains('hidden')) UI.hideCombatModal();
            else if (UI.isQuantityModalOpen()) UI.hideQuantityModal();
            else if (DOM.adminModal && !DOM.adminModal.classList.contains('hidden')) document.getElementById('admin-modal').classList.add('hidden');
            return;
        }

        if (e.key === 'Enter') {
            if (DOM.tutorialOverlay && !DOM.tutorialOverlay.classList.contains('hidden') && DOM.tutorialNextButton.style.display !== 'none' && !State.state.tutorialState.isTemporarilyHidden) { DOM.tutorialNextButton.click(); }
            else if (document.activeElement === DOM.chatInputEl) {
                if (DOM.chatInputEl.value.trim() !== '') {
                    UI.addChatMessage(DOM.chatInputEl.value.trim(), 'player', State.state.player.name || "Aventurier");
                    DOM.chatInputEl.value = '';
                }
                DOM.chatInputEl.blur();
            } else if (DOM.lockModal && !DOM.lockModal.classList.contains('hidden')) {
                DOM.lockUnlockButton.click();
            } else {
                if (!State.state.tutorialState.active || State.state.tutorialState.completed || State.state.tutorialState.isTemporarilyHidden) DOM.chatInputEl.focus();
            }
            e.preventDefault();
            return;
        }

        if (document.activeElement === DOM.chatInputEl ||
            UI.isQuantityModalOpen() ||
            (DOM.adminModal && !DOM.adminModal.classList.contains('hidden')) ||
            (DOM.workshopSearchInputEl && document.activeElement === DOM.workshopSearchInputEl) ||
            (DOM.workshopRecipesContainerEl && DOM.workshopRecipesContainerEl.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') ||
            (DOM.lockModal && !DOM.lockModal.classList.contains('hidden')) ||
            (DOM.tutorialOverlay && !DOM.tutorialOverlay.classList.contains('hidden') && !State.state.tutorialState.isTemporarilyHidden)
           ) {
            return;
        }

        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'z') handleNavigation('north');
        else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') handleNavigation('south');
        else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'q') handleNavigation('west');
        else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleNavigation('east');
        else if (e.key.toLowerCase() === 'e') UI.showEquipmentModal(State.state);
        else if (e.key.toLowerCase() === 'm') handleGlobalPlayerAction('open_large_map', {});
        else if (e.key.toLowerCase() === 'c') UI.showBuildModal(State.state);
        else if (e.key.toLowerCase() === 't') {
            const tile = State.state.map[State.state.player.y][State.state.player.x];
            const workshopBuilding = tile.buildings.find(b => (b.key === 'ATELIER' || b.key === 'ETABLI' || b.key === 'FORGE') && b.durability > 0);
            if (workshopBuilding) {
                if (DOM.workshopModal && DOM.workshopModal.classList.contains('hidden')) {
                     UI.showWorkshopModal(State.state);
                } else if (DOM.workshopModal) {
                    UI.hideWorkshopModal();
                }
            }
        }
        else if (e.key.toLowerCase() === 'i') {
            if (DOM.inventoryModal && DOM.inventoryModal.classList.contains('hidden')) {
                const tile = State.state.map[State.state.player.y][State.state.player.x];
                let buildingWithInv = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory);
                 if (!buildingWithInv) buildingWithInv = tile.buildings.find(b => (b.key === 'SHELTER_INDIVIDUAL' || b.key === 'SHELTER_COLLECTIVE'));

                const tileHasInv = tile.type.inventory || tile.type.maxInventory;
                if(buildingWithInv || tileHasInv) {
                    handleGlobalPlayerAction('open_building_inventory', { buildingKey: buildingWithInv?.key, buildingIndex: tile.buildings.indexOf(buildingWithInv) });
                }
            } else if (DOM.inventoryModal) {
                UI.hideInventoryModal();
            }
        }
    });
    window.gameState = State.state;
    UI.setupQuantityModalListeners();
    UI.setupWorkshopModalListeners(State.state);
    UI.setupLockModalListeners();
}

function endGame(isVictory) {
    if (!State.state || State.state.isGameOver) return;
    State.state.isGameOver = true;
    if(State.state.gameIntervals) State.state.gameIntervals.forEach(clearInterval);
    if(State.state.combatState) UI.hideCombatModal();
    const finalMessage = isVictory ? `Félicitations ! Vous avez survécu ${CONFIG.VICTORY_DAY} jours !` : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');

    const endModal = document.createElement('div');
    endModal.id = 'end-game-modal';
    endModal.style.cssText = `position: fixed; inset: 0; background-color: rgba(0,0,0,0.8); z-index: 10000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-size: 2em; text-align: center; padding: 20px; backdrop-filter: blur(5px);`;
    const messageEl = document.createElement('p');
    messageEl.textContent = finalMessage;
    const reloadButton = document.createElement('button');
    reloadButton.textContent = "Recommencer";
    reloadButton.style.cssText = `padding: 15px 30px; font-size: 0.8em; margin-top: 30px; background-color: var(--action-color); color: var(--text-light); border: none; border-radius: 8px; cursor: pointer;`;
    reloadButton.onclick = () => { window.location.reload(); };

    endModal.appendChild(messageEl);
    endModal.appendChild(reloadButton);
    document.body.appendChild(endModal);

    document.querySelectorAll('button').forEach(b => { if (b !== reloadButton) b.disabled = true; });
    if (DOM.chatInputEl) DOM.chatInputEl.disabled = true;
    if (DOM.tutorialOverlay && !DOM.tutorialOverlay.classList.contains('hidden')) { UI.completeTutorial(); }
}

function fullResizeAndRedraw() {
    UI.resizeGameView();
    if (State.state && State.state.player) {
        UI.renderScene(State.state);
    }
}

async function init() {
    try {
        initDOM();

        await UI.loadAssets(SPRITESHEET_PATHS);

        State.initializeGameState(CONFIG);

        window.addEventListener('resize', fullResizeAndRedraw);
        setupEventListeners();

        initAdminControls();

        UI.initTutorial();

        requestAnimationFrame(() => {
            fullResizeAndRedraw();
            UI.updateBottomBarEquipmentPanel(State.state.player);
        });

        if (!State.state.tutorialState.active || State.state.tutorialState.completed) {
            UI.addChatMessage("Bienvenue aventurier, trouve vite d'autres aventuriers pour s'organiser ensemble!", "system_event", "Ancien");
        }

        if (State.state && (!State.state.config || Object.keys(State.state.config).length === 0)) {
            State.state.config = { ...CONFIG };
        } else if (State.state && !State.state.config.VICTORY_DAY) {
             State.state.config.VICTORY_DAY = CONFIG.VICTORY_DAY || 200;
        }

        requestAnimationFrame(gameLoop);

        if (State.state) {
            State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
            State.state.gameIntervals.push(setInterval(() => {
                if (State.state.npcs && State.state.npcs.length > 0 && !State.state.combatState && (!State.state.player.isBusy && !State.state.player.animationState) && (!State.state.tutorialState.active || State.state.tutorialState.completed || State.state.tutorialState.isTemporarilyHidden) ) {
                    npcChatter(State.state.npcs);
                }
            }, CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        }

    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        if (document.body) {
            document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}<br>Vérifiez la console pour plus de détails. Pile d'appel : <pre>${error.stack}</pre></div>`;
        }
    }
}

window.addEventListener('load', init);