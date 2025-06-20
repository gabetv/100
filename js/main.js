// js/main.js
import * as UI from './ui.js';
import { initDOM } from './ui/dom.js';
import DOM from './ui/dom.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES, ITEM_TYPES, SEARCH_ZONE_CONFIG } from './config.js';
import * as State from './state.js'; // Importation namespace
import { decayStats, getTotalResources } from './player.js';
import { updateNpcs, npcChatter } from './npc.js';
import { updateEnemies, findEnemyOnTile, spawnSingleEnemy } from './enemy.js';
import * as Interactions from './interactions.js';

let lastFrameTimestamp = 0;
let lastStatDecayTimestamp = 0;
let draggedItemInfo = null;

function updatePossibleActions() {
    if (!DOM.actionsEl) return;
    const oldScrollTop = DOM.actionsEl.scrollTop; // Sauvegarder la position du scroll
    DOM.actionsEl.innerHTML = '';

    let buildSubmenu = DOM.actionsEl.querySelector('#build-submenu-container');
    if (buildSubmenu) {
        buildSubmenu.innerHTML = '';
    }


    if (!State.state || !State.state.player) return;
    const { player, map, combatState, enemies, knownRecipes } = State.state;

    if (!map || !map[player.y] || !map[player.y][player.x]) {
        return;
    }
    const tile = map[player.y][player.x];
    const tileType = tile.type;
    const enemyOnTile = findEnemyOnTile(player.x, player.y, enemies);

    const createButton = (text, actionId, data = {}, disabled = false, title = '', parent = DOM.actionsEl) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = (e) => {
            if (parent.id === 'build-submenu-content' || parent.classList.contains('npc-quest-btn-container')) { // Empêcher la propagation si c'est un bouton de sous-menu ou de quête PNJ
                e.stopPropagation();
            }
            Interactions.handlePlayerAction(actionId, data, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        };
        parent.appendChild(button);
        return button;
    };

    const actionsHeader = document.createElement('h4');
    actionsHeader.textContent = "Actions sur la Tuile";
    actionsHeader.style.marginTop = '0px';
    DOM.actionsEl.appendChild(actionsHeader);

    if (combatState || player.isBusy || player.animationState) {
        const statusDiv = document.createElement('div');
        statusDiv.style.textAlign = 'center';
        statusDiv.style.padding = '12px';
        if (combatState) {
            statusDiv.textContent = "EN COMBAT !";
            statusDiv.style.color = 'var(--accent-color)';
            statusDiv.style.fontWeight = 'bold';
        } else {
            statusDiv.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        }
        DOM.actionsEl.appendChild(statusDiv);
        DOM.actionsEl.scrollTop = oldScrollTop; // Restaurer la position du scroll
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

    let tileKeyForSearch = null;
    for (const key in TILE_TYPES) {
        if (TILE_TYPES[key].name === tileType.name) {
            tileKeyForSearch = key;
            break;
        }
    }

    if (tileKeyForSearch && SEARCH_ZONE_CONFIG[tileKeyForSearch]) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
        createButton("🔎 Fouiller la zone", 'search_zone', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : "Chercher des objets ou des ennuis...");
    }

    if (tile.type === TILE_TYPES.TREASURE_CHEST) {
        if (!tile.isOpened) {
            const hasKey = player.inventory[TILE_TYPES.TREASURE_CHEST.requiresKey] > 0;
            createButton("💎 Ouvrir le Trésor", 'open_treasure', {}, !hasKey, !hasKey ? `Nécessite : ${TILE_TYPES.TREASURE_CHEST.requiresKey}` : "Utiliser la clé pour ouvrir");
        } else {
            const p = document.createElement('p');
            p.textContent = "Ce trésor a déjà été vidé.";
            p.style.textAlign = 'center';
            DOM.actionsEl.appendChild(p);
        }
    }

    if (tile.hiddenItem) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory && !player.inventory[tile.hiddenItem];
        createButton(`🔑 Prendre ${tile.hiddenItem}`, 'take_hidden_item', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : `Ramasser ${tile.hiddenItem}`);
    }

    if (tileType.resource && (tile.harvestsLeft > 0 || tile.harvestsLeft === Infinity)) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
        if (tileType.name === 'Forêt') {
            const tool = player.equipment.weapon;
            const canCutWood = tool && tool.action === 'harvest_wood';
            createButton(`🪵 Couper du bois (Terrain)`, 'harvest_wood', {}, isInventoryFull || !canCutWood, isInventoryFull ? "Inventaire plein" : !canCutWood ? "Nécessite une hache ou une scie" : "");
        } else {
            if (!tile.buildings.some(b => TILE_TYPES[b.key]?.action?.id === 'harvest' || TILE_TYPES[b.key]?.actions?.some(a => a.id === 'harvest'))) {
                 const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
                createButton(`${resourceIcon} Récolter ${tileType.resource.type} (Terrain)`, 'harvest', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : "");
            }
        }
    }
    if (player.inventory['Eau salée'] > 0) {
        createButton("🚱 Boire Eau Salée", 'consume_eau_salee', {itemName: 'Eau salée'});
    }


    const equippedWeaponForActions = player.equipment.weapon;
    const canHunt = equippedWeaponForActions && (equippedWeaponForActions.type === 'weapon' || (equippedWeaponForActions.type === 'tool' && equippedWeaponForActions.stats && equippedWeaponForActions.stats.damage > 0));
    if (tileType.name === 'Forêt' || tileType.name === 'Plaine') {
        createButton("🏹 Chasser (Terrain)", 'hunt', {}, !canHunt, !canHunt ? "Nécessite une arme équipée" : "");
    }
    const canFish = equippedWeaponForActions && equippedWeaponForActions.action === 'fish';
    if (tileType.name === 'Plage') {
         createButton("🎣 Pêcher (Terrain)", 'fish', {}, !canFish, !canFish ? "Nécessite une canne à pêche" : "");
    }

    if (tileType.name === TILE_TYPES.PLAINS.name) {
        const canPlant = State.hasResources({ 'Graine d\'arbre': 5, 'Eau pure': 1 }).success;
        createButton("🌱 Planter Arbre", 'plant_tree', {}, !canPlant, !canPlant ? "Nécessite 5 graines, 1 eau pure" : "Transformer cette plaine en forêt");
    }

    // Gestion du bouton "Parler aux PNJ"
    if (!combatState) {
        const npcsOnTile = State.state.npcs.filter(npc => npc.x === player.x && npc.y === player.y);
        npcsOnTile.forEach(npc => {
            const talkButton = createButton(`💬 Parler à ${npc.name}`, 'talk_to_npc', { npcId: npc.id });
            talkButton.onclick = () => { // On gère le clic directement ici pour appeler handlePlayerAction
                Interactions.handlePlayerAction('talk_to_npc', { npcId: npc.id }, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
            };
        });
    }


    if (tile.type.buildable && tile.buildings.length < CONFIG.MAX_BUILDINGS_PER_TILE) {
        const buildMenuContainer = document.createElement('div');
        buildMenuContainer.id = 'build-menu-container';

        const mainBuildButton = document.createElement('button');
        mainBuildButton.id = 'main-build-btn';
        mainBuildButton.textContent = "🏗️ Construire ▼";
        DOM.actionsEl.appendChild(mainBuildButton);

        const buildSubmenuContent = document.createElement('div');
        buildSubmenuContent.id = 'build-submenu-content';
        buildSubmenuContent.classList.add('hidden');
        DOM.actionsEl.appendChild(buildSubmenuContent);

        mainBuildButton.onclick = () => {
            buildSubmenuContent.classList.toggle('hidden');
            mainBuildButton.textContent = buildSubmenuContent.classList.contains('hidden') ? "🏗️ Construire ▼" : "🏗️ Construire ▲";
        };


        const constructibleBuildings = Object.keys(TILE_TYPES).filter(key => {
            const bt = TILE_TYPES[key];
            if (!bt.isBuilding || !bt.cost) return false;
            if (tile.type.name !== TILE_TYPES.PLAINS.name) {
                return key === 'MINE' || key === 'CAMPFIRE';
            }
            const buildingRecipeParchemin = Object.values(ITEM_TYPES).find(item => item.teachesRecipe === bt.name && item.isBuildingRecipe);
            if (buildingRecipeParchemin && !knownRecipes[bt.name]) {
                 return false;
            }
            return true;
        });

        if (constructibleBuildings.length > 0) {
            constructibleBuildings.sort().forEach(bKey => {
                const buildingType = TILE_TYPES[bKey];
                let costString = "";
                const costs = { ...buildingType.cost };
                const toolReqArray = costs.toolRequired;
                delete costs.toolRequired;

                for (const item in costs) {
                    costString += `${costs[item]} ${item}, `;
                }
                if (toolReqArray) costString += `Outil: ${toolReqArray.join('/')}, `;
                costString = costString.length > 0 ? costString.slice(0, -2) : "Aucun coût";

                const hasEnoughResources = State.hasResources(costs).success;
                let hasRequiredTool = true;
                if (toolReqArray) {
                    hasRequiredTool = toolReqArray.some(toolName =>
                        player.equipment.weapon && player.equipment.weapon.name === toolName
                    );
                }
                const canBuild = hasEnoughResources && hasRequiredTool;
                const buildingIcon = buildingType.icon || ITEM_TYPES[buildingType.name]?.icon || '🏛️';

                createButton(
                    `${buildingIcon} ${buildingType.name} (${costString})`,
                    'build_structure',
                    { structureKey: bKey },
                    !canBuild,
                    !canBuild ? "Ressources ou outil manquant" : `Construire un ${buildingType.name}`,
                    buildSubmenuContent
                );
            });
        } else {
             mainBuildButton.disabled = true;
             mainBuildButton.textContent = "🏗️ Construire";
        }
    }


    if (tile.buildings && tile.buildings.length > 0) {
        const buildingsHeader = document.createElement('h4');
        buildingsHeader.textContent = "Actions des Bâtiments";
        DOM.actionsEl.appendChild(buildingsHeader);

        tile.buildings.forEach((buildingInstance, index) => {
            const buildingDef = TILE_TYPES[buildingInstance.key];
            if (!buildingDef) return;

            const buildingNameDisplay = document.createElement('p');
            buildingNameDisplay.innerHTML = `<strong>${buildingDef.name}</strong> (Dura: ${buildingInstance.durability}/${buildingInstance.maxDurability})`;
            buildingNameDisplay.style.marginBottom = '5px';
            buildingNameDisplay.style.borderTop = '1px solid #ccc';
            buildingNameDisplay.style.paddingTop = '5px';
            DOM.actionsEl.appendChild(buildingNameDisplay);

            if (buildingDef.sleepEffect) {
                 createButton("😴 Dormir (8h)", 'sleep', { buildingKeyForDamage: buildingInstance.key });
            }

            if (buildingInstance.key === 'CAMPFIRE') {
                let canCookFish = State.hasResources({ 'Poisson cru': 1, 'Bois': 1 }).success;
                let canCookMeat = State.hasResources({ 'Viande crue': 1, 'Bois': 1 }).success;
                let canCookOeuf = State.hasResources({ 'Oeuf cru': 1, 'Bois': 1 }).success;
                createButton("🍳 Cuisiner Poisson", 'cook', {raw: 'Poisson cru', buildingKeyForDamage: 'CAMPFIRE'}, !canCookFish);
                createButton("🍖 Cuisiner Viande", 'cook', {raw: 'Viande crue', buildingKeyForDamage: 'CAMPFIRE'}, !canCookMeat);
                createButton("🍳 Cuisiner Oeuf", 'cook', {raw: 'Oeuf cru', buildingKeyForDamage: 'CAMPFIRE'}, !canCookOeuf);
            }

            const actionsToShow = buildingDef.actions || (buildingDef.action ? [buildingDef.action] : []);
            actionsToShow.forEach(actionInfo => {
                 let disabledAction = false;
                 let titleAction = actionInfo.name;
                 if (actionInfo.costItem && (!player.inventory[actionInfo.costItem] || player.inventory[actionInfo.costItem] < 1)) {
                     disabledAction = true;
                     titleAction += ` (Nécessite 1 ${actionInfo.costItem})`;
                 }

                createButton(
                    actionInfo.name,
                    'use_building_action',
                    { buildingKey: buildingInstance.key, specificActionId: actionInfo.id },
                    disabledAction,
                    titleAction
                );
            });

            if (buildingDef.inventory) {
                const openChestButton = createButton(
                    `🧰 Ouvrir Stockage (${buildingDef.name})`,
                    'open_building_inventory',
                    { buildingKey: buildingInstance.key }
                );
                openChestButton.onclick = () => UI.showInventoryModal(State.state);
            }
        });
    }
    if (getTotalResources(player.inventory) > 0) {
        createButton("📥 Déposer un objet au sol", 'drop_item_prompt');
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
            const abundantResourceList = ['Bois', 'Poisson cru', 'Pierre', 'Feuilles'];
            const abundantResource = abundantResourceList[Math.floor(Math.random() * abundantResourceList.length)];
            activeEvent.type = 'Abondance';
            activeEvent.duration = 2;
            activeEvent.data = { resource: abundantResource };
            UI.addChatMessage(`Les ${abundantResource.toLowerCase()}s sont étrangement abondants !`, "system_event");
        }
    }
}

