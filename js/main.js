// js/main.js
import * as UI from './ui.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES, ITEM_TYPES } from './config.js';
import * as State from './state.js';
import { decayStats, getTotalResources } from './player.js';
import { updateNpcs, npcChatter } from './npc.js';
import { updateEnemies, findEnemyOnTile, spawnSingleEnemy } from './enemy.js';
import * as Interactions from './interactions.js';

let lastFrameTimestamp = 0;
let lastStatDecayTimestamp = 0;

function updatePossibleActions() {
    UI.actionsEl.innerHTML = '';
    const { player, map, combatState } = State.state;
    const tile = map[player.y][player.x];
    const tileType = tile.type;
    
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
        UI.actionsEl.appendChild(statusDiv);
        return;
    }
    
    const createButton = (text, actionId, data = {}, disabled = false, title = '') => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = () => Interactions.handlePlayerAction(actionId, data, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        UI.actionsEl.appendChild(button);
    };

    if (tileType.resource && tile.harvestsLeft > 0) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
        const tool = player.equipment.weapon;

        if (tileType.name === 'Forêt') {
            const canCutWood = tool && tool.action === 'harvest_wood';
            createButton(`Couper du bois`, 'harvest_wood', {}, isInventoryFull || !canCutWood, 
                isInventoryFull ? "Inventaire plein" : !canCutWood ? "Nécessite une hache ou une scie" : "");
        } else {
            let actionText = `Récolter ${tileType.resource.type}`;
            createButton(actionText, 'harvest', {}, isInventoryFull, isInventoryFull ? "Inventaire plein" : "");
        }
    }
    
    const equippedWeapon = player.equipment.weapon;
    const canHunt = equippedWeapon && (equippedWeapon.type === 'weapon' || equippedWeapon.type === 'tool');
    if (tileType.name === 'Forêt' || tileType.name === 'Plaine') {
        createButton("Chasser", 'hunt', {}, !canHunt, !canHunt ? "Nécessite une arme équipée" : "");
    }
    
    const canFish = equippedWeapon && equippedWeapon.action === 'fish';
    if (tileType.name === 'Lagon' || tileType.name === 'Sable Doré') {
         createButton("Pêcher", 'fish', {}, !canFish, !canFish ? "Nécessite une canne à pêche" : "");
    }
    
    if (tileType.name === TILE_TYPES.PLAINS.name || tileType.name === TILE_TYPES.WASTELAND.name) {
        const canBuildShelterInd = State.hasResources({ 'Bois': 20 }).success;
        createButton("Abri Individuel (-20 Bois)", 'build', { structure: 'shelter_individual' }, !canBuildShelterInd, !canBuildShelterInd ? "Ressources manquantes" : "");
        const canBuildShelterCol = State.hasResources({ 'Bois': 600 }).success;
        createButton("Abri Collectif (-600 Bois)", 'build', { structure: 'shelter_collective' }, !canBuildShelterCol, !canBuildShelterCol ? "Ressources manquantes" : "");
        const canDigMine = State.hasResources({ 'Bois': 100 }).success;
        createButton("Creuser une Mine (-100 Bois)", 'dig_mine', {}, !canDigMine, !canDigMine ? "Ressources manquantes" : "");
    }
    if (tileType.name === TILE_TYPES.WASTELAND.name && tileType.regeneration) {
        const canRegenerate = State.hasResources(tileType.regeneration.cost).success;
        createButton(`Arroser (-${tileType.regeneration.cost['Eau pure']} Eau pure)`, 'regenerate_forest', {}, !canRegenerate, !canRegenerate ? "Ressources manquantes" : "");
    }
    if (tileType.name === TILE_TYPES.CAMPFIRE.name) {
        const canCook = State.hasResources({ 'Poisson cru': 1, 'Bois': 1 }).success;
        createButton("Cuisiner (-1 Poisson, -1 Bois)", 'cook', {}, !canCook, !canCook ? "Ressources manquantes" : "");
    }
    if (tileType.sleepEffect) {
        createButton("Dormir (10h)", 'sleep');
    }
    if (tileType.inventory) {
        const openChestButton = document.createElement('button');
        openChestButton.textContent = "🧰 Ouvrir le coffre";
        openChestButton.onclick = () => UI.showInventoryModal(State.state);
        UI.actionsEl.appendChild(openChestButton);
    }
}

