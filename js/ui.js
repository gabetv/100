// js/ui.js
// On ne fait plus d'import de DOM, il sera global

// --- Exports directs des modules ---
export { loadAssets, drawMainBackground, drawSceneCharacters, drawMinimap, drawLargeMap, populateLargeMapLegend } from './ui/draw.js';
export { showFloatingText, triggerActionFlash, triggerShake, resizeGameView } from './ui/effects.js';
export { 
    showInventoryModal, hideInventoryModal, 
    showEquipmentModal, hideEquipmentModal, updateEquipmentModal,
    showCombatModal, hideCombatModal, updateCombatUI,
    showQuantityModal, hideQuantityModal, setupQuantityModalListeners 
} from './ui/modals.js';
export { addChatMessage, updateAllButtonsState, updateQuickSlots } from './ui/panels.js';
export { initDOM } from './ui/dom.js'; // On exporte juste la fonction d'init

// --- Fonction de coordination ---
export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) return;
    
    // On importe ici dynamiquement les modules qui dépendent du DOM
    const Panels = import('./ui/panels.js');
    const Draw = import('./ui/draw.js');

    Promise.all([Panels, Draw]).then(([resolvedPanels, resolvedDraw]) => {
        const currentTile = gameState.map[gameState.player.y][gameState.player.x];
        
        resolvedPanels.updateStatsPanel(gameState.player);
        resolvedPanels.updateInventory(gameState.player);
        resolvedPanels.updateDayCounter(gameState.day);
        resolvedPanels.updateTileInfoPanel(currentTile);
        resolvedPanels.updateQuickSlots(gameState.player);
        resolvedDraw.drawMinimap(gameState, gameState.config);
        
        window.DOM.hudCoordsEl.textContent = `(${gameState.player.x}, ${gameState.player.y})`;
    });
}

export function renderScene(gameState) {
    import('./ui/draw.js').then(Draw => {
        Draw.drawMainBackground(gameState);
        Draw.drawSceneCharacters(gameState);
    });
}