function gameLoop(currentTime) {
    if (!State.state || !State.state.player) {
        requestAnimationFrame(gameLoop);
        return;
    }
    const { player, isGameOver, combatState } = State.state;
    if (isGameOver) return;
    if (player.health <= 0) {
        if(!isGameOver) endGame(false);
        return;
    }
    if (lastFrameTimestamp === 0) lastFrameTimestamp = currentTime;
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

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

    if (player.animationState) {
        const anim = player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50);
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;

        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                State.applyPlayerMove(anim.direction);
                UI.renderScene(State.state);
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
    const { player, map, enemies, combatState } = State.state;
    if (player.isBusy || player.animationState || combatState) {
        return;
    }

    let canMove = true;

    const currentEnemyOnTile = findEnemyOnTile(player.x, player.y, enemies);
    if (currentEnemyOnTile) {
        UI.addChatMessage("Vous ne pouvez pas fuir, vous devez combattre !", "system");
        State.startCombat(player, currentEnemyOnTile);
        UI.showCombatModal(State.state.combatState);
        updatePossibleActions();
        return;
    }

    let newX = player.x, newY = player.y;
    if (direction === 'north') newY--;
    else if (direction === 'south') newY++;
    else if (direction === 'west') newX--;
    else if (direction === 'east') newX++;

    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
        return;
    }

    if (!Interactions.applyRandomStatCost(player, 1, "déplacement")) {
        // Géré dans applyRandomStatCost
    }


    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };

    updatePossibleActions();
    UI.updateAllButtonsState(State.state);
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
            if (inventory['Kit de Secours'] > 0 && (player.status === 'Blessé' || player.status === 'Malade')) itemToConsume = 'Kit de Secours';
            else if (inventory['Bandage'] > 0 && player.status === 'Blessé') itemToConsume = 'Bandage';
            else if (inventory['Médicaments'] > 0 && player.status === 'Malade') itemToConsume = 'Médicaments';
            break;
        case 'thirst':
            if (inventory['Eau pure'] > 0) itemToConsume = 'Eau pure';
            else if (inventory['Noix de coco'] > 0) itemToConsume = 'Noix de coco';
            break;
        case 'hunger':
            if (inventory['Viande cuite'] > 0) itemToConsume = 'Viande cuite';
            else if (inventory['Poisson cuit'] > 0) itemToConsume = 'Poisson cuit';
            else if (inventory['Oeuf cuit'] > 0) itemToConsume = 'Oeuf cuit';
            else if (inventory['Barre Énergétique'] > 0) itemToConsume = 'Barre Énergétique';
            else if (inventory['Banane'] > 0) itemToConsume = 'Banane';
            break;
        default:
            UI.addChatMessage("Type de consommation inconnu via bouton rapide.", "system");
            return;
    }

    if (!itemToConsume) {
        let message = "Vous n'avez rien pour ";
        let targetButton = null;
        if (statType === 'health' && DOM.consumeHealthBtn) { message += "vous soigner (ou vous n'êtes pas dans l'état requis)."; targetButton = DOM.consumeHealthBtn; }
        else if (statType === 'thirst' && DOM.consumeThirstBtn) { message += "étancher votre soif."; targetButton = DOM.consumeThirstBtn; }
        else if (statType === 'hunger' && DOM.consumeHungerBtn) { message += "calmer votre faim."; targetButton = DOM.consumeHungerBtn; }
        UI.addChatMessage(message, "system");
        if (targetButton) UI.triggerShake(targetButton);
        return;
    }

    const result = State.consumeItem(itemToConsume);

    UI.addChatMessage(result.message, result.success ? (itemToConsume === 'Porte bonheur' ? 'system_event' : 'system') : 'system');
    if (result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => {
                const type = text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info');
                UI.showFloatingText(text, type);
            });
        }
        fullUIUpdate();
    } else {
        if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
    }
}