function handleEvents() {
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
    if (Math.random() > 0.95) {
        const eventType = Math.random() < 0.5 ? 'Tempête' : 'Abondance';
        if (eventType === 'Tempête') {
            activeEvent.type = 'Tempête';
            activeEvent.duration = 1;
            UI.addChatMessage("Une tempête approche ! Il sera plus difficile de survivre.", "system");
        } else {
            const abundantResource = Math.random() < 0.5 ? 'Bois' : 'Poisson cru';
            activeEvent.type = 'Abondance';
            activeEvent.duration = 2;
            activeEvent.data = { resource: abundantResource };
            UI.addChatMessage(`Les ${abundantResource.toLowerCase()}s sont étrangement abondants !`, "system");
        }
    }
}

function gameLoop(currentTime) {
    const { player, isGameOver, combatState } = State.state;
    if (isGameOver) return;
    if (player.health <= 0) { endGame(false); return; }
    if (lastFrameTimestamp === 0) lastFrameTimestamp = currentTime;
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (!combatState) {
        if (currentTime - lastStatDecayTimestamp > CONFIG.STAT_DECAY_INTERVAL_MS) {
            const decayResult = decayStats(State.state);
            if(decayResult && decayResult.message) UI.addChatMessage(decayResult.message, 'system');
            lastStatDecayTimestamp = currentTime;
        }
        if (!player.animationState) { 
            updateNpcs(State.state, deltaTime); 
            updateEnemies(State.state, deltaTime);
        }
    }
    
    if (player.animationState) {
        const anim = player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50); 
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;
        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                State.applyPlayerMove(anim.direction);
                UI.drawMainBackground(State.state);
                anim.type = 'in';
                anim.progress = 0;
            } else {
                player.animationState = null;
                player.isBusy = false;
                fullUIUpdate();
            }
        }
    }
    UI.updateAllUI(State.state);
    UI.drawSceneCharacters(State.state);
    requestAnimationFrame(gameLoop);
}

function handleNavigation(direction) {
    const { player, map, enemies, combatState } = State.state;
    if (player.isBusy || player.animationState || combatState) return;
    const { x, y } = player;
    let newX = x, newY = y;
    if (direction === 'north') newY--;
    else if (direction === 'south') newY++;
    else if (direction === 'west') newX--;
    else if (direction === 'east') newX++;
    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
        return;
    }

    const enemyOnTile = findEnemyOnTile(newX, newY, enemies);
    if (enemyOnTile) {
        State.startCombat(player, enemyOnTile);
        UI.showCombatModal(State.state.combatState);
        return;
    }

    // Coûts de déplacement
    player.thirst = Math.max(0, player.thirst - 2);
    player.hunger = Math.max(0, player.hunger - 1);
    player.sleep = Math.max(0, player.sleep - 1);
    UI.showFloatingText('-2💧 -1🍗 -1🌙', 'cost');

    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };
    updatePossibleActions();
    UI.updateAllButtonsState(State.state);
}

