// js/main.js
import * as UI from './ui.js';
import { CONFIG, SPRITESHEET_PATHS } from './config.js';
import { generateMap } from './map.js';
import { initPlayer, movePlayer, decayStats, updatePossibleActions, consumeItem } from './player.js';
import { initNpcs, updateNpcs, npcChatter } from './npc.js';

const gameState = { map: [], player: null, npcs: [], day: 1, gameIntervals: [] };

function gameLoop() { if (gameState.player.health <= 0) return endGame(false); }
function render() { UI.draw(gameState); UI.updateAllUI(gameState, CONFIG); updatePossibleActions(gameState); }
function dailyUpdate() { if (++gameState.day > 100) endGame(true); render(); }
function handleNavigation(direction) { if (movePlayer(direction, gameState.player, gameState.map, CONFIG)) { render(); } else { UI.addChatMessage("Vous ne pouvez pas aller dans cette direction.", "system"); } }
function handleInventoryClick(e) { const itemElement = e.target.closest('.inventory-item'); if (itemElement) { const itemName = itemElement.dataset.itemName; consumeItem(itemName, gameState.player, gameState, CONFIG); } }
function handleSendChat() { const message = UI.chatInputEl.value.trim(); if (message) { UI.addChatMessage(message, 'player', 'Vous'); UI.chatInputEl.value = ''; } }

function setupEventListeners() {
    document.getElementById('nav-north').addEventListener('click', () => handleNavigation('north'));
    document.getElementById('nav-south').addEventListener('click', () => handleNavigation('south'));
    document.getElementById('nav-east').addEventListener('click', () => handleNavigation('east'));
    document.getElementById('nav-west').addEventListener('click', () => handleNavigation('west'));
    
    document.getElementById('inventory-list').addEventListener('click', handleInventoryClick);
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });

    // --- NOUVELLE LOGIQUE POUR LE MENU DE CHAT RAPIDE ---
    const quickChatButton = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');

    quickChatButton.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêche le clic de se propager au document
        quickChatMenu.classList.toggle('visible');
    });

    quickChatMenu.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-chat-item')) {
            UI.addChatMessage(e.target.textContent, 'player', 'Vous');
            quickChatMenu.classList.remove('visible');
        }
    });

    // Ferme le menu si on clique n'importe où ailleurs
    document.addEventListener('click', (e) => {
        if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) {
            quickChatMenu.classList.remove('visible');
        }
    });
}

function endGame(isVictory) { /* ... inchangé ... */ }
async function init() {
    try {
        await UI.loadAssets(SPRITESHEET_PATHS);
        const viewContainer = document.getElementById('main-view-container');
        UI.mainViewCanvas.width = viewContainer.clientWidth;
        UI.mainViewCanvas.height = viewContainer.clientHeight;
        gameState.map = generateMap(CONFIG); gameState.player = initPlayer(CONFIG); gameState.npcs = initNpcs(CONFIG, gameState.map);
        setupEventListeners();
        const intervals = [setInterval(gameLoop, 50), setInterval(() => { decayStats(gameState.player); render(); }, CONFIG.STAT_DECAY_INTERVAL_MS), setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS)];
        gameState.gameIntervals.push(...intervals);
        render();
        console.log("Jeu initialisé avec le menu de chat rapide.");
    } catch (error) { console.error("ERREUR CRITIQUE lors de l'initialisation :", error); }
}

window.addEventListener('load', init);
// Corps de endGame pour être complet
endGame = function(isVictory) { gameState.gameIntervals.forEach(clearInterval); /* ... */ }