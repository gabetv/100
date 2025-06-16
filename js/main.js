// js/main.js
import * as UI from './ui.js';
import { CONFIG, SPRITESHEET_PATHS } from './config.js';
import { generateMap } from './map.js';
import { initPlayer, movePlayer, decayStats, updatePossibleActions, consumeItem } from './player.js';
import { initNpcs, updateNpcs, npcChatter } from './npc.js';

const gameState = { map: [], player: null, npcs: [], day: 1, gameIntervals: [] };

function gameLoop() {
    if (gameState.player.health <= 0) {
        endGame(false);
        return;
    }
    updateNpcs(gameState.npcs, gameState.map, CONFIG);
    render();
}

function render() {
    UI.draw(gameState);
    UI.updateAllUI(gameState, CONFIG);
    updatePossibleActions(gameState);
}

function dailyUpdate() {
    if (++gameState.day > 100) endGame(true);
}

function handleNavigation(direction) {
    if (!movePlayer(direction, gameState.player, gameState.map, CONFIG)) {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
    }
}

function handleInventoryClick(e) {
    const itemElement = e.target.closest('.inventory-item');
    if (itemElement) {
        const itemName = itemElement.dataset.itemName;
        consumeItem(itemName, gameState.player, gameState, CONFIG);
    }
}

function handleSendChat() {
    const message = UI.chatInputEl.value.trim();
    if (message) {
        UI.addChatMessage(message, 'player', 'Vous');
        UI.chatInputEl.value = '';
    }
}

function setupEventListeners() {
    document.getElementById('nav-north').addEventListener('click', () => handleNavigation('north'));
    document.getElementById('nav-south').addEventListener('click', () => handleNavigation('south'));
    document.getElementById('nav-east').addEventListener('click', () => handleNavigation('east'));
    document.getElementById('nav-west').addEventListener('click', () => handleNavigation('west'));
    
    document.getElementById('inventory-list').addEventListener('click', handleInventoryClick);
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
    
    const quickChatButton = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');

    quickChatButton.addEventListener('click', (e) => {
        e.stopPropagation();
        quickChatMenu.classList.toggle('visible');
    });

    quickChatMenu.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-chat-item')) {
            UI.addChatMessage(e.target.textContent, 'player', 'Vous');
            quickChatMenu.classList.remove('visible');
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) {
            quickChatMenu.classList.remove('visible');
        }
    });
}

function endGame(isVictory) { 
    gameState.gameIntervals.forEach(clearInterval);
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
}

async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        const viewContainer = document.getElementById('main-view-container');
        UI.mainViewCanvas.width = viewContainer.clientWidth;
        UI.mainViewCanvas.height = viewContainer.clientHeight;
        
        gameState.map = generateMap(CONFIG);
        gameState.player = initPlayer(CONFIG);
        gameState.npcs = initNpcs(CONFIG, gameState.map);
        
        setupEventListeners();

        const gameLoopInterval = setInterval(gameLoop, 100);
        const statDecayInterval = setInterval(() => { decayStats(gameState.player); }, CONFIG.STAT_DECAY_INTERVAL_MS);
        const dailyUpdateInterval = setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS);
        const chatterInterval = setInterval(() => npcChatter(gameState.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS);

        gameState.gameIntervals.push(gameLoopInterval, statDecayInterval, dailyUpdateInterval, chatterInterval);
        
        UI.draw(gameState); // Premier rendu
        console.log("Jeu initialisé avec la nouvelle interface et la boucle de rendu principale.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);