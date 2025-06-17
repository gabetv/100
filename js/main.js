// js/main.js
import * as UI from './ui.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS, TILE_TYPES } from './config.js';
// NOUVEAU : On importe le module de gestion d'état
import * as State from './state.js';
import { movePlayer, decayStats, getTotalResources } from './player.js';
import { updateNpcs, npcChatter } from './npc.js';
import * as Interactions from './interactions.js';

// Plus de `gameState` local ! On utilisera `State.state` partout.
let lastFrameTimestamp = 0;
let lastStatDecayTimestamp = 0;

function updatePossibleActions() {
    UI.actionsEl.innerHTML = '';
    const { player, map } = State.state; // On lit l'état depuis le module
    const tile = map[player.y][player.x];
    
    if (player.isBusy || player.animationState) {
        const busyAction = document.createElement('div');
        busyAction.textContent = player.animationState ? "Déplacement..." : "Action en cours...";
        busyAction.style.textAlign = 'center'; busyAction.style.padding = '12px';
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

    if (tile.type.resource && tile.harvestsLeft > 0) {
        let { type } = tile.type.resource;
        let actionText = `Récolter ${type}`;
        if (type === 'Eau') actionText = `Puiser`; else if (type === 'Poisson') actionText = `Pêcher`;
        else if (type === 'Pierre') actionText = `Miner`; else if (type === 'Bois') actionText = `Couper du bois`;
        
        const isPlayerInventoryFull = getTotalResources(player.inventory) >= CONFIG.PLAYER_MAX_RESOURCES;
        createButton(actionText, 'harvest', {}, isPlayerInventoryFull, isPlayerInventoryFull ? "Votre inventaire est plein !" : "");
    }
    
    const currentTileType = tile.type.name;
    if (currentTileType === TILE_TYPES.PLAINS.name || currentTileType === TILE_TYPES.WASTELAND.name) {
        // On utilise la fonction de vérification de State
        const canBuildShelter = State.hasResources({ 'Bois': 20, 'Pierre': 10 }).success;
        createButton("Abri (-20 Bois, -10 Pierre)", 'build', { structure: 'shelter' }, !canBuildShelter, !canBuildShelter ? "Ressources manquantes" : "");
        const canBuildCampfire = State.hasResources({ 'Bois': 10, 'Pierre': 5 }).success;
        createButton("Feu (-10 Bois, -5 Pierre)", 'build', { structure: 'campfire' }, !canBuildCampfire, !canBuildCampfire ? "Ressources manquantes" : "");
    }
    if (currentTileType === TILE_TYPES.CAMPFIRE.name) {
        const canCook = State.hasResources({ 'Poisson': 1, 'Bois': 1 }).success;
        createButton("Cuisiner (-1 Poisson, -1 Bois)", 'cook', {}, !canCook, !canCook ? "Ressources manquantes" : "");
    }
    if (currentTileType === TILE_TYPES.SHELTER_INDIVIDUAL.name || currentTileType === TILE_TYPES.SHELTER_COLLECTIVE.name) {
        createButton("Dormir", 'sleep');
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
    const { player, isGameOver } = State.state;
    if (isGameOver) return;
    if (player.health <= 0) { endGame(false); return; }
    
    if (lastFrameTimestamp === 0) lastFrameTimestamp = currentTime;
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (currentTime - lastStatDecayTimestamp > CONFIG.STAT_DECAY_INTERVAL_MS) {
        const decayResult = decayStats(State.state);
        if(decayResult && decayResult.message) UI.addChatMessage(decayResult.message, 'system');
        lastStatDecayTimestamp = currentTime;
    }
    
    if (!player.animationState) { updateNpcs(State.state, deltaTime); }

    if (player.animationState) {
        const anim = player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50);
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;
        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                // On demande une modification de l'état
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
    const { player, map } = State.state;
    if (player.isBusy || player.animationState) return;
    
    const { x, y } = player;
    let newX = x, newY = y;
    if (direction === 'north') newY--; else if (direction === 'south') newY++;
    else if (direction === 'west') newX--; else if (direction === 'east') newX++;
    
    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
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
        updateAllUI();
        updatePossibleActions();
        updateAllButtonsState();
    } else {
        UI.triggerShake(document.getElementById('inventory-list'));
    }
}

function updateAllUI() { UI.updateAllUI(State.state); }
function updateAllButtonsState() { UI.updateAllButtonsState(State.state); }

function dailyUpdate() { 
    if (++State.state.day > 100) endGame(true);
    handleEvents(); 
}

function handleSendChat() {
    const message = UI.chatInputEl.value.trim();
    if (message) {
        UI.addChatMessage(message, 'player', 'Vous');
        UI.chatInputEl.value = '';
    }
}

function setupEventListeners() {
    const addSafeClickListener = (element, callback) => { ['mousedown', 'touchstart'].forEach(eventType => { element.addEventListener(eventType, (e) => { e.preventDefault(); e.stopPropagation(); if (element.disabled) return; callback(e); }); }); };
    
    addSafeClickListener(document.getElementById('nav-north'), () => handleNavigation('north'));
    addSafeClickListener(document.getElementById('nav-south'), () => handleNavigation('south'));
    addSafeClickListener(document.getElementById('nav-east'), () => handleNavigation('east'));
    addSafeClickListener(document.getElementById('nav-west'), () => handleNavigation('west'));
    
    addSafeClickListener(document.getElementById('consume-health-btn'), () => handleConsumeClick('health'));
    addSafeClickListener(document.getElementById('consume-thirst-btn'), () => handleConsumeClick('thirst'));
    addSafeClickListener(document.getElementById('consume-hunger-btn'), () => handleConsumeClick('hunger'));
    
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
    // ... autres listeners ...
    const quickChatButton = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');
    addSafeClickListener(quickChatButton, () => { quickChatMenu.classList.toggle('visible'); });
    quickChatMenu.addEventListener('click', (e) => { if (e.target.classList.contains('quick-chat-item')) { UI.addChatMessage(e.target.textContent, 'player', 'Vous'); quickChatMenu.classList.remove('visible'); } });
    addSafeClickListener(document.documentElement, (e) => { if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) { quickChatMenu.classList.remove('visible'); } });
    
    addSafeClickListener(UI.enlargeMapBtn, () => { UI.drawLargeMap(State.state, CONFIG); UI.largeMapModal.classList.remove('hidden'); });
    addSafeClickListener(UI.closeLargeMapBtn, () => { UI.largeMapModal.classList.add('hidden'); });
    
    // ** LA LOGIQUE DE CLIC AVEC DÉBOGAGE AMÉLIORÉ **
    document.getElementById('shared-inventory-section').addEventListener('click', (e) => {
        console.log("%c--- Clic détecté sur la section de stockage ---", "color: yellow; font-weight: bold;");
        
        const { player } = State.state;
        if (player.isBusy || player.animationState) {
            console.log("DEBUG: Action bloquée car le joueur est occupé.", player);
            UI.addChatMessage("Vous êtes occupé.", "system");
            return;
        }
        console.log("DEBUG: Le joueur n'est pas occupé, on continue.");

        const targetButton = e.target.closest('button');
        console.log("DEBUG: Élément cliqué (e.target):", e.target);
        console.log("DEBUG: Bouton le plus proche trouvé (targetButton):", targetButton);

        if (!targetButton) {
            console.log("DEBUG: Le clic n'était pas sur un bouton ou un de ses enfants. Action ignorée.");
            return;
        }

        if (targetButton.disabled) {
            console.log("DEBUG: Le bouton est désactivé. Action ignorée.");
            UI.addChatMessage("Cette action n'est pas possible.", "system");
            return;
        }
        
        const itemName = targetButton.dataset.itemName;
        const transferType = targetButton.classList.contains('deposit-btn') ? 'deposit' : 'withdraw';
        
        console.log(`%cDEBUG: Préparation de l'action: Type='${transferType}', Objet='${itemName}'`, "color: cyan;");

        // On appelle la logique de l'état
        const result = State.applyInventoryTransfer(itemName, transferType);

        console.log(`%cDEBUG: Résultat de l'action:`, "color: orange;", result);

        UI.addChatMessage(result.message, 'system');
        if (result.success) {
            UI.triggerActionFlash('gain');
        } else {
            UI.triggerShake(targetButton);
        }

        // Toujours rafraîchir pour garantir la synchronisation
        console.log("DEBUG: Mise à jour de toute l'interface utilisateur.");
        updateAllUI();
        updatePossibleActions();
    });

    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !UI.largeMapModal.classList.contains('hidden')) { UI.largeMapModal.classList.add('hidden'); } });
}

function endGame(isVictory) {
    if (State.state.isGameOver) return;
    State.state.isGameOver = true;
    State.state.gameIntervals.forEach(clearInterval);
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    document.getElementById('chat-input-field').disabled = true;
}

function fullResizeAndRedraw() { 
    UI.resizeGameView();
    if (State.state.player) {
        UI.draw(State.state);
    } 
}

async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);
        
        // On utilise notre nouvelle fonction d'initialisation
        State.initializeGameState(CONFIG);

        setupEventListeners();
        updateAllUI();
        updatePossibleActions();
        
        requestAnimationFrame(gameLoop);
        
        State.state.gameIntervals.push(setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS));
        State.state.gameIntervals.push(setInterval(() => npcChatter(State.state.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS));
        
        console.log("Jeu initialisé avec un gestionnaire d'état centralisé.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);