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
let draggedItemInfo = null;

function updatePossibleActions() {
    const { player, map, combatState } = State.state;
    const tile = map[player.y][player.x];
    const tileType = tile.type;
    
    window.DOM.actionsEl.innerHTML = '';
    
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
        window.DOM.actionsEl.appendChild(statusDiv);
        return;
    }
    
    const createButton = (text, actionId, data = {}, disabled = false, title = '') => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = () => Interactions.handlePlayerAction(actionId, data, { updateAllUI: fullUIUpdate, updatePossibleActions, updateAllButtonsState: () => UI.updateAllButtonsState(State.state) });
        window.DOM.actionsEl.appendChild(button);
    };

    if (tileType.resource && tile.harvestsLeft > 0) {
        const isInventoryFull = getTotalResources(player.inventory) >= player.maxInventory;
        const tool = player.equipment.weapon;

        if (tileType.name === 'Forêt') {
            const canCutWood = tool && tool.action === 'harvest_wood';
            createButton(`Couper du bois`, 'harvest_wood', {}, isInventoryFull || !canCutWood, isInventoryFull ? "Inventaire plein" : !canCutWood ? "Nécessite une hache ou une scie" : "");
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
        window.DOM.actionsEl.appendChild(openChestButton);
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
    if (!player || player.health <= 0) {
        if (!isGameOver) endGame(false);
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
    UI.updateAllUI(State.state);
    UI.renderScene(State.state);
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

    const statsToReduce = ['thirst', 'hunger', 'sleep'];
    const icons = { thirst: '💧', hunger: '🍗', sleep: '🌙' };
    const chosenStat = statsToReduce[Math.floor(Math.random() * statsToReduce.length)];
    player[chosenStat] = Math.max(0, player[chosenStat] - 1);
    UI.showFloatingText(`-1${icons[chosenStat]}`, 'cost');

    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };
    updatePossibleActions();
    UI.updateAllButtonsState(State.state);
}

function handleConsumeClick(itemName) {
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }
    
    const itemDef = ITEM_TYPES[itemName];
    if (!itemDef || itemDef.type !== 'consumable') return;

    const result = State.consumeItem(itemName);
    UI.addChatMessage(result.message, 'system');
    if(result.success) {
        UI.triggerActionFlash('gain');
        if (result.floatingTexts && result.floatingTexts.length > 0) {
            result.floatingTexts.forEach(text => { 
                const type = text.startsWith('+') ? 'gain' : 'cost';
                UI.showFloatingText(text, type); 
            });
        }
        fullUIUpdate();
    } else {
        UI.triggerShake(document.getElementById('inventory-categories'));
    }
}

function fullUIUpdate() {
    UI.updateAllUI(State.state);
    updatePossibleActions();
    if (!window.DOM.equipmentModal.classList.contains('hidden')) {
        UI.updateEquipmentModal(State.state);
    }
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
    window.DOM.openEquipmentBtn.addEventListener('click', () => UI.showEquipmentModal(State.state));
    window.DOM.closeEquipmentModalBtn.addEventListener('click', UI.hideEquipmentModal);

    window.DOM.inventoryCategoriesEl.addEventListener('click', e => {
        const itemEl = e.target.closest('.inventory-item.clickable');
        if (itemEl) {
            handleConsumeClick(itemEl.dataset.itemName);
        } else {
            const header = e.target.closest('.category-header');
            if (header) {
                header.classList.toggle('open');
                header.nextElementSibling.classList.toggle('visible');
            }
        }
    });

    const equipmentModal = window.DOM.equipmentModal;
    equipmentModal.addEventListener('dragstart', e => {
        const itemEl = e.target.closest('.inventory-item[draggable="true"]');
        if (!itemEl) return;
        const owner = itemEl.closest('[data-owner]').dataset.owner;
        draggedItemInfo = { element: itemEl, itemName: itemEl.dataset.itemName, sourceOwner: owner, sourceSlotType: owner === 'equipment' ? itemEl.dataset.slotType : null };
        setTimeout(() => itemEl.classList.add('dragging'), 0);
    });
    equipmentModal.addEventListener('dragover', e => { e.preventDefault(); const dropZone = e.target.closest('.droppable'); if (dropZone) dropZone.classList.add('drag-over'); });
    equipmentModal.addEventListener('dragleave', e => { const dropZone = e.target.closest('.droppable'); if (dropZone) dropZone.classList.remove('drag-over'); });
    equipmentModal.addEventListener('dragend', () => { if (draggedItemInfo && draggedItemInfo.element) draggedItemInfo.element.classList.remove('dragging'); draggedItemInfo = null; document.querySelectorAll('.droppable.drag-over').forEach(el => el.classList.remove('drag-over')); });
    equipmentModal.addEventListener('drop', e => {
        e.preventDefault();
        const dropZone = e.target.closest('.droppable');
        if (!draggedItemInfo || !dropZone) return;
        const destOwner = dropZone.dataset.owner;
        const destSlotType = dropZone.dataset.slotType;
        const itemDef = ITEM_TYPES[draggedItemInfo.itemName];
        if (draggedItemInfo.sourceOwner === 'player-inventory' && destOwner === 'equipment') {
            if (itemDef && itemDef.slot === destSlotType) {
                State.equipItem(draggedItemInfo.itemName);
            } else {
                UI.addChatMessage("Objet non compatible.", "system");
                UI.triggerShake(dropZone);
            }
        } 
        else if (draggedItemInfo.sourceOwner === 'equipment' && destOwner === 'player-inventory') {
            State.unequipItem(draggedItemInfo.sourceSlotType);
        }
        fullUIUpdate();
    });

    window.addEventListener('keydown', e => { if (e.key === 'Escape') UI.hideEquipmentModal(); });
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

function fullResizeAndRedraw() { UI.resizeGameView(); if (State.state.player) UI.renderScene(State.state); }

async function init() {
    try {
        UI.initDOM();
        await UI.loadAssets(SPRITESHEET_PATHS);
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);
        State.initializeGameState(CONFIG);
        State.state.config = CONFIG;
        setupEventListeners();
        UI.updateAllUI(State.state);
        requestAnimationFrame(gameLoop);
        State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
        State.state.gameIntervals.push(setInterval(() => npcChatter(State.state.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        console.log("Jeu initialisé avec la méthode DOM globale.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);