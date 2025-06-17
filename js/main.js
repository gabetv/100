// js/main.js
import * as UI from './ui.js';
import { CONFIG, SPRITESHEET_PATHS } from './config.js';
import { generateMap } from './map.js';
import { initPlayer, movePlayer, decayStats, updatePossibleActions, consumeItem, sleep } from './player.js';
import { initNpcs, updateNpcs, npcChatter } from './npc.js';

const gameState = { map: [], player: null, npcs: [], day: 1, gameIntervals: [] };

function gameLoop() {
    if (gameState.player.health <= 0) {
        endGame(false);
        return;
    }
    updateNpcs(gameState.npcs, gameState.map, CONFIG);
    // La boucle de rendu est maintenant plus simple
    render();
}

/**
 * CORRIGÉ : La fonction render ne met plus à jour la liste des actions.
 * Elle se concentre sur le dessin et l'état des stats/boutons.
 */
function render() {
    UI.draw(gameState);
    UI.updateAllUI(gameState, CONFIG); // Met à jour minimap, stats, etc.
    UI.updateAllButtonsState(gameState); // Met à jour l'état activé/désactivé des boutons
}

function dailyUpdate() {
    if (++gameState.day > 100) endGame(true);
}

/**
 * CORRIGÉ : On met à jour la liste des actions seulement après un déplacement réussi.
 */
function handleNavigation(direction) {
    if (gameState.player.isBusy) return;
    const moved = movePlayer(direction, gameState.player, gameState.map, CONFIG);
    if (moved) {
        // Le joueur a bougé, on met à jour la liste des actions possibles.
        updatePossibleActions(gameState);
    } else {
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
    const addSafeClickListener = (element, callback) => {
        ['mousedown', 'touchstart'].forEach(eventType => {
            element.addEventListener(eventType, (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (element.disabled) return;
                callback(e);
            });
        });
    };
    addSafeClickListener(document.getElementById('nav-north'), () => handleNavigation('north'));
    addSafeClickListener(document.getElementById('nav-south'), () => handleNavigation('south'));
    addSafeClickListener(document.getElementById('nav-east'), () => handleNavigation('east'));
    addSafeClickListener(document.getElementById('nav-west'), () => handleNavigation('west'));
    document.getElementById('inventory-list').addEventListener('click', handleInventoryClick);
    UI.chatInputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSendChat(); });
    const quickChatButton = document.getElementById('quick-chat-button');
    const quickChatMenu = document.getElementById('quick-chat-menu');
    addSafeClickListener(quickChatButton, () => { quickChatMenu.classList.toggle('visible'); });
    quickChatMenu.addEventListener('click', (e) => { if (e.target.classList.contains('quick-chat-item')) { UI.addChatMessage(e.target.textContent, 'player', 'Vous'); quickChatMenu.classList.remove('visible'); } });
    addSafeClickListener(document.documentElement, (e) => { if (!quickChatMenu.contains(e.target) && e.target !== quickChatButton) { quickChatMenu.classList.remove('visible'); } });
}

function endGame(isVictory) {
    gameState.gameIntervals.forEach(clearInterval);
    const finalMessage = isVictory ? "Félicitations ! Vous avez survécu 100 jours !" : "Vous n'avez pas survécu...";
    UI.addChatMessage(finalMessage, 'system');
    document.querySelectorAll('button').forEach(b => b.disabled = true);
    document.getElementById('chat-input-field').disabled = true;
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
        
        const intervals = [
            setInterval(gameLoop, 100),
            setInterval(() => { decayStats(gameState.player); }, CONFIG.STAT_DECAY_INTERVAL_MS),
            setInterval(dailyUpdate, CONFIG.DAY_DURATION_MS),
            setInterval(() => npcChatter(gameState.npcs), CONFIG.CHAT_MESSAGE_INTERVAL_MS)
        ];
        gameState.gameIntervals.push(...intervals);
        
        // Premier rendu complet au démarrage, INCLUANT les actions.
        render();
        updatePossibleActions(gameState);
        console.log("Jeu initialisé. Boucle de rendu corrigée.");
    } catch (error) {
        console.error("ERREUR CRITIQUE lors de l'initialisation :", error);
        document.body.innerHTML = `<div style="color:white; padding: 20px;">Erreur critique au chargement : ${error.message}</div>`;
    }
}

window.addEventListener('load', init);