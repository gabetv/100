// js/main.js
import * as UI from './ui.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES } from './config.js';
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
    
    if (combatState) {
        const combatInfo = document.createElement('div');
        combatInfo.textContent = "EN COMBAT !";
        combatInfo.style.textAlign = 'center';
        combatInfo.style.padding = '12px';
        combatInfo.style.color = 'var(--accent-color)';
        combatInfo.style.fontWeight = 'bold';
        UI.actionsEl.appendChild(combatInfo);
        return;
    }
    
    if (player.isBusy || player.animationState) {
        const busyAction = document.createElement('div');
        busyAction.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        busyAction.style.textAlign = 'center';
        busyAction.style.padding = '12px';
        UI.actionsEl.appendChild(busyAction);
        return;
    }
    
    const createButton = (text, actionId, data = {}, disabled = false, title = '') => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = disabled;
        button.title = title;
        button.onclick = () => Interactions.handlePlayerAction(actionId, data, { updateAllUI, updatePossibleActions, updateAllButtonsState });
        UI.actionsEl.appendChild(button);
    };

    if (tileType.resource && tile.harvestsLeft > 0) {
        let actionText = `Récolter ${tileType.resource.type}`;
        if (tileType.name === 'Forêt') actionText = `Couper du bois (+5 Bois, -2 Soif, -3 Faim)`;
        if (tileType.name === 'Mine') actionText = `Extraire du minerai (-1 Soif, -3 Faim)`;
        
        const isPlayerInventoryFull = getTotalResources(player.inventory) >= CONFIG.PLAYER_MAX_RESOURCES;
        const action = tileType.name === 'Mine' ? 'harvest_ore' : 'harvest';
        createButton(actionText, action, {}, isPlayerInventoryFull, isPlayerInventoryFull ? "Votre inventaire est plein !" : "");
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
        createButton("Arroser (-5 Eau)", 'regenerate_forest', {}, !canRegenerate, !canRegenerate ? "Ressources manquantes" : "");
    }
    
    if (tileType.name === TILE_TYPES.CAMPFIRE.name) {
        const canCook = State.hasResources({ 'Poisson': 1, 'Bois': 1 }).success;
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
            const abundantResource = Math.random() < 0.5 ? 'Bois' : 'Poisson';
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
                UI.draw(State.state);
                anim.type = 'in';
                anim.progress = 0;
            } else {
                player.animationState = null;
                player.isBusy = false;
                updateAllUI();
                updatePossibleActions();
                updateAllButtonsState();
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

    player.isBusy = true;
    player.animationState = { type: 'out', direction: direction, progress: 0 };
    updatePossibleActions();
    updateAllButtonsState();
}

function handleConsumeClick(itemOrNeed) {
    const { player } = State.state;
    if (player.isBusy || player.animationState) { UI.addChatMessage("Vous êtes occupé.", "system"); return; }
    const result = State.consumeItem(itemOrNeed);
    UI.addChatMessage(result.message, 'system');
    if(result.success) {
        UI.triggerActionFlash('gain');
        result.floatingTexts.forEach(text => { UI.showFloatingText(text, text.startsWith('-') ? 'cost' : 'gain'); });
        updateAllUI(); updatePossibleActions(); updateAllButtonsState();
    } else {
        UI.triggerShake(document.getElementById('inventory-list'));
    }
}

function updateAllUI() { UI.updateAllUI(State.state); }
function updateAllButtonsState() { UI.updateAllButtonsState(State.state); }

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
    UI.closeLargeMapBtn.addEventListener('click', () => { 
        UI.largeMapModal.classList.add('hidden'); 
    });
    
    UI.closeInventoryModalBtn.addEventListener('click', UI.hideInventoryModal);
    UI.inventoryModal.addEventListener('click', (e) => { if (e.target.id === 'inventory-modal') UI.hideInventoryModal(); });

    let draggedItem = null;
    UI.inventoryModal.addEventListener('dragstart', (e) => { if (e.target.classList.contains('inventory-item')) { draggedItem = e.target; setTimeout(() => e.target.classList.add('dragging'), 0); } });
    UI.inventoryModal.addEventListener('dragend', () => { if (draggedItem) { draggedItem.classList.remove('dragging'); draggedItem = null; } });
    const modalGrid = document.getElementById('inventory-modal-grid');
    modalGrid.addEventListener('dragover', (e) => { e.preventDefault(); const dropZone = e.target.closest('.droppable'); if (dropZone) { document.querySelectorAll('.droppable').forEach(el => el.classList.remove('drag-over')); dropZone.classList.add('drag-over'); } });
    modalGrid.addEventListener('dragleave', (e) => { const dropZone = e.target.closest('.droppable'); if (dropZone) { dropZone.classList.remove('drag-over'); } });
    
    modalGrid.addEventListener('drop', (e) => {
        e.preventDefault();
        const dropZone = e.target.closest('.droppable');
        document.querySelectorAll('.droppable').forEach(el => el.classList.remove('drag-over'));
        if (dropZone && draggedItem) {
            const sourceOwner = draggedItem.dataset.owner;
            const destOwner = dropZone.dataset.owner;
            const itemName = draggedItem.dataset.itemName;
            const maxAmount = parseInt(draggedItem.dataset.itemCount, 10);
            
            if (sourceOwner !== destOwner) {
                const transferType = (destOwner === 'shared') ? 'deposit' : 'withdraw';
                
                if (e.shiftKey) {
                    const result = State.applyBulkInventoryTransfer(itemName, maxAmount, transferType);
                    UI.addChatMessage(result.message, 'system');
                    if (result.success) { UI.showInventoryModal(State.state); updateAllUI(); } 
                    else { UI.triggerShake(draggedItem); }
                } else {
                    UI.showQuantityModal(itemName, maxAmount, (chosenAmount) => {
                        if (chosenAmount > 0) {
                            const result = State.applyBulkInventoryTransfer(itemName, chosenAmount, transferType);
                            UI.addChatMessage(result.message, 'system');
                            if (result.success) { UI.showInventoryModal(State.state); updateAllUI(); } 
                            else { UI.triggerShake(draggedItem); }
                        }
                    });
                }
            }
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!UI.largeMapModal.classList.contains('hidden')) UI.largeMapModal.classList.add('hidden');
            if (!UI.inventoryModal.classList.contains('hidden')) UI.hideInventoryModal();
            if (!UI.quantityModal.classList.contains('hidden')) UI.hideQuantityModal();
        }
    });
    
    window.handleCombatAction = Interactions.handleCombatAction;
    window.gameState = State.state;
}

function endGame(isVictory) {
    if (State.state.isGameOver) return;
    State.state.isGameOver = true;
    State.state.gameIntervals.forEach(clearInterval);
    if(State.state.combatState) {
        UI.hideCombatModal();
    }
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    document.getElementById('chat-input-field').disabled = true;
}

function fullResizeAndRedraw() {
    UI.resizeGameView();
    if (State.state.player) UI.draw(State.state);
}

async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);
        State.initializeGameState(CONFIG);
        setupEventListeners();
        updateAllUI();
        updatePossibleActions();
        requestAnimationFrame(gameLoop);
        State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
        State.state.gameIntervals.push(setInterval(() => npcChatter(State.state.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        console.log("Jeu initialisé avec le système d'apparition d'ennemis.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);