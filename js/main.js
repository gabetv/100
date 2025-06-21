// js/main.js
import * as UI from './ui.js';
import { initDOM } from './ui/dom.js'; 
import DOM from './ui/dom.js';         
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
    const { player, map, combatState, enemies, knownRecipes } = State.state;

    if (!map || !map[player.y] || !map[player.y][player.x]) return;
    
    const tile = map[player.y][player.x];
    const tileType = tile.type;
    const enemyOnTile = findEnemyOnTile(player.x, player.y, enemies);

    const createButton = (text, actionId, data = {}, disabled = false, title = '', parent = DOM.actionsEl) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = (e) => {
            handleGlobalPlayerAction(actionId, data);
        };
        parent.appendChild(button);
        return button;
    };

    // const actionsHeader = document.createElement('h4'); // MODIFIÉ (Point 9)
    // actionsHeader.textContent = "Actions sur la Tuile"; // MODIFIÉ (Point 9)
    // actionsHeader.style.marginTop = '0px'; // MODIFIÉ (Point 9)
    // DOM.actionsEl.appendChild(actionsHeader); // MODIFIÉ (Point 9)

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

    let tileKeyForSearch = null;
    for (const key in TILE_TYPES) {
        if (TILE_TYPES[key].name === tileType.name) {
            tileKeyForSearch = key;
            break;
        }
    }
    
    const hasBuilding = tile.buildings && tile.buildings.length > 0; // MODIFIÉ (Point 21)

    if (!hasBuilding) { // MODIFIÉ (Point 21)
        if (tileKeyForSearch && SEARCH_ZONE_CONFIG[tileKeyForSearch]) {
            const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
            createButton("🔎 Fouiller la zone", 'search_zone', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : "Chercher des objets ou des ennuis...");
        }

        if (tileType.name === 'Forêt' || tileType.name === 'Plaine') {
            const equippedWeaponForActionsHunt = player.equipment.weapon; // Renommer pour éviter conflit
            const canHunt = equippedWeaponForActionsHunt && (equippedWeaponForActionsHunt.type === 'weapon' || (equippedWeaponForActionsHunt.type === 'tool' && equippedWeaponForActionsHunt.stats && equippedWeaponForActionsHunt.stats.damage > 0));
            if (canHunt) {
                createButton("🏹 Chasser (Terrain)", 'hunt', {}, !canHunt, !canHunt ? "Nécessite une arme équipée" : "");
            }
        }
    
        if (tileType.name === TILE_TYPES.PLAINS.name) {
            const canPlant = State.hasResources({ 'Graine d\'arbre': 5, 'Eau pure': 1 }).success;
            createButton("🌱 Planter Arbre", 'plant_tree', {}, !canPlant, !canPlant ? "Nécessite 5 graines, 1 eau pure" : "Transformer cette plaine en forêt");
        }
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
        const isInventoryFullHarvest = getTotalResources(player.inventory) >= player.maxInventory; // Renommer
        if (tileType.name === 'Forêt') { // MODIFIÉ (Point 1)
            const equippedWeapon = player.equipment.weapon;
            if (equippedWeapon && equippedWeapon.name === 'Hache') {
                createButton(`🪓 Couper Bois (Hache)`, 'harvest_wood_hache', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
            } else if (equippedWeapon && equippedWeapon.name === 'Scie') {
                createButton(`🪚 Scier Bois (Scie)`, 'harvest_wood_scie', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
            } else {
                createButton(`✋ Ramasser Bois`, 'harvest_wood_mains', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
            }
        } else if (tileType.name === TILE_TYPES.WATER_LAGOON.name) { // MODIFIÉ (Point 7)
            const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
            createButton(`${resourceIcon} Récolter ${tileType.resource.type} (Terrain)`, 'harvest', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
        } else {
            if (!tile.buildings.some(b => TILE_TYPES[b.key]?.action?.id === 'harvest' || TILE_TYPES[b.key]?.actions?.some(a => a.id === 'harvest'))) {
                 const resourceIcon = ITEM_TYPES[tileType.resource.type]?.icon || '';
                createButton(`${resourceIcon} Récolter ${tileType.resource.type} (Terrain)`, 'harvest', {}, isInventoryFullHarvest, isInventoryFullHarvest ? "Inventaire plein" : "");
            }
        }
    }
    if (player.inventory['Eau salée'] > 0) { // MODIFIÉ (Point 6)
        createButton("🚱 Boire Eau Salée", 'consume_eau_salee', {itemName: 'Eau salée'});
    }

    const equippedWeaponForActionsFish = player.equipment.weapon; // Renommer
    const canFish = equippedWeaponForActionsFish && equippedWeaponForActionsFish.action === 'fish';
    if (tileType.name === 'Plage') {
         createButton("🎣 Pêcher (Terrain)", 'fish', {}, !canFish, !canFish ? "Nécessite une canne à pêche" : "");
    }


    if (!combatState) {
        const npcsOnTile = State.state.npcs.filter(npc => npc.x === player.x && npc.y === player.y);
        npcsOnTile.forEach(npc => {
            const talkButton = createButton(`💬 Parler à ${npc.name}`, 'talk_to_npc', { npcId: npc.id });
        });
    }

    if (tile.type.buildable && !hasBuilding) { // MODIFIÉ (Point 21)
        const mainBuildButton = document.createElement('button');
        mainBuildButton.id = 'main-build-btn';
        mainBuildButton.textContent = "🏗️ Construire...";
        mainBuildButton.onclick = () => {
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
            buildingNameDisplay.innerHTML = `<strong>${buildingDef.name}</strong> (Durabilité: ${buildingInstance.durability}/${buildingInstance.maxDurability})`; // MODIFIÉ (Point 22)
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
                createButton( actionInfo.name, 'use_building_action', { buildingKey: buildingInstance.key, specificActionId: actionInfo.id }, disabledAction, titleAction );
            });

            if (buildingDef.inventory) {
                const openChestButton = createButton( `🧰 Ouvrir Stockage (${buildingDef.name})`, 'open_building_inventory', { buildingKey: buildingInstance.key });
                openChestButton.onclick = () => UI.showInventoryModal(State.state); 
            }
        });
    }
    // if (getTotalResources(player.inventory) > 0) { // MODIFIÉ (Point 25)
    //     createButton("📥 Déposer un objet au sol", 'drop_item_prompt'); // MODIFIÉ (Point 25)
    // }
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
        if(DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`]) {
            UI.triggerShake(DOM[`nav${direction.charAt(0).toUpperCase() + direction.slice(1)}`]);
        }
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
            else if (inventory['Sucre'] > 0) itemToConsume = 'Sucre'; // Ajout pour test
            else if (inventory['Sel'] > 0) itemToConsume = 'Sel';     // Ajout pour test
            break;
        default: UI.addChatMessage("Type de consommation inconnu via bouton rapide.", "system"); return;
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
                // UI.showFloatingText(text, type); // MODIFIÉ (Point 23) - Commenté, sauf si c'est un statut
                if (text.toLowerCase().includes('statut:')) UI.showFloatingText(text, type);
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
    if (!itemDef || (itemDef.type !== 'consumable' && !itemDef.teachesRecipe && itemDef.type !== 'usable' && itemDef.type !== 'key') ) { // Ajout key
        if (itemDef && !itemDef.teachesRecipe) {
            UI.addChatMessage(`"${itemName}" n'est pas consommable directement depuis l'inventaire de cette manière.`, "system");
        }
        return;
    }
    if (itemName === 'Carte') {
        handleGlobalPlayerAction('open_large_map', {});
        return;
    }
    const result = State.consumeItem(itemName);
    UI.addChatMessage(result.message, result.success ? (itemName.startsWith('Parchemin') || itemName === 'Porte bonheur' ? 'system_event' : 'system') : 'system');
    if(result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => {
                 const type = text.startsWith('+') ? 'gain' : (text.startsWith('-') ? 'cost' : 'info');
                // UI.showFloatingText(text, type); // MODIFIÉ (Point 23) - Commenté, sauf si c'est un statut
                if (text.toLowerCase().includes('statut:')) UI.showFloatingText(text, type);
                else if (itemName === 'Porte bonheur' && text.includes('+1')) UI.showFloatingText(text, type); // Pour le parchemin du porte bonheur

            });
        }
        fullUIUpdate();
    } else { if (DOM.inventoryCategoriesEl) UI.triggerShake(DOM.inventoryCategoriesEl); }
}

window.fullUIUpdate = function() {
    if (!State.state || !State.state.player) return;
    UI.updateAllUI(State.state);
    updatePossibleActions(); 
    UI.updateAllButtonsState(State.state); 

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
    if (DOM.bottomBarEl) {
        UI.updateGroundItemsPanel(State.state.map[State.state.player.y][State.state.player.x]);
    }
};
window.updatePossibleActions = updatePossibleActions;
window.UI = UI; 

window.handleGlobalPlayerAction = (actionId, data) => {
    Interactions.handlePlayerAction(actionId, data, { 
        updateAllUI: window.fullUIUpdate, 
        updatePossibleActions: window.updatePossibleActions, 
        updateAllButtonsState: () => window.UI.updateAllButtonsState(State.state) 
    });
};


function dailyUpdate() {
    if (!State.state || State.state.isGameOver) return;
    if (State.state.day >= 100) { endGame(true); return; }
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
    window.fullUIUpdate();
}

function handleDragStart(e) {
    const itemEl = e.target instanceof Element ? e.target.closest('.inventory-item[draggable="true"]') : null;
    if (!itemEl) return;
    const ownerEl = itemEl.closest('[data-owner], .equipment-slot[data-owner], .equipment-slot-small[data-owner]');
    if (!ownerEl) { console.warn("Drag Start: Owner element not found for", itemEl); return; }
    
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
    if (dropZone) dropZone.classList.add('drag-over');
}
function handleDragLeave(e) {
    const dropZone = e.target.closest('.droppable');
    if (dropZone) dropZone.classList.remove('drag-over');
}
function handleDragEnd() {
    if (draggedItemInfo && draggedItemInfo.element) draggedItemInfo.element.classList.remove('dragging');
    draggedItemInfo = null;
    document.querySelectorAll('.droppable.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDrop(e) {
    e.preventDefault();
    const dropZone = e.target.closest('.droppable');
    if (!draggedItemInfo || !dropZone) return;

    const destOwner = dropZone.dataset.owner;
    const destSlotType = dropZone.dataset.slotType;

    let transferProcessed = false;

    if (destOwner === 'equipment') {
        const itemDef = ITEM_TYPES[draggedItemInfo.itemName];
        if (draggedItemInfo.sourceOwner === 'player-inventory') {
            if (itemDef && itemDef.slot === destSlotType) {
                State.equipItem(draggedItemInfo.itemName);
                transferProcessed = true;
            } else { UI.addChatMessage("Cet objet ne va pas dans cet emplacement.", "system"); }
        }
    } else if (destOwner === 'player-inventory') { 
        if (draggedItemInfo.sourceOwner === 'equipment' && draggedItemInfo.sourceSlotType) {
            State.unequipItem(draggedItemInfo.sourceSlotType);
            transferProcessed = true;
        } else if (draggedItemInfo.sourceOwner === 'ground') { 
            const itemName = draggedItemInfo.itemName;
            const maxAmount = draggedItemInfo.itemCount;
            if (maxAmount > 1) {
                UI.showQuantityModal(`Ramasser ${itemName}`, maxAmount, (amount) => {
                    if (amount > 0) {
                        const result = State.pickUpItemFromGround(itemName, amount);
                        UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                    }
                    window.fullUIUpdate();
                });
            } else {
                const result = State.pickUpItemFromGround(itemName, 1);
                UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
            }
            transferProcessed = true; 
        }
    } else if (dropZone.closest('#inventory-modal')) { 
        let transferType = '';
        if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'shared') transferType = 'deposit';
        else if (draggedItemInfo.sourceOwner === 'shared' && destOwner === 'player-inventory') transferType = 'withdraw';
        
        if (transferType) {
            if (draggedItemInfo.itemCount > 1) {
                UI.showQuantityModal(draggedItemInfo.itemName, draggedItemInfo.itemCount, amount => {
                    if (amount > 0) State.applyBulkInventoryTransfer(draggedItemInfo.itemName, amount, transferType);
                    window.fullUIUpdate();
                });
            } else { State.applyBulkInventoryTransfer(draggedItemInfo.itemName, 1, transferType); }
            transferProcessed = true;
        }
    } else if (destOwner === 'ground' && draggedItemInfo.sourceOwner === 'player-inventory') { // MODIFIÉ (Point 4)
        const itemName = draggedItemInfo.itemName;
        const maxAmount = draggedItemInfo.itemCount;
        if (maxAmount > 1) {
            UI.showQuantityModal(`Déposer ${itemName}`, maxAmount, (amount) => {
                if (amount > 0) {
                    const result = State.dropItemOnGround(itemName, amount);
                    UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
                }
                window.fullUIUpdate();
            });
        } else {
            const result = State.dropItemOnGround(itemName, 1);
            UI.addChatMessage(result.message, result.success ? 'system' : 'system_error');
        }
        transferProcessed = true;
    }
    
    if (transferProcessed) window.fullUIUpdate();
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

    if (DOM.consumeHealthBtn) DOM.consumeHealthBtn.addEventListener('click', () => handleSpecificConsume('health'));
    if (DOM.consumeThirstBtn) DOM.consumeThirstBtn.addEventListener('click', () => handleSpecificConsume('thirst'));
    if (DOM.consumeHungerBtn) DOM.consumeHungerBtn.addEventListener('click', () => handleSpecificConsume('hunger'));

    if (DOM.closeEquipmentModalBtn) DOM.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);
    if (DOM.closeBuildModalBtn) DOM.closeBuildModalBtn.addEventListener('click', UI.hideBuildModal);

    if (DOM.enlargeMapBtn) DOM.enlargeMapBtn.addEventListener('click', () => handleGlobalPlayerAction('open_large_map', {}));
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
            const itemEl = e.target.closest('.inventory-item');
            if (itemEl && itemEl.dataset.itemName) {
                handleConsumeClick(itemEl.dataset.itemName);
            } else {
                const header = e.target.closest('.category-header');
                if (header) {
                    header.classList.toggle('open');
                    if (header.nextElementSibling) header.nextElementSibling.classList.toggle('visible');
                }
            }
        });
        setupDragAndDropForContainer(DOM.inventoryCategoriesEl);
    }

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


    if (DOM.bottomBarEquipmentSlotsEl) {
        setupDragAndDropForContainer(DOM.bottomBarEquipmentSlotsEl);
        DOM.bottomBarEquipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot-small.droppable');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item'); 
                if (itemContent) handleEquipmentSlotClick(slotEl.dataset.slotType);
            }
        });
    }
    if (DOM.equipmentSlotsEl) { 
        DOM.equipmentSlotsEl.addEventListener('click', e => {
            const slotEl = e.target.closest('.equipment-slot.droppable');
            if (slotEl && slotEl.dataset.slotType) {
                const itemContent = slotEl.querySelector('.inventory-item');
                if (itemContent) handleEquipmentSlotClick(slotEl.dataset.slotType);
            }
        });
    }

    window.addEventListener('keydown', e => {
        // MODIFIÉ (Point 10) - Ne plus vérifier si DOM.chatInputEl est activeElement pour les flèches etc.
        // mais le garder pour la touche Echap et les lettres spécifiques pour éviter conflit
        if (e.key === 'Escape') {
            if (DOM.buildModal && !DOM.buildModal.classList.contains('hidden')) UI.hideBuildModal();
            else if (DOM.equipmentModal && !DOM.equipmentModal.classList.contains('hidden')) UI.hideEquipmentModal();
            else if (DOM.inventoryModal && !DOM.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            else if (DOM.largeMapModal && !DOM.largeMapModal.classList.contains('hidden')) UI.hideLargeMap();
            else if (DOM.combatModal && !DOM.combatModal.classList.contains('hidden')) UI.hideCombatModal();
            else if (DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden')) UI.hideQuantityModal();
            return; // Empêcher d'autres actions si une modale est fermée
        }

        if (document.activeElement === DOM.chatInputEl || 
            (DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden'))) {
            return; 
        }

        if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w' || e.key.toLowerCase() === 'z') handleNavigation('north'); 
        else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') handleNavigation('south');
        else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'q') handleNavigation('west'); 
        else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') handleNavigation('east');
        else if (e.key.toLowerCase() === 'e') UI.showEquipmentModal(State.state); 
        else if (e.key.toLowerCase() === 'm') handleGlobalPlayerAction('open_large_map', {});
        else if (e.key.toLowerCase() === 'c') UI.showBuildModal(State.state); 
        else if (e.key.toLowerCase() === 'i') { 
            if (DOM.inventoryModal && DOM.inventoryModal.classList.contains('hidden')) {
                const tile = State.state.map[State.state.player.y][State.state.player.x];
                const buildingWithInv = tile.buildings.find(b => TILE_TYPES[b.key]?.inventory || TILE_TYPES[b.key]?.maxInventory);
                const tileHasInv = tile.type.inventory || tile.type.maxInventory;
                if(buildingWithInv || tileHasInv) UI.showInventoryModal(State.state);
            } else if (DOM.inventoryModal) {
                UI.hideInventoryModal();
            }
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
    endModal.style.cssText = `position: fixed; inset: 0; background-color: rgba(0,0,0,0.8); z-index: 10000; display: flex; flex-direction: column; justify-content: center; align-items: center; color: white; font-size: 2em; text-align: center; padding: 20px; backdrop-filter: blur(5px);`;
    const messageEl = document.createElement('p');
    messageEl.textContent = finalMessage;
    const reloadButton = document.createElement('button');
    reloadButton.textContent = "Recommencer";
    reloadButton.style.cssText = `padding: 15px 30px; font-size: 0.8em; margin-top: 30px; background-color: var(--action-color); color: var(--text-light); border: none; border-radius: 8px; cursor: pointer;`;
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

        initAdminControls(); 

        UI.updateBottomBarEquipmentPanel(State.state.player); 
        window.fullUIUpdate(); 
        requestAnimationFrame(gameLoop);

        if (State.state) {
            State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
            State.state.gameIntervals.push(setInterval(() => {
                if (State.state.npcs && State.state.npcs.length > 0 && !State.state.combatState && (!State.state.player.isBusy && !State.state.player.animationState) ) {
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