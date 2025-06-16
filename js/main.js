// js/main.js
import * as UI from './ui.js';
import { CONFIG, SPRITESHEET_PATHS } from './config.js';
import { generateMap } from './map.js';
import { initPlayer, movePlayer, decayStats, updatePossibleActions, consumeItem } from './player.js';
import { initNpcs, updateNpcs, npcChatter } from './npc.js';

const gameState = { map: [], player: null, npcs: [], day: 1, gameIntervals: [] };

function gameLoop() {
    if (gameState.player.health <= 0) return endGame(false);
    // Le jeu tourne, mais l'affichage n'est mis à jour que lorsque c'est nécessaire
}
function render() {
    UI.draw(gameState, CONFIG);
    UI.updateAllUI(gameState, CONFIG);
    updatePossibleActions(gameState);
}

function dailyUpdate() { if (++gameState.day > 100) endGame(true); render(); }
function handleNavigation(direction) {
    if (movePlayer(direction, gameState.player, gameState.map, CONFIG)) {
        console.log(`Déplacement vers ${direction}. Nouvelle position : ${gameState.player.x}, ${gameState.player.y}`);
        render(); // On met à jour l'affichage après un déplacement réussi
    } else {
        UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system");
    }
}
function handleInventoryClick(e) { const itemElement = e.target.closest('.inventory-item'); if (itemElement) { const itemName = itemElement.dataset.itemName; consumeItem(itemName, gameState.player, gameState, CONFIG); } }
function handleSendChat() { const message = UI.chatInputEl.value.trim(); if (message) { UI.addChatMessage(message, 'player', 'Vous'); UI.chatInputEl.value = ''; } }

function setupEventListeners() {
    // Écouteurs pour les boutons de navigation
    document.getElementById('nav-north').addEventListener('click', () => handleNavigation('north'));
    document.getElementById('nav-south').addEventListener('click', () => handleNavigation('south'));
    document.getElementById('nav-east').addEventListener('click', () => handleNavigation('east'));
    document.getElementById('nav-west').addEventListener('click', () => handleNavigation('west'));
    
    document.getElementById('inventory-list').addEventListener('click', handleInventoryClick);
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
}

function endGame(isVictory) { /* ... inchangé ... */ }
async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        // On ajuste la taille du canvas de la vue principale
        const viewContainer = document.getElementById('main-view-container');
        UI.mainViewCanvas.width = viewContainer.clientWidth;
        UI.mainViewCanvas.height = viewContainer.clientHeight;

        gameState.map = generateMap(CONFIG);
        gameState.player = initPlayer(CONFIG);
        gameState.npcs = initNpcs(CONFIG, gameState.map);
        setupEventListeners();
        
        const intervals = [setInterval(gameLoop, 50), setInterval(() => decayStats(gameState.player), CONFIG.STAT_DECAY_INTERVAL_MS), setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS)];
        gameState.gameIntervals.push(...intervals);
        
        render(); // Premier rendu du jeu
        console.log("Jeu initialisé avec le nouveau mode de vue.");
    } catch (error) { console.error("ERREUR CRITIQUE lors de l'initialisation :", error); }
}
window.addEventListener('load', init);
// Corps de endGame pour être complet
endGame = function(isVictory) { gameState.gameIntervals.forEach(clearInterval); /* ... le reste est inchangé ... */ }