// js/ui/dom.js

// --- VUE PRINCIPALE & CANVAS ---
export const mainViewCanvas = document.getElementById('main-view-canvas');
export const mainViewCtx = mainViewCanvas.getContext('2d');
export const charactersCanvas = document.getElementById('characters-canvas');
export const charactersCtx = charactersCanvas.getContext('2d');

// --- PANNEAUX UI ---
export const tileNameEl = document.getElementById('tile-name');
export const tileDescriptionEl = document.getElementById('tile-description');
export const actionsEl = document.getElementById('actions');
export const chatInputEl = document.getElementById('chat-input-field');
export const toggleChatSizeBtn = document.getElementById('toggle-chat-size-btn');
export const bottomBarEl = document.getElementById('bottom-bar');
export const dayCounterEl = document.getElementById('day-counter');

// --- STATS JOUEUR ---
export const healthBarSquaresEl = document.getElementById('health-bar-squares');
export const thirstBarSquaresEl = document.getElementById('thirst-bar-squares');
export const hungerBarSquaresEl = document.getElementById('hunger-bar-squares');
export const sleepBarSquaresEl = document.getElementById('sleep-bar-squares');
export const healthStatusEl = document.getElementById('health-status');

// --- HUD & SUPERPOSITIONS ---
export const hudCoordsEl = document.getElementById('hud-coords');
export const tileHarvestsInfoEl = document.getElementById('tile-harvests-info');
export const inventoryCapacityEl = document.getElementById('inventory-capacity-display');

// --- CARTES ---
export const minimapCanvas = document.getElementById('minimap-canvas');
export const minimapCtx = minimapCanvas.getContext('2d');
export const largeMapModal = document.getElementById('large-map-modal');
export const largeMapCanvas = document.getElementById('large-map-canvas');
export const largeMapCtx = largeMapCanvas.getContext('2d');
export const enlargeMapBtn = document.getElementById('enlarge-map-btn');
export const closeLargeMapBtn = document.getElementById('close-large-map-btn');
export const largeMapLegendEl = document.getElementById('large-map-legend');

// --- MODALE D'INVENTAIRE PARTAGÉ ---
export const inventoryModal = document.getElementById('inventory-modal');
export const closeInventoryModalBtn = document.getElementById('close-inventory-modal-btn');
export const modalPlayerInventoryEl = document.getElementById('modal-player-inventory');
export const modalSharedInventoryEl = document.getElementById('modal-shared-inventory');
export const modalPlayerCapacityEl = document.getElementById('modal-player-capacity');

// --- MODALE DE QUANTITÉ ---
export const quantityModal = document.getElementById('quantity-modal');
export const quantityModalTitle = document.getElementById('quantity-modal-title');
export const quantitySlider = document.getElementById('quantity-slider');
export const quantityInput = document.getElementById('quantity-input');
export const quantityConfirmBtn = document.getElementById('quantity-confirm-btn');
export const quantityCancelBtn = document.getElementById('quantity-cancel-btn');
export const quantityMaxBtn = document.getElementById('quantity-max-btn');
export const quantityShortcuts = document.getElementById('quantity-shortcuts');

// --- MODALE DE COMBAT ---
export const combatModal = document.getElementById('combat-modal');
export const combatLogEl = document.getElementById('combat-log');
export const combatActionsEl = document.getElementById('combat-actions');
export const combatPlayerHealthBar = document.getElementById('combat-player-health-bar');
export const combatPlayerHealthText = document.getElementById('combat-player-health-text');
export const combatEnemyName = document.getElementById('combat-enemy-name');
export const combatEnemyHealthBar = document.getElementById('combat-enemy-health-bar');
export const combatEnemyHealthText = document.getElementById('combat-enemy-health-text');

// --- MODALE D'ÉQUIPEMENT ---
export const equipmentModal = document.getElementById('equipment-modal');
export const closeEquipmentModalBtn = document.getElementById('close-equipment-modal-btn');
export const equipmentPlayerInventoryEl = document.getElementById('equipment-player-inventory');
export const equipmentPlayerCapacityEl = document.getElementById('equipment-player-capacity');
export const equipmentSlotsEl = document.getElementById('equipment-slots');
export const playerStatAttackEl = document.getElementById('player-stat-attack');
export const playerStatDefenseEl = document.getElementById('player-stat-defense');

// --- MENU CONTEXTUEL D'OBJET ---
export const itemContextMenu = document.getElementById('item-context-menu');
export const contextMenuTitle = document.getElementById('context-menu-title');
export const contextMenuActions = document.getElementById('context-menu-actions');