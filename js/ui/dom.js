// js/ui/dom.js

const DOM = {};
export default DOM;

export function initDOM() {
    // --- VUE PRINCIPALE & CANVAS ---
    DOM.mainViewCanvas = document.getElementById('main-view-canvas');
    if (DOM.mainViewCanvas) DOM.mainViewCtx = DOM.mainViewCanvas.getContext('2d');
    DOM.charactersCanvas = document.getElementById('characters-canvas');
    if (DOM.charactersCanvas) DOM.charactersCtx = DOM.charactersCanvas.getContext('2d');

    // --- PANNEAUX UI ---
    DOM.tileNameEl = document.getElementById('tile-name');
    DOM.tileDescriptionEl = document.getElementById('tile-description');
    // MODIFIÉ: DOM.actionsEl pointe maintenant vers le conteneur de l'onglet Actions
    DOM.actionsEl = document.getElementById('actions-tab-content'); 
    DOM.chatInputEl = document.getElementById('chat-input-field');
    DOM.toggleChatSizeBtn = document.getElementById('toggle-chat-size-btn');
    DOM.dayCounterEl = document.getElementById('day-counter');

    // BOUTONS DE NAVIGATION
    DOM.navNorth = document.getElementById('nav-north');
    DOM.navSouth = document.getElementById('nav-south');
    DOM.navEast = document.getElementById('nav-east');
    DOM.navWest = document.getElementById('nav-west');
    DOM.navNE = document.getElementById('nav-ne');
    DOM.navNW = document.getElementById('nav-nw');
    DOM.navSE = document.getElementById('nav-se');
    DOM.navSW = document.getElementById('nav-sw');

    // --- INVENTAIRE PAR CATÉGORIES ---
    DOM.inventoryCategoriesEl = document.getElementById('inventory-categories');

    // --- STATS JOUEUR ---
    DOM.healthSquaresContainerEl = document.getElementById('health-squares-container');
    DOM.thirstSquaresContainerEl = document.getElementById('thirst-squares-container');
    DOM.hungerSquaresContainerEl = document.getElementById('hunger-squares-container');
    DOM.sleepSquaresContainerEl = document.getElementById('sleep-squares-container');
    DOM.healthStatusEl = document.getElementById('health-status');

    DOM.consumeHealthBtn = document.getElementById('consume-health-btn');
    DOM.consumeThirstBtn = document.getElementById('consume-thirst-btn');
    DOM.consumeHungerBtn = document.getElementById('consume-hunger-btn');

    // --- HUD & SUPERPOSITIONS ---
    DOM.hudCoordsEl = document.getElementById('hud-coords');
    DOM.tileHarvestsInfoEl = document.getElementById('tile-harvests-info');
    DOM.inventoryCapacityEl = document.getElementById('inventory-capacity-display');

    DOM.dayCounterTileInfoEl = document.getElementById('day-counter-tileinfo');

    // --- CARTES ---
    DOM.minimapCanvas = document.getElementById('minimap-canvas');
    if (DOM.minimapCanvas) DOM.minimapCtx = DOM.minimapCanvas.getContext('2d');
    DOM.largeMapModal = document.getElementById('large-map-modal');
    DOM.largeMapCanvas = document.getElementById('large-map-canvas');
    if (DOM.largeMapCanvas) DOM.largeMapCtx = DOM.largeMapCanvas.getContext('2d');
    DOM.enlargeMapBtn = document.getElementById('enlarge-map-btn');
    DOM.closeLargeMapBtn = document.getElementById('close-large-map-btn');
    DOM.largeMapLegendEl = document.getElementById('large-map-legend');

    // --- MODALE D'INVENTAIRE PARTAGÉ ---
    DOM.inventoryModal = document.getElementById('inventory-modal');
    DOM.closeInventoryModalBtn = document.getElementById('close-inventory-modal-btn');
    DOM.modalPlayerInventoryEl = document.getElementById('modal-player-inventory');
    DOM.modalSharedInventoryEl = document.getElementById('modal-shared-inventory');
    DOM.modalPlayerCapacityEl = document.getElementById('modal-player-capacity');
    DOM.modalSharedCapacityEl = document.getElementById('modal-shared-capacity');
    DOM.sharedInventorySearchEl = document.getElementById('shared-inventory-search');


    // --- MODALE DE QUANTITÉ ---
    DOM.quantityModal = document.getElementById('quantity-modal');
    DOM.quantityModalTitle = document.getElementById('quantity-modal-title');
    DOM.quantitySlider = document.getElementById('quantity-slider');
    DOM.quantityInput = document.getElementById('quantity-input');
    DOM.quantityConfirmBtn = document.getElementById('quantity-confirm-btn');
    DOM.quantityCancelBtn = document.getElementById('quantity-cancel-btn');
    DOM.quantityMaxBtn = document.getElementById('quantity-max-btn');
    DOM.quantityShortcuts = document.getElementById('quantity-shortcuts');

    // --- MODALE DE COMBAT ---
    DOM.combatModal = document.getElementById('combat-modal');
    DOM.combatLogEl = document.getElementById('combat-log');
    DOM.combatActionsEl = document.getElementById('combat-actions');
    DOM.combatPlayerHealthBar = document.getElementById('combat-player-health-bar');
    DOM.combatPlayerHealthText = document.getElementById('combat-player-health-text');
    DOM.combatEnemyName = document.getElementById('combat-enemy-name');
    DOM.combatEnemyHealthBar = document.getElementById('combat-enemy-health-bar');
    DOM.combatEnemyHealthText = document.getElementById('combat-enemy-health-text');

    // --- MODALE D'ÉQUIPEMENT (VUE SAC) ---
    DOM.equipmentModal = document.getElementById('equipment-modal');
    DOM.closeEquipmentModalBtn = document.getElementById('close-equipment-modal-btn');
    DOM.equipmentPlayerInventoryEl = document.getElementById('equipment-player-inventory');
    DOM.equipmentPlayerCapacityEl = document.getElementById('equipment-player-capacity');
    DOM.equipmentSlotsEl = document.getElementById('equipment-slots');
    DOM.playerStatAttackEl = document.getElementById('player-stat-attack');
    DOM.playerStatDefenseEl = document.getElementById('player-stat-defense');

    // --- MENU CONTEXTUEL D'OBJET ---
    DOM.itemContextMenu = document.getElementById('item-context-menu');
    DOM.contextMenuTitle = document.getElementById('context-menu-title');
    DOM.contextMenuActions = document.getElementById('context-menu-actions');

    // Chat
    DOM.quickChatButton = document.getElementById('quick-chat-button');
    DOM.chatMessagesEl = document.getElementById('chat-messages');

    // Éléments de la nouvelle barre inférieure (réorganisation)
    DOM.bottomBarEl = document.getElementById('bottom-bar');
    DOM.bottomBarChatPanelEl = document.getElementById('bottom-bar-chat-panel');
    DOM.bottomBarEquipmentPanelEl = document.getElementById('bottom-bar-equipment-panel');
    DOM.bottomBarGroundItemsEl = document.getElementById('bottom-bar-ground-items');
    DOM.bottomBarEquipmentSlotsEl = document.getElementById('bottom-bar-equipment-slots');

    // --- MODALE DE CONSTRUCTION ---
    DOM.buildModal = document.getElementById('build-modal');
    DOM.closeBuildModalBtn = document.getElementById('close-build-modal-btn');
    DOM.buildModalGridEl = document.getElementById('build-modal-grid');

    // --- MODALE D'ATELIER ---
    DOM.workshopModal = document.getElementById('workshop-modal');
    DOM.closeWorkshopModalBtn = document.getElementById('close-workshop-modal-btn');
    DOM.workshopRecipesContainerEl = document.getElementById('workshop-recipes-container');
    DOM.workshopSearchInputEl = document.getElementById('workshop-search-input');
    DOM.workshopCategoryFilterEl = document.getElementById('workshop-category-filter');

    // --- MODALE DE CODE DE CADENAS ---
    DOM.lockModal = document.getElementById('lock-modal');
    DOM.lockModalTitle = document.getElementById('lock-modal-title');
    DOM.lockCodeInput1 = document.getElementById('lock-code-input-1');
    DOM.lockCodeInput2 = document.getElementById('lock-code-input-2');
    DOM.lockCodeInput3 = document.getElementById('lock-code-input-3');
    DOM.lockUnlockButton = document.getElementById('lock-unlock-btn');
    DOM.lockCancelButton = document.getElementById('lock-cancel-btn');

    // --- TUTORIEL ---
    DOM.tutorialOverlay = document.getElementById('tutorial-overlay');
    DOM.tutorialMessage = document.getElementById('tutorial-message');
    DOM.tutorialNextButton = document.getElementById('tutorial-next-btn');
    DOM.tutorialSkipButton = document.getElementById('tutorial-skip-btn');
}