// js/main.js
import * as UI from './ui.js';
import { CONFIG, ACTION_DURATIONS, SPRITESHEET_PATHS } from './config.js';
import { generateMap } from './map.js';
import { initPlayer, movePlayer, decayStats, updatePossibleActions, consumeItem, sleep } from './player.js';
import { initNpcs, updateNpcs, npcChatter } from './npc.js';

const gameState = { map: [], player: null, npcs: [], day: 1, gameIntervals: [] };
let lastFrameTimestamp = 0;

function gameLoop(currentTime) {
    if (gameState.isGameOver) return;

    if (gameState.player.health <= 0) {
        endGame(false);
        return;
    }

    if (lastFrameTimestamp === 0) {
        lastFrameTimestamp = currentTime;
    }
    const deltaTime = currentTime - lastFrameTimestamp;
    lastFrameTimestamp = currentTime;

    if (!gameState.player.animationState) {
        updateNpcs(gameState.npcs, gameState.map, CONFIG, deltaTime);
    }
    
    if (gameState.player.animationState) {
        const anim = gameState.player.animationState;
        const safeDeltaTime = Math.min(deltaTime, 50);
        anim.progress += safeDeltaTime / ACTION_DURATIONS.MOVE_TRANSITION;
        
        if (anim.progress >= 1) {
            if (anim.type === 'out') {
                movePlayer(anim.direction, gameState.player, gameState.map, CONFIG);
                UI.draw(gameState);
                anim.type = 'in';
                anim.progress = 0;
            } else {
                gameState.player.animationState = null;
                gameState.player.isBusy = false;
                updatePossibleActions(gameState);
                UI.updateAllButtonsState(gameState);
            }
        }
    }

    UI.updateAllUI(gameState, CONFIG);
    UI.drawSceneCharacters(gameState);
    
    requestAnimationFrame(gameLoop);
}

function handleNavigation(direction) {
    if (gameState.player.isBusy || gameState.player.animationState) return;
    const { x, y } = gameState.player;
    let newX = x, newY = y;
    if (direction === 'north') newY--; else if (direction === 'south') newY++;
    else if (direction === 'west') newX--; else if (direction === 'east') newX++;
    if (newX < 0 || newX >= CONFIG.MAP_WIDTH || newY < 0 || newY >= CONFIG.MAP_HEIGHT || !gameState.map[newY][newX].type.accessible) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
        return;
    }
    gameState.player.isBusy = true;
    gameState.player.animationState = { type: 'out', direction: direction, progress: 0 };
    updatePossibleActions(gameState);
    UI.updateAllButtonsState(gameState);
}

function dailyUpdate() { if (++gameState.day > 100) endGame(true); }

// SUPPRIMÉ : handleInventoryClick n'est plus nécessaire car on ne clique plus sur l'inventaire.

function handleSendChat() { const message = UI.chatInputEl.value.trim(); if (message) { UI.addChatMessage(message, 'player', 'Vous'); UI.chatInputEl.value = ''; } }

function setupEventListeners() {
    const addSafeClickListener = (element, callback) => { ['mousedown', 'touchstart'].forEach(eventType => { element.addEventListener(eventType, (e) => { e.preventDefault(); e.stopPropagation(); if (element.disabled) return; callback(e); }); }); };
    
    // Navigation
    addSafeClickListener(document.getElementById('nav-north'), () => handleNavigation('north')); 
    addSafeClickListener(document.getElementById('nav-south'), () => handleNavigation('south')); 
    addSafeClickListener(document.getElementById('nav-east'), () => handleNavigation('east')); 
    addSafeClickListener(document.getElementById('nav-west'), () => handleNavigation('west'));
    
    // MODIFIÉ : Ajout des listeners pour les boutons de consommation rapide
    addSafeClickListener(document.getElementById('consume-health-btn'), () => consumeItem('health', gameState.player, gameState, CONFIG));
    addSafeClickListener(document.getElementById('consume-thirst-btn'), () => consumeItem('thirst', gameState.player, gameState, CONFIG));
    addSafeClickListener(document.getElementById('consume-hunger-btn'), () => consumeItem('hunger', gameState.player, gameState, CONFIG));
    
    // Chat
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
    const quickChatButton = document.getElementById('quick-chat-button'); 
    const quickChatMenu = document.getElementById('quick-chat-menu'); 
    addSafeClickListener(quickChatButton, () => { quickChatMenu.classList.toggle('visible'); }); 
    quickChatMenu.addEventListener('click', (e) => { if (e.target.classList.contains('quick-chat-item')) { UI.addChatMessage(e.target.textContent, 'player', 'Vous'); quickChatMenu.classList.remove('visible'); } }); 
    addSafeClickListener(document.documentElement, (e) => { if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) { quickChatMenu.classList.remove('visible'); } });

    // Grande carte
    addSafeClickListener(UI.enlargeMapBtn, () => {
        UI.drawLargeMap(gameState, CONFIG);
        UI.largeMapModal.classList.remove('hidden');
    });
    addSafeClickListener(UI.closeLargeMapBtn, () => {
        UI.largeMapModal.classList.add('hidden');
    });
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !UI.largeMapModal.classList.contains('hidden')) {
            UI.largeMapModal.classList.add('hidden');
        }
    });
}

function endGame(isVictory) {
    if (gameState.isGameOver) return;
    gameState.isGameOver = true;
    gameState.gameIntervals.forEach(clearInterval);
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    document.getElementById('chat-input-field').disabled = true;
}

function fullResizeAndRedraw() {
    UI.resizeGameView();
    if (gameState.player) {
        UI.draw(gameState);
    }
}

async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        
        fullResizeAndRedraw();
        window.addEventListener('resize', fullResizeAndRedraw);
        
        gameState.map = generateMap(CONFIG);
        gameState.player = initPlayer(CONFIG);
        gameState.npcs = initNpcs(CONFIG, gameState.map);
        
        setupEventListeners();
        
        UI.updateAllUI(gameState, CONFIG);
        updatePossibleActions(gameState);
        
        const intervals = [ 
            setInterval(() => decayStats(gameState.player), CONFIG.STAT_DECAY_INTERVAL_MS), 
            setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS), 
            setInterval(() => npcChatter(gameState.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS) 
        ];
        gameState.gameIntervals.push(...intervals);
        
        requestAnimationFrame(gameLoop);
        
        console.log("Jeu initialisé. Consommation via les boutons de stat activée.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);