function handleConsumeClick(itemName) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }

    const itemDef = ITEM_TYPES[itemName];

    if (itemName === 'Eau salée') {
         Interactions.handlePlayerAction('consume_eau_salee', {itemName: 'Eau salée'}, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
         return;
    }

    if (itemDef && itemDef.slot && ['weapon', 'shield', 'body', 'head', 'feet', 'bag'].includes(itemDef.slot)) {
        const equipResult = State.equipItem(itemName);
        UI.addChatMessage(equipResult.message, equipResult.success ? 'system' : 'system_error');
        if (equipResult.success) fullUIUpdate();
        return;
    }


    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable') ) {
        if (itemDef && !itemDef.teachesRecipe) {
            UI.addChatMessage(`"${itemName}" n'est pas consommable directement depuis l'inventaire de cette manière.`, "system");
        }
        return;
    }

    if (itemName === 'Carte') {
        Interactions.handlePlayerAction('open_large_map', {}, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        return;
    }

    const result = State.consumeItem(itemName);

    UI.addChatMessage(result.message, result.success ? (itemName.startsWith('Parchemin') || itemName === 'Porte bonheur' ? 'system_event' : 'system') : 'system');
    if(result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => {
                 const type = text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info');
                UI.showFloatingText(text, type);
            });
        }
        fullUIUpdate();
    } else {
        if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl);
    }
}

function fullUIUpdate() {
    if (!State.state || !State.state.player) return;
    UI.updateAllUI(State.state);
    updatePossibleActions();
    UI.updateAllButtonsState(State.state);

    if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) {
        UI.updateEquipmentModal(State.state);
    }
    if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) {
        UI.showInventoryModal(State.state);
    }
    if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) {
        if (State.state && State.state.config) {
            UI.drawLargeMap(State.state, State.state.config);
            UI.populateLargeMapLegend();
        }
    }
    if (DOM.bottomBarEl) {
        UI.updateGroundItemsPanel(State.state.map[State.state.player.y][State.state.player.x]);
    }
}

function dailyUpdate() {
    if (!State.state || State.state.isGameOver) return;
    if (State.state.day >= 100) {
        endGame(true);
        return;
    }
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
    fullUIUpdate();
}

function handleDragStart(e) {
    const itemEl = e.target instanceof Element ? e.target.closest('.inventory-item[draggable="true"]') : null;

    if (!itemEl) {
        return;
    }

    const ownerEl = itemEl.closest('[data-owner]');
    if (!ownerEl) {
        return;
    }

    draggedItemInfo = {
        element: itemEl,
        itemName: itemEl.dataset.itemName,
        itemCount: parseInt(itemEl.dataset.itemCount || '1', 10),
        sourceOwner: ownerEl.dataset.owner,
        sourceSlotType: itemEl.dataset.slotType
    };
    setTimeout(() => itemEl.classList.add('dragging'), 0);
}


function handleDragOver(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (dropZone) {
        dropZone.classList.add('drag-over');
    }
}
function handleDragLeave(e) {
    const dropZone = e.target.closest('.droppable');
    if (dropZone) {
        dropZone.classList.remove('drag-over');
    }
}
function handleDragEnd() {
    if (draggedItemInfo && draggedItemInfo.element) {
        draggedItemInfo.element.classList.remove('dragging');
    }
    draggedItemInfo = null;
    document.querySelectorAll('.droppable.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (!draggedItemInfo || !dropZone) {
        return;
    }

    const destOwner = dropZone.dataset.owner;

    // Cas 1: Équipement (modale ou barre du bas)
    if (dropZone.closest('#equipment-modal') || dropZone.closest('#bottom-bar-equipment-slots')) {
        const destSlotType = dropZone.dataset.slotType;
        const itemDef = ITEM_TYPES[draggedItemInfo.itemName];

        if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'equipment') {
            if (itemDef && itemDef.slot === destSlotType) {
                State.equipItem(draggedItemInfo.itemName);
            } else {
                UI.addChatMessage("Cet objet ne va pas dans cet emplacement.", "system");
            }
        } else if (draggedItemInfo.sourceOwner === 'equipment' && destOwner === 'player-inventory') {
            if (draggedItemInfo.sourceSlotType) {
                State.unequipItem(draggedItemInfo.sourceSlotType);
            }
        }
    }
    // Cas 2: Inventaire partagé (modale)
    else if (dropZone.closest('#inventory-modal')) {
        let transferType = '';
        if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'shared') {
            transferType = 'deposit';
        } else if (draggedItemInfo.sourceOwner === 'shared' && destOwner === 'player-inventory') {
            transferType = 'withdraw';
        }

        if (transferType) {
            if (draggedItemInfo.itemCount > 1) {
                UI.showQuantityModal(draggedItemInfo.itemName, draggedItemInfo.itemCount, amount => {
                    if (amount > 0) State.applyBulkInventoryTransfer(draggedItemInfo.itemName, amount, transferType);
                    fullUIUpdate();
                });
            } else {
                State.applyBulkInventoryTransfer(draggedItemInfo.itemName, 1, transferType);
            }
        }
    }
    // Cas 3: Drag de l'inventaire joueur VERS le sol
    else if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'ground') {
        if (draggedItemInfo.itemCount > 1) {
            UI.showQuantityModal(`Déposer ${draggedItemInfo.itemName}`, draggedItemInfo.itemCount, amount => {
                if (amount > 0) {
                    const dropResult = State.dropItemOnGround(draggedItemInfo.itemName, amount);
                    UI.addChatMessage(dropResult.message, dropResult.success ? 'system' : 'system_error');
                }
                fullUIUpdate();
            });
        } else {
            const dropResult = State.dropItemOnGround(draggedItemInfo.itemName, 1);
            UI.addChatMessage(dropResult.message, dropResult.success ? 'system' : 'system_error');
        }
    }
    // Cas 4: Drag du sol VERS l'inventaire joueur (directement sur la zone d'inventaire principale)
    else if (draggedItemInfo.sourceOwner === 'ground' && destOwner === 'player-inventory' && dropZone.id === 'inventory-categories') {
         if (draggedItemInfo.itemCount > 1) {
            UI.showQuantityModal(`Ramasser ${draggedItemInfo.itemName}`, draggedItemInfo.itemCount, amount => {
                if (amount > 0) {
                    const pickupResult = State.pickUpItemFromGround(draggedItemInfo.itemName, amount);
                    UI.addChatMessage(pickupResult.message, pickupResult.success ? 'system' : 'system_error');
                }
                fullUIUpdate();
            });
        } else {
            const pickupResult = State.pickUpItemFromGround(draggedItemInfo.itemName, 1);
            UI.addChatMessage(pickupResult.message, pickupResult.success ? 'system' : 'system_error');
        }
    }


    fullUIUpdate();
    if (dropZone) dropZone.classList.remove('drag-over');
}


function setupDragAndDropForModal(modalElement) {
    if (!modalElement) {
        return;
    }
    modalElement.addEventListener('dragstart', handleDragStart);
    modalElement.addEventListener('dragover', handleDragOver);
    modalElement.addEventListener('dragleave', handleDragLeave);
    modalElement.addEventListener('dragend', handleDragEnd);
    modalElement.addEventListener('drop', handleDrop);
}

function handleEquipmentSlotClick(slotType) {
    if (!State.state || !State.state.player) return;
    const { player } = State.state;
    if (player.isBusy || player.animationState) {
        UI.addChatMessage("Vous êtes occupé.", "system");
        return;
    }

    if (player.equipment[slotType]) {
        const unequipResult = State.unequipItem(slotType);
        UI.addChatMessage(unequipResult.message, unequipResult.success ? 'system' : 'system_error');
        if (unequipResult.success) fullUIUpdate();
    }
}

function setupEventListeners() {
    if (!DOM.navNorth) { console.error("DOM non initialisé avant setupEventListeners"); return; }

    DOM.navNorth.addEventListener('click', () => handleNavigation('north'));
    DOM.navSouth.addEventListener('click', () => handleNavigation('south'));
    DOM.navEast.addEventListener('click', () => handleNavigation('east'));
    DOM.navWest.addEventListener('click', () => handleNavigation('west'));

    if (DOM.consumeHealthBtn) DOM.consumeHealthBtn.addEventListener('click', () => handleSpecificConsume('health'));
    if (DOM.consumeThirstBtn) DOM.consumeThirstBtn.addEventListener('click', () => handleSpecificConsume('thirst'));
    if (DOM.consumeHungerBtn) DOM.consumeHungerBtn.addEventListener('click', () => handleSpecificConsume('hunger'));

    // Le bouton #open-equipment-btn a été supprimé
    // if (DOM.openEquipmentBtn) DOM.openEquipmentBtn.addEventListener('click', () => UI.showEquipmentModal(State.state));
    if (DOM.closeEquipmentModalBtn) DOM.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);

    if (DOM.enlargeMapBtn) {
        DOM.enlargeMapBtn.addEventListener('click', () => {
            Interactions.handlePlayerAction('open_large_map', {}, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        });
    }
    if (DOM.closeLargeMapBtn) DOM.closeLargeMapBtn.addEventListener('click', UI.hideLargeMap);

    if (DOM.toggleChatSizeBtn && DOM.bottomBarChatPanelEl) {
        DOM.toggleChatSizeBtn.addEventListener('click', () => {
            DOM.bottomBarChatPanelEl.classList.toggle('chat-enlarged');
            if (DOM.bottomBarEl) DOM.bottomBarEl.classList.toggle('chat-enlarged'); // Pour que toute la barre s'agrandisse
            if (DOM.toggleChatSizeBtn) {
                DOM.toggleChatSizeBtn.textContent = DOM.bottomBarChatPanelEl.classList.contains('chat-enlarged') ? '⌄' : '⌃';
            }
            if (DOM.chatMessagesEl) DOM.chatMessagesEl.scrollTop = DOM.chatMessagesEl.scrollHeight;
        });
    }


    if (DOM.closeInventoryModalBtn) {
        DOM.closeInventoryModalBtn.addEventListener('click', UI.hideInventoryModal);
    }

    if (DOM.inventoryCategoriesEl) DOM.inventoryCategoriesEl.addEventListener('click', e => {
        const itemEl = e.target.closest('.inventory-item');
        if (itemEl && itemEl.dataset.itemName) {
            handleConsumeClick(itemEl.dataset.itemName);
        }
        else {
            const header = e.target.closest('.category-header');
            if (header) {
                header.classList.toggle('open');
                if (header.nextElementSibling) header.nextElementSibling.classList.toggle('visible');
            }
        }
    });
    if (DOM.bottomBarGroundItemsEl) {
        DOM.bottomBarGroundItemsEl.addEventListener('click', e => {
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                const itemName = itemEl.dataset.itemName;
                const maxAmount = parseInt(itemEl.dataset.itemCount, 10);
                UI.showQuantityModal(`Ramasser ${itemName}`, maxAmount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                        fullUIUpdate();
                    }
                });
            }
        });
         setupDragAndDropForModal(DOM.bottomBarGroundItemsEl);
    }

    if (DOM.equipmentModal) setupDragAndDropForModal(DOM.equipmentModal);
    if (DOM.inventoryModal) setupDragAndDropForModal(DOM.inventoryModal);

    if (DOM.bottomBarEquipmentSlotsEl) {
        setupDragAndDropForModal(DOM.bottomBarEquipmentSlotsEl);
        DOM.bottomBarEquipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot-small');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item'); // On vérifie s'il y a un item affiché
                if (itemContent) { // On ne déséquipe que s'il y a un item
                    handleEquipmentSlotClick(slotEl.dataset.slotType);
                }
            }
        });
    }
    if (DOM.equipmentSlotsEl) { // Pour la modale d'équipement complète
        DOM.equipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item');
                if (itemContent) {
                    handleEquipmentSlotClick(slotEl.dataset.slotType);
                }
            }
        });
    }


    window.addEventListener('keydown', e => {
        if (document.activeElement === DOM.chatInputEl) return;
        if (e.key === 'Escape') {
            if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.hideEquipmentModal();
            else if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            else if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) UI.hideLargeMap();
            else if (DOM.combatModal && !DOM.combatModal.classList.contains('hidden')) UI.hideCombatModal();
            else if (DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden')) UI.hideQuantityModal();
        } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'z') handleNavigation('north');
        else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') handleNavigation('south');
        else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'q') handleNavigation('west');
        else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleNavigation('east');
        else if (e.key.toLowerCase() === 'e') UI.showEquipmentModal(State.state); // Peut-être changer ce raccourci si la modale est moins utilisée
        else if (e.key.toLowerCase() === 'm') {
             Interactions.handlePlayerAction('open_large_map', {}, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        }
    });
    window.gameState = State.state;
    UI.setupQuantityModalListeners();
}

function endGame(isVictory) {
    if (!State.state || State.state.isGameOver) return;
    State.state.isGameOver = true;
    if(State.state.gameIntervals) State.state.gameIntervals.forEach(clearInterval);
    if(State.state.combatState) UI.hideCombatModal();
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');

    const endModal = document.createElement('div');
    endModal.id = 'end-game-modal';
    endModal.style.cssText = `
        position: fixed; inset: 0; background-color: rgba(0,0,0,0.8);
        z-index: 10000; display: flex; flex-direction: column;
        justify-content: center; align-items: center; color: white;
        font-size: 2em; text-align: center; padding: 20px;
    `;
    const messageEl = document.createElement('p');
    messageEl.textContent = finalMessage;
    const reloadButton = document.createElement('button');
    reloadButton.textContent = "Recommencer";
    reloadButton.style.cssText = `
        padding: 15px 30px; font-size: 0.8em; margin-top: 30px;
        background-color: var(--action-color); color: var(--text-light);
        border: none; border-radius: 8px; cursor: pointer;
    `;
    reloadButton.onclick = () => window.location.reload();

    endModal.appendChild(messageEl);
    endModal.appendChild(reloadButton);
    document.body.appendChild(endModal);


    document.querySelectorAll('button').forEach(b => { if (b !== reloadButton) b.disabled = true; });
    if (DOM.chatInputEl) DOM.chatInputEl.disabled = true;
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
        console.log("DOM initialisé.");
        await UI.loadAssets(SPRITESHEET_PATHS);
        console.log("Assets chargés.");
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);

        State.initializeGameState(CONFIG);
        console.log("État du jeu initialisé.");

        UI.addChatMessage("Bienvenue aventurier, trouve vite d'autres aventuriers pour s'organiser ensemble!", "system_event", "Ancien");


        if (State.state && !State.state.config) {
            State.state.config = CONFIG;
            console.warn("State.state.config a été redéfini dans init de main.js, vérifier initializeGameState.");
        }


        setupEventListeners();
        console.log("Écouteurs d'événements configurés.");
        window.fullUIUpdate = fullUIUpdate;
        UI.updateBottomBarEquipmentPanel(State.state.player);
        fullUIUpdate();
        requestAnimationFrame(gameLoop);

        if (State.state) {
            State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
            State.state.gameIntervals.push(setInterval(() => {
                if (State.state.npcs && State.state.npcs.length > 0 && !State.state.combatState && (!State.state.player.isBusy || !State.state.player.animationState) ) {
                    npcChatter(State.state.npcs);
                }
            }, CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        }
        console.log("Jeu initialisé et boucles démarrées.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        if (document.body) {
            document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}<br>Vérifiez la console pour plus de détails. Pile d'appel : <pre>${error.stack}</pre></div>`;
        }
    }
}

window.addEventListener('load', init);