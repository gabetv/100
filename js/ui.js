// js/ui.js
import DOM from './ui/dom.js'; 

// ### MODIFICATION : Importer explicitement les modules nécessaires pour les fonctions internes ###
import * as Panels from './ui/panels.js';
import * as Draw from './ui/draw.js';
// import * as Effects from './ui/effects.js'; // Décommentez si des fonctions de effects.js sont appelées directement ici
// import * as Modals from './ui/modals.js';   // Décommentez si des fonctions de modals.js sont appelées directement ici

// --- Exports directs des modules (pour l'extérieur, ex: main.js) ---
// Ces exports permettent à main.js de faire UI.drawMainBackground, UI.showInventoryModal, etc.

// Depuis ./ui/draw.js
export { 
    loadAssets, 
    drawMainBackground, 
    drawSceneCharacters, 
    drawMinimap, 
    drawLargeMap, 
    populateLargeMapLegend 
} from './ui/draw.js';

// Depuis ./ui/effects.js
export { 
    showFloatingText, 
    triggerActionFlash, 
    triggerShake, 
    resizeGameView 
} from './ui/effects.js';

// Depuis ./ui/modals.js
export { 
    showInventoryModal, hideInventoryModal, 
    showEquipmentModal, hideEquipmentModal, updateEquipmentModal,
    showCombatModal, hideCombatModal, updateCombatUI,
    showQuantityModal, hideQuantityModal, setupQuantityModalListeners,
    showLargeMap, hideLargeMap
} from './ui/modals.js';

// Depuis ./ui/panels.js
export { 
    addChatMessage, 
    updateAllButtonsState, 
    updateQuickSlots, 
    updateStatsPanel, 
    updateInventory, 
    updateDayCounter, 
    updateTileInfoPanel 
} from './ui/panels.js';


/**
 * Met à jour tous les éléments statiques de l'interface utilisateur (sauf la scène principale).
 * Cette fonction est typiquement appelée depuis main.js via UI.updateAllUI().
 * @param {object} gameState L'état actuel du jeu.
 */
export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) {
        console.warn("[ui.js] updateAllUI appelée sans gameState ou player valide.");
        return;
    }
    
    const { player, map, day } = gameState;
    // Vérifier si map et les coordonnées du joueur sont valides
    if (!map || !map[player.y] || !map[player.y][player.x]) {
        console.warn("[ui.js] updateAllUI: Coordonnées du joueur invalides ou carte non définie.");
        return;
    }
    const currentTile = map[player.y][player.x];
    
    // ### MODIFICATION : Utiliser les modules importés pour les appels internes ###
    Panels.updateStatsPanel(player);
    Panels.updateInventory(player);
    Panels.updateDayCounter(day);
    Panels.updateTileInfoPanel(currentTile);
    Panels.updateQuickSlots(player); 
    
    if (gameState.config) {
       Draw.drawMinimap(gameState, gameState.config); 
    } else {
        console.warn("[ui.js] updateAllUI: gameState.config manquant pour drawMinimap.");
    }
    
    if(DOM.hudCoordsEl) { // S'assurer que l'élément DOM existe
        DOM.hudCoordsEl.textContent = `(${player.x}, ${player.y})`;
    }
}

/**
 * Redessine toute la scène principale du jeu (arrière-plan et personnages).
 * Cette fonction est typiquement appelée depuis main.js via UI.renderScene().
 * @param {object} gameState 
 */
export function renderScene(gameState) {
    if (!gameState) {
        console.warn("[ui.js] renderScene appelée sans gameState.");
        return;
    }
    // ### MODIFICATION : Utiliser les modules importés pour les appels internes ###
    Draw.drawMainBackground(gameState);
    Draw.drawSceneCharacters(gameState);
}