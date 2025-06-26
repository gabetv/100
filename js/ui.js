// js/ui.js
import DOM from './ui/dom.js'; // Correction du chemin

// Importer les modules en entier (namespace import)
import * as PanelsModule from './ui/panels.js'; // Correction du chemin
import * as DrawModule from './ui/draw.js'; // Correction du chemin
import * as EffectsModule from './ui/effects.js'; // Correction du chemin
import * as ModalsModule from './ui/modals.js'; // Correction du chemin
import * as TutorialModule from './ui/tutorial.js'; // Correction du chemin

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
export const triggerScreenShake = EffectsModule.triggerScreenShake;
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
export const initializeTabs = PanelsModule.initializeTabs;

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

    // Update biome and position display in HUD
    const biomeDisplay = document.getElementById('biome-display');
    const positionDisplay = document.getElementById('position-display');
    const dayDisplay = document.getElementById('day-display');
    const timeDisplay = document.getElementById('time-display');
    const positionDisplayNav = document.getElementById('position-display-nav');
    if (biomeDisplay) {
        biomeDisplay.textContent = `Biome: ${currentTile.type.name || 'Inconnu'}`;
    }
    if (positionDisplay) {
        positionDisplay.textContent = `Position: (${player.x}, ${player.y})`;
    }
    if (dayDisplay) {
        dayDisplay.textContent = `Jour: ${day}`;
    }
    if (timeDisplay) {
        // Calcul d'une heure fictive basée sur le jour (à ajuster selon la logique du jeu)
        const hour = Math.floor((day - 1) * 24) % 24;
        const formattedHour = hour < 10 ? `0${hour}` : hour;
        timeDisplay.textContent = `Heure: ${formattedHour}:00`;
    }
    if (positionDisplayNav) {
        positionDisplayNav.textContent = `Position: (${player.x}, ${player.y})`;
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
export function isQuantityModalOpen() {
    return DOM.quantityModal && !DOM.quantityModal.classList.contains('hidden');
}

/**
 * Initialise les écouteurs pour le bouton Actions et son menu déroulant.
 */
export function initializeActionsDropdown() {
    const actionButton = document.getElementById('action-button');
    const actionsDropdown = document.getElementById('actions-dropdown');
    
    if (actionButton && actionsDropdown) {
        actionButton.addEventListener('click', (e) => {
            e.stopPropagation();
            actionsDropdown.classList.toggle('hidden');
        });
        
        // Ferme le menu si on clique ailleurs
        document.addEventListener('click', () => {
            if (!actionsDropdown.classList.contains('hidden')) {
                actionsDropdown.classList.add('hidden');
            }
        });
        
        // Ajoute des écouteurs pour chaque item du menu
        const actionItems = actionsDropdown.querySelectorAll('.action-dropdown-item');
        actionItems.forEach(item => {
            item.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                console.log(`Action sélectionnée : ${action}`);
                // TODO: Implémenter la logique pour chaque action
                actionsDropdown.classList.add('hidden');
            });
        });
    }
}

/**
 * Initialise les écouteurs pour les boutons d'action centraux sur la vue principale.
 * Note: Cette fonction ne peuple plus l'onglet "Actions", car cela est géré par
 * `updatePossibleActions` dans main.js via `window.fullUIUpdate`.
 */
export function initializeCentralActions() {
    // // MODIFIÉ: La logique de mise à jour de l'onglet Actions a été retirée d'ici.
    // // Elle est maintenant gérée par updatePossibleActions dans main.js.
    //
    // // Function to update the actions panel within the 'Actions' tab
    // const updateActionsPanel = () => {
    //     const actionsTabContent = document.getElementById('actions-tab-content');
    //     if (!actionsTabContent) {
    //         console.warn("Actions tab content not found in DOM. Skipping update.");
    //         return;
    //     }
        
    //     let currentActionsSection = actionsTabContent.querySelector('.current-actions-section');
    //     if (currentActionsSection) {
    //         currentActionsSection.innerHTML = '';
    //     } else {
    //         currentActionsSection = document.createElement('div');
    //         currentActionsSection.className = 'current-actions-section';
    //         currentActionsSection.innerHTML = '<h4>Actions Disponibles sur Cette Tuile</h4>';
    //         actionsTabContent.appendChild(currentActionsSection);
    //     }
        
    //     const actions = window.getTileActions ? window.getTileActions() : [];
    //     if (actions.length > 0) {
    //         const actionsContainer = document.createElement('div');
    //         actionsContainer.className = 'stylized-actions-menu';
    //         actionsContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; padding: 10px; background-color: rgba(0, 0, 0, 0.1); border-radius: 8px; margin-bottom: 15px;';
            
    //         actions.forEach(action => {
    //             const button = document.createElement('button');
    //             button.className = 'central-action-button';
    //             button.style.cssText = 'background-color: var(--action-color); color: var(--text-light); padding: 8px 12px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; transition: background-color 0.3s;';
    //             button.setAttribute('data-action', action.actionId);
    //             button.setAttribute('title', action.title || action.text);
    //             button.textContent = action.text;
    //             button.disabled = action.disabled;
    //             button.addEventListener('click', (ev) => {
    //                 if (window.handleGlobalPlayerAction) {
    //                     window.handleGlobalPlayerAction(action.actionId, action.data || {});
    //                 }
    //             });
    //             button.addEventListener('mouseover', () => {
    //                 button.style.backgroundColor = 'var(--action-hover-color)';
    //             });
    //             button.addEventListener('mouseout', () => {
    //                 button.style.backgroundColor = 'var(--action-color)';
    //             });
    //             actionsContainer.appendChild(button);
    //         });
            
    //         currentActionsSection.appendChild(actionsContainer);
    //     } else {
    //         const noActionsMsg = document.createElement('p');
    //         noActionsMsg.textContent = "Aucune action disponible pour cette tuile.";
    //         noActionsMsg.style.cssText = 'text-align: center; padding: 10px; color: var(--text-muted);';
    //         currentActionsSection.appendChild(noActionsMsg);
    //     }
    // };
    
    // // MODIFIÉ: L'override de fullUIUpdate pour appeler updateActionsPanel est retiré d'ici.
    // if (window.fullUIUpdate) {
    //     const originalFullUIUpdate = window.fullUIUpdate;
    //     window.fullUIUpdate = function() {
    //         originalFullUIUpdate();
    //         // updateActionsPanel(); // Retiré
    //     };
    // }
    
    // // MODIFIÉ: L'appel initial à updateActionsPanel est retiré d'ici.
    // setTimeout(() => {
    //     // updateActionsPanel(); // Retiré
    // }, 0);
}