function handleConsumeClick(itemOrNeed) {
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }

    let itemToConsume = itemOrNeed;

    if (itemOrNeed === 'hunger') {
        itemToConsume = player.inventory['Barre Énergétique'] ? 'Barre Énergétique' : player.inventory['Viande cuite'] ? 'Viande cuite' : player.inventory['Poisson cuit'] ? 'Poisson cuit' : null;
    } else if (itemOrNeed === 'thirst') {
        itemToConsume = player.inventory['Eau pure'] ? 'Eau pure' : null;
    } else if (itemOrNeed === 'health') {
        itemToConsume = player.inventory['Kit de Secours'] ? 'Kit de Secours' : player.inventory['Bandage'] ? 'Bandage' : player.inventory['Médicaments'] ? 'Médicaments' : null;
    }

    if (!itemToConsume) {
        UI.addChatMessage("Vous n'avez rien d'approprié à utiliser.", "system");
        return;
    }

    const result = State.consumeItem(itemToConsume);
    UI.addChatMessage(result.message, 'system');
    if(result.success) {
        UI.triggerActionFlash('gain');
        result.floatingTexts.forEach(text => { UI.showFloatingText(text, text.startsWith('+') ? 'gain' : 'cost'); });
        fullUIUpdate();
    } else {
        UI.triggerShake(document.getElementById('inventory-list'));
    }
}

function fullUIUpdate() {
    UI.updateAllUI(State.state);
    updatePossibleActions();
    UI.updateAllButtonsState(State.state);
}

function dailyUpdate() {
    if (++State.state.day > 100) {
        endGame(true);
        return;
    }
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
}

function setupEventListeners() {
    document.getElementById('nav-north').addEventListener('click', () => handleNavigation('north'));
    document.getElementById('nav-south').addEventListener('click', () => handleNavigation('south'));
    document.getElementById('nav-east').addEventListener('click', () => handleNavigation('east'));
    document.getElementById('nav-west').addEventListener('click', () => handleNavigation('west'));
    
    document.getElementById('consume-health-btn').addEventListener('click', () => handleConsumeClick('health'));
    document.getElementById('consume-thirst-btn').addEventListener('click', () => handleConsumeClick('thirst'));
    document.getElementById('consume-hunger-btn').addEventListener('click', () => handleConsumeClick('hunger'));
    
    UI.toggleChatSizeBtn.addEventListener('click', () => {
        const isEnlarged = UI.bottomBarEl.classList.toggle('chat-enlarged');
        if (isEnlarged) {
            UI.toggleChatSizeBtn.textContent = '⌄'; // Flèche vers le bas
            UI.toggleChatSizeBtn.title = "Réduire le chat";
        } else {
            UI.toggleChatSizeBtn.textContent = '⌃'; // Flèche vers le haut
            UI.toggleChatSizeBtn.title = "Agrandir le chat";
        }
    });

    const quickChatButton = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');
    quickChatButton.addEventListener('click', () => quickChatMenu.classList.toggle('visible'));
    quickChatMenu.addEventListener('click', (e) => { if (e.target.classList.contains('quick-chat-item')) { UI.addChatMessage(e.target.textContent, 'player', 'Vous'); quickChatMenu.classList.remove('visible'); } });
    document.addEventListener('click', (e) => { if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) { quickChatMenu.classList.remove('visible'); } });
    
    UI.enlargeMapBtn.addEventListener('click', () => {
        UI.largeMapModal.classList.remove('hidden');
        UI.drawLargeMap(State.state, CONFIG);
        UI.populateLargeMapLegend();
    });
    UI.closeLargeMapBtn.addEventListener('click', () => { UI.largeMapModal.classList.add('hidden'); });
    
    UI.closeInventoryModalBtn.addEventListener('click', UI.hideInventoryModal);
    UI.inventoryModal.addEventListener('click', (e) => { if (e.target.id === 'inventory-modal') UI.hideInventoryModal(); });

    document.getElementById('open-equipment-btn').addEventListener('click', () => UI.showEquipmentModal(State.state));
    UI.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);
    UI.equipmentModal.addEventListener('click', (e) => { if (e.target.id === 'equipment-modal') UI.hideEquipmentModal(); });

    let draggedItem = null;
    
    function handleDragStart(e) { if (e.target.classList.contains('inventory-item')) { draggedItem = e.target; setTimeout(() => e.target.classList.add('dragging'), 0); } }
    function handleDragEnd() { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } }
    function handleDragOver(e) { e.preventDefault(); const dropZone = e.target.closest('.droppable'); if (dropZone) { document.querySelectorAll('.droppable').forEach(el => el.classList.remove('drag-over')); dropZone.classList.add('drag-over'); } }
    function handleDragLeave(e) { const dropZone = e.target.closest('.droppable'); if (dropZone) { dropZone.classList.remove('drag-over'); } }
    
    function handleDrop(e) {
        e.preventDefault();
        const dropZone = e.target.closest('.droppable');
        document.querySelectorAll('.droppable').forEach(el => el.classList.remove('drag-over'));
        if (!dropZone || !draggedItem) return;

        const itemName = draggedItem.dataset.itemName;
        const sourceOwner = draggedItem.dataset.owner;

        if (dropZone.classList.contains('equipment-slot') && sourceOwner === 'player-inventory') {
            const itemDef = ITEM_TYPES[itemName];
            const slotType = dropZone.dataset.slotType;
            if (itemDef && itemDef.slot === slotType) {
                const result = State.equipItem(itemName);
                UI.addChatMessage(result.message, 'system');
                UI.updateEquipmentModal(State.state);
                fullUIUpdate();
            }
        }
        
        else if (dropZone.id === 'equipment-player-inventory' && sourceOwner === 'equipment') {
            const slotType = draggedItem.dataset.slotType;
            const result = State.unequipItem(slotType);
             if (!result.success) UI.triggerShake(dropZone);
            UI.addChatMessage(result.message, 'system');
            UI.updateEquipmentModal(State.state);
            fullUIUpdate();
        }
        
        else if (dropZone.dataset.owner === 'shared' || dropZone.dataset.owner === 'player') {
            const destOwner = dropZone.dataset.owner;
             if (sourceOwner !== destOwner && (sourceOwner === 'player' || sourceOwner === 'shared')) {
                const transferType = (destOwner === 'shared') ? 'deposit' : 'withdraw';
                const maxAmount = parseInt(draggedItem.dataset.itemCount, 10);
                
                UI.showQuantityModal(itemName, maxAmount, (chosenAmount) => {
                    if (chosenAmount > 0) {
                        const result = State.applyBulkInventoryTransfer(itemName, chosenAmount, transferType);
                        UI.addChatMessage(result.message, 'system');
                        if (result.success) { UI.showInventoryModal(State.state); fullUIUpdate(); } 
                        else { UI.triggerShake(draggedItem); }
                    }
                });
            }
        }
    }
    
    [UI.inventoryModal, UI.equipmentModal].forEach(modal => {
        if(modal) {
            modal.addEventListener('dragstart', handleDragStart);
            modal.addEventListener('dragend', handleDragEnd);
            modal.addEventListener('dragover', handleDragOver);
            modal.addEventListener('dragleave', handleDragLeave);
            modal.addEventListener('drop', handleDrop);
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!UI.largeMapModal.classList.contains('hidden')) UI.largeMapModal.classList.add('hidden');
            if (!UI.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            if (!UI.quantityModal.classList.contains('hidden')) UI.hideQuantityModal();
            if (!UI.equipmentModal.classList.contains('hidden')) UI.hideEquipmentModal();
        }
    });
    
    window.handleCombatAction = Interactions.handleCombatAction;
    window.gameState = State.state;
    
    UI.setupQuantityModalListeners();
}

function endGame(isVictory) {
    if (State.state.isGameOver) return;
    State.state.isGameOver = true;
    State.state.gameIntervals.forEach(clearInterval);
    if(State.state.combatState) UI.hideCombatModal();
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    document.getElementById('chat-input-field').disabled = true;
}

function fullResizeAndRedraw() {
    UI.resizeGameView();
    if (State.state.player) {
        UI.renderScene(State.state);
    }
}

async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);
        State.initializeGameState(CONFIG);
        State.state.config = CONFIG; 
        setupEventListeners();
        fullUIUpdate();
        requestAnimationFrame(gameLoop);
        State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
        State.state.gameIntervals.push(setInterval(() => npcChatter(State.state.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        console.log("Jeu initialisé avec la nouvelle structure UI.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);