// js/ui.js
import DOM from './ui/dom.js';

// Importer les modules en entier (namespace import)
import * as PanelsModule from './ui/panels.js';
import * as DrawModule from './ui/draw.js';
import * as EffectsModule from './ui/effects.js';
import * as ModalsModule from './ui/modals.js';

// --- Ré-exporter explicitement les fonctions que main.js (ou d'autres modules externes) utilisera via UI.fonction ---

// Depuis ./ui/draw.js
export const loadAssets = DrawModule.loadAssets;
export const drawMainBackground = DrawModule.drawMainBackground;
export const drawSceneCharacters = DrawModule.drawSceneCharacters;
export const drawMinimap = DrawModule.drawMinimap;
export const drawLargeMap = DrawModule.drawLargeMap;
export const populateLargeMapLegend = DrawModule.populateLargeMapLegend;

// Depuis ./ui/effects.js
export const showFloatingText = EffectsModule.showFloatingText;
export const triggerActionFlash = EffectsModule.triggerActionFlash;
export const triggerShake = EffectsModule.triggerShake;
export const resizeGameView = EffectsModule.resizeGameView;

// Depuis ./ui/modals.js
export const showInventoryModal = ModalsModule.showInventoryModal;
export const hideInventoryModal = ModalsModule.hideInventoryModal;
export const showEquipmentModal = ModalsModule.showEquipmentModal;
export const hideEquipmentModal = ModalsModule.hideEquipmentModal;
export const updateEquipmentModal = ModalsModule.updateEquipmentModal;
export const showCombatModal = ModalsModule.showCombatModal;
export const hideCombatModal = ModalsModule.hideCombatModal;
export const updateCombatUI = ModalsModule.updateCombatUI;
export const showQuantityModal = ModalsModule.showQuantityModal;
export const hideQuantityModal = ModalsModule.hideQuantityModal;
export const setupQuantityModalListeners = ModalsModule.setupQuantityModalListeners;
export const showLargeMap = ModalsModule.showLargeMap;
export const hideLargeMap = ModalsModule.hideLargeMap;
export const showBuildModal = ModalsModule.showBuildModal;
export const hideBuildModal = ModalsModule.hideBuildModal;
export const populateBuildModal = ModalsModule.populateBuildModal;
export const showWorkshopModal = ModalsModule.showWorkshopModal; // AJOUT
export const hideWorkshopModal = ModalsModule.hideWorkshopModal; // AJOUT
export const populateWorkshopModal = ModalsModule.populateWorkshopModal; // AJOUT
export const setupWorkshopModalListeners = ModalsModule.setupWorkshopModalListeners; // AJOUT
export const showLockModal = ModalsModule.showLockModal; // For Cadenas
export const hideLockModal = ModalsModule.hideLockModal; // For Cadenas
export const setupLockModalListeners = ModalsModule.setupLockModalListeners; // For Cadenas


// Depuis ./ui/panels.js
export const addChatMessage = PanelsModule.addChatMessage;
export const updateAllButtonsState = PanelsModule.updateAllButtonsState;
export const updateQuickSlots = PanelsModule.updateQuickSlots;
export const updateStatsPanel = PanelsModule.updateStatsPanel;
export const updateInventory = PanelsModule.updateInventory;
export const updateDayCounter = PanelsModule.updateDayCounter;
export const updateTileInfoPanel = PanelsModule.updateTileInfoPanel;
export const updateGroundItemsPanel = PanelsModule.updateGroundItemsPanel;
export const updateBottomBarEquipmentPanel = PanelsModule.updateBottomBarEquipmentPanel;


/**
 * Met à jour tous les éléments statiques de l'interface utilisateur (sauf la scène principale).
 * @param {object} gameState L'état actuel du jeu.
 */
export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) {
        console.warn("[ui.js] updateAllUI appelée sans gameState ou player valide.");
        return;
    }

    const { player, map, day } = gameState;
    if (!map || !map[player.y] || !map[player.y][player.x]) {
        console.warn("[ui.js] updateAllUI: Coordonnées du joueur invalides ou carte non définie.");
        return;
    }
    const currentTile = map[player.y][player.x];

    PanelsModule.updateStatsPanel(player);
    PanelsModule.updateInventory(player);
    PanelsModule.updateDayCounter(day); // This now updates the day counter in the tile info panel (#52)
    PanelsModule.updateTileInfoPanel(currentTile);
    PanelsModule.updateQuickSlots(player);
    PanelsModule.updateGroundItemsPanel(currentTile);
    PanelsModule.updateBottomBarEquipmentPanel(player);

    console.log("[ui.js] updateAllUI: About to call drawMinimap. Config exists:", !!gameState.config);
    if (gameState.config) {
       DrawModule.drawMinimap(gameState, gameState.config);
       console.log("[ui.js] updateAllUI: drawMinimap completed.");
    } else {
        console.warn("[ui.js] updateAllUI: gameState.config manquant pour drawMinimap.");
    }

    if(DOM.hudCoordsEl) {
        DOM.hudCoordsEl.textContent = `(${player.x}, ${player.y})`;
    }
     if(DOM.dayCounterEl && !DOM.dayCounterTileInfoEl) { // Fallback if old day counter still exists and new one doesn't
        DOM.dayCounterEl.textContent = day;
    }
}

/**
 * Redessine toute la scène principale du jeu (arrière-plan et personnages).
 * @param {object} gameState
 */
export function renderScene(gameState) {
    console.log("[ui.js] renderScene called. GameState player:", gameState && gameState.player ? gameState.player.x + ',' + gameState.player.y : "N/A");
    if (!gameState) {
        console.warn("[ui.js] renderScene appelée sans gameState.");
        return;
    }
    DrawModule.drawMainBackground(gameState);
    DrawModule.drawSceneCharacters(gameState);
}