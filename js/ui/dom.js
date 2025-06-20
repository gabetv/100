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
    DOM.actionsEl = document.getElementById('actions');
    DOM.chatInputEl = document.getElementById('chat-input-field');
    DOM.toggleChatSizeBtn = document.getElementById('toggle-chat-size-btn'); 
    DOM.bottomBarEl = document.getElementById('bottom-bar');                 
    DOM.dayCounterEl = document.getElementById('day-counter');
    DOM.openEquipmentBtn = document.getElementById('open-equipment-btn');

    // BOUTONS DE NAVIGATION
    DOM.navNorth = document.getElementById('nav-north');
    DOM.navSouth = document.getElementById('nav-south');
    DOM.navEast = document.getElementById('nav-east');
    DOM.navWest = document.getElementById('nav-west');

    // --- SLOTS D'ÉQUIPEMENT RAPIDE ---
    DOM.quickSlotWeapon = document.getElementById('quick-slot-weapon');
    DOM.quickSlotShield = document.getElementById('quick-slot-shield'); // Ajout shield
    DOM.quickSlotArmor = document.getElementById('quick-slot-armor');
    DOM.quickSlotBag = document.getElementById('quick-slot-bag');
    DOM.quickSlotFeet = document.getElementById('quick-slot-feet'); 
    DOM.quickSlotsPanel = document.getElementById('quick-slots-panel'); 

    // --- INVENTAIRE PAR CATÉGORIES ---
    DOM.inventoryCategoriesEl = document.getElementById('inventory-categories');

    // --- STATS JOUEUR ---
    DOM.healthBarSquaresEl = document.getElementById('health-bar-squares');
    DOM.thirstBarSquaresEl = document.getElementById('thirst-bar-squares');
    DOM.hungerBarSquaresEl = document.getElementById('hunger-bar-squares');
    DOM.sleepBarSquaresEl = document.getElementById('sleep-bar-squares');
    DOM.healthStatusEl = document.getElementById('health-status');

    DOM.consumeHealthBtn = document.getElementById('consume-health-btn');
    DOM.consumeThirstBtn = document.getElementById('consume-thirst-btn');
    DOM.consumeHungerBtn = document.getElementById('consume-hunger-btn');

    // --- HUD & SUPERPOSITIONS ---
    DOM.hudCoordsEl = document.getElementById('hud-coords');
    DOM.tileHarvestsInfoEl = document.getElementById('tile-harvests-info');
    DOM.inventoryCapacityEl = document.getElementById('inventory-capacity-display');

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
    DOM.equipmentSlotsEl = document.getElementById('equipment-slots'); // Conteneur des slots (head, body, feet, weapon, shield)
    DOM.playerStatAttackEl = document.getElementById('player-stat-attack');
    DOM.playerStatDefenseEl = document.getElementById('player-stat-defense');

    // --- MENU CONTEXTUEL D'OBJET ---
    DOM.itemContextMenu = document.getElementById('item-context-menu');
    DOM.contextMenuTitle = document.getElementById('context-menu-title');
    DOM.contextMenuActions = document.getElementById('context-menu-actions');

    // Chat
    DOM.quickChatButton = document.getElementById('quick-chat-button');
    DOM.chatMessagesEl = document.getElementById('chat-messages'); 
}