import DOM from './ui/dom.js'; // Assurez-vous que DOM est bien importé ici

// Importer les modules en entier (namespace import)
import * as PanelsModule from './ui/panels.js';
import * as DrawModule from './ui/draw.js';
import * as EffectsModule from './ui/effects.js';
import * as ModalsModule from './ui/modals.js';
import * as TutorialModule from './ui/tutorial.js';

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
export const showWorkshopModal = ModalsModule.showWorkshopModal;
export const hideWorkshopModal = ModalsModule.hideWorkshopModal;
export const populateWorkshopModal = ModalsModule.populateWorkshopModal;
export const setupWorkshopModalListeners = ModalsModule.setupWorkshopModalListeners;
export const showLockModal = ModalsModule.showLockModal;
export const hideLockModal = ModalsModule.hideLockModal;
export const setupLockModalListeners = ModalsModule.setupLockModalListeners;


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

// Depuis ./ui/tutorial.js
export const initTutorial = TutorialModule.initTutorial;
export const showTutorialStep = TutorialModule.showTutorialStep;
export const advanceTutorial = TutorialModule.advanceTutorial;
export const skipTutorial = TutorialModule.skipTutorial;
export const completeTutorial = TutorialModule.completeTutorial;
export const playerMovedForTutorial = TutorialModule.playerMovedForTutorial;
export const highlightElement = TutorialModule.highlightElement; 

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
    PanelsModule.updateDayCounter(day);
    PanelsModule.updateTileInfoPanel(currentTile);
    PanelsModule.updateQuickSlots(player);
    PanelsModule.updateGroundItemsPanel(currentTile);
    PanelsModule.updateBottomBarEquipmentPanel(player);

    if (gameState.config) {
       DrawModule.drawMinimap(gameState, gameState.config);
    } else {
        console.warn("[ui.js] updateAllUI: gameState.config manquant pour drawMinimap.");
    }

    if(DOM.hudCoordsEl) {
        DOM.hudCoordsEl.textContent = `(${player.x}, ${player.y})`;
    }
     if(DOM.dayCounterEl && !DOM.dayCounterTileInfoEl) {
        DOM.dayCounterEl.textContent = day;
    }
}

/**
 * Redessine toute la scène principale du jeu (arrière-plan et personnages).
 * @param {object} gameState
 */
export function renderScene(gameState) {
    if (!gameState) {
        console.warn("[ui.js] renderScene appelée sans gameState.");
        return;
    }
    DrawModule.drawMainBackground(gameState);
    DrawModule.drawSceneCharacters(gameState);
}

/**
 * Vérifie si la modale de quantité est actuellement ouverte.
 * @returns {boolean} True si la modale est ouverte, false sinon.
 */
// AJOUTÉ : Fonction manquante pour les gestionnaires d'événements
export function isQuantityModalOpen() {
    return DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden');
}