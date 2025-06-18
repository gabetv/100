// js/ui.js
import * as DOM from './ui/dom.js';
import * as Draw from './ui/draw.js';
import * as Effects from './ui/effects.js';
import * as Modals from './ui/modals.js';
import * as Panels from './ui/panels.js';

// --- Exports directs des modules ---
export { loadAssets, drawMainBackground, drawSceneCharacters, drawMinimap, drawLargeMap, populateLargeMapLegend } from './ui/draw.js';
export { showFloatingText, triggerActionFlash, triggerShake, resizeGameView } from './ui/effects.js';
export { 
    showInventoryModal, hideInventoryModal, 
    showEquipmentModal, hideEquipmentModal, updateEquipmentModal,
    showCombatModal, hideCombatModal, updateCombatUI,
    showQuantityModal, hideQuantityModal, setupQuantityModalListeners 
} from './ui/modals.js';
export { addChatMessage, updateAllButtonsState } from './ui/panels.js';
export * from './ui/dom.js';

// --- Fonction de coordination ---

/**
 * Met à jour tous les éléments statiques de l'interface utilisateur.
 * @param {object} gameState L'état actuel du jeu.
 */
export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) return;
    
    const currentTile = gameState.map[gameState.player.y][gameState.player.x];
    
    Panels.updateStatsPanel(gameState.player);
    Panels.updateInventory(gameState.player);
    Panels.updateDayCounter(gameState.day);
    Panels.updateTileInfoPanel(currentTile);
    Draw.drawMinimap(gameState, gameState.config);
    
    DOM.hudCoordsEl.textContent = `(${gameState.player.x}, ${gameState.player.y})`;
}

/**
 * Redessine toute la scène principale du jeu (arrière-plan et personnages).
 * @param {object} gameState 
 */
export function renderScene(gameState) {
    Draw.drawMainBackground(gameState);
    Draw.drawSceneCharacters(gameState);
}