// js/ui.js
import { CONFIG, TILE_TYPES, ITEM_TYPES, COMBAT_CONFIG } from './config.js'; // MODIFIÉ: Ajout de COMBAT_CONFIG
import { getTotalResources } from './player.js';

const TILE_ICONS = {
    'Lagon': '🌊', 'Sable Doré': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Gisement de Pierre': '⛰️', 'Feu de Camp': '🔥',
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine': '⛏️',
    'default': '❓'
};

export const mainViewCanvas = document.getElementById('main-view-canvas'), mainViewCtx = mainViewCanvas.getContext('2d');
export const charactersCanvas = document.getElementById('characters-canvas'), charactersCtx = charactersCanvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas'), minimapCtx = minimapCanvas.getContext('2d');
export const tileNameEl = document.getElementById('tile-name'), tileDescriptionEl = document.getElementById('tile-description'), actionsEl = document.getElementById('actions'), chatInputEl = document.getElementById('chat-input-field');
const dayCounterEl = document.getElementById('day-counter');

const healthBarSquaresEl = document.getElementById('health-bar-squares');
const thirstBarSquaresEl = document.getElementById('thirst-bar-squares');
const hungerBarSquaresEl = document.getElementById('hunger-bar-squares');
const sleepBarSquaresEl = document.getElementById('sleep-bar-squares');
const healthStatusEl = document.getElementById('health-status');

export const hudCoordsEl = document.getElementById('hud-coords');
const tileHarvestsInfoEl = document.getElementById('tile-harvests-info');
const inventoryCapacityEl = document.getElementById('inventory-capacity-display');
export const largeMapModal = document.getElementById('large-map-modal');
export const largeMapCanvas = document.getElementById('large-map-canvas');
const largeMapCtx = largeMapCanvas.getContext('2d');
const largeMapLegendEl = document.getElementById('large-map-legend');
export const enlargeMapBtn = document.getElementById('enlarge-map-btn');
export const closeLargeMapBtn = document.getElementById('close-large-map-btn');

export const inventoryModal = document.getElementById('inventory-modal');
export const closeInventoryModalBtn = document.getElementById('close-inventory-modal-btn');
const modalPlayerInventoryEl = document.getElementById('modal-player-inventory');
const modalSharedInventoryEl = document.getElementById('modal-shared-inventory');
const modalPlayerCapacityEl = document.getElementById('modal-player-capacity');

export const quantityModal = document.getElementById('quantity-modal');
const quantityModalTitle = document.getElementById('quantity-modal-title');
const quantitySlider = document.getElementById('quantity-slider');
const quantityInput = document.getElementById('quantity-input');
const quantityConfirmBtn = document.getElementById('quantity-confirm-btn');
const quantityCancelBtn = document.getElementById('quantity-cancel-btn');
const quantityMaxBtn = document.getElementById('quantity-max-btn');
const quantityShortcuts = document.getElementById('quantity-shortcuts');

export const combatModal = document.getElementById('combat-modal');
const combatLogEl = document.getElementById('combat-log');
const combatActionsEl = document.getElementById('combat-actions');
const combatPlayerHealthBar = document.getElementById('combat-player-health-bar');
const combatPlayerHealthText = document.getElementById('combat-player-health-text');
const combatEnemyName = document.getElementById('combat-enemy-name');
const combatEnemyHealthBar = document.getElementById('combat-enemy-health-bar');
const combatEnemyHealthText = document.getElementById('combat-enemy-health-text');

export const equipmentModal = document.getElementById('equipment-modal');
export const closeEquipmentModalBtn = document.getElementById('close-equipment-modal-btn');
const equipmentPlayerInventoryEl = document.getElementById('equipment-player-inventory');
const equipmentPlayerCapacityEl = document.getElementById('equipment-player-capacity');
const equipmentSlotsEl = document.getElementById('equipment-slots');
const playerStatAttackEl = document.getElementById('player-stat-attack');
const playerStatDefenseEl = document.getElementById('player-stat-defense');

const loadedAssets = {};
let quantityConfirmCallback = null;

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => {
        const img = new Image(); img.src = src; img.onload = () => { loadedAssets[key] = img; resolve(); }; img.onerror = (err) => reject(new Error(`Failed to load ${src}: ${err}`));
    }));
    return Promise.all(promises);
}

export function draw(gameState) {
    if (Object.keys(loadedAssets).length === 0) return;
    const playerTile = gameState.map[gameState.player.y][gameState.player.x]; const backgroundKey = playerTile.backgroundKey; const imageToDraw = loadedAssets[backgroundKey]; mainViewCtx.fillStyle = 'black'; mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
    if (imageToDraw) { const canvasAspect = 1.0; const imageAspect = imageToDraw.width / imageToDraw.height; let sx, sy, sWidth, sHeight; if (imageAspect > canvasAspect) { sHeight = imageToDraw.height; sWidth = sHeight * canvasAspect; sx = (imageToDraw.width - sWidth) / 2; sy = 0; } else { sWidth = imageToDraw.width; sHeight = sWidth / canvasAspect; sx = 0; sy = (imageToDraw.height - sHeight) / 2; } mainViewCtx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, 0, 0, mainViewCanvas.width, mainViewCanvas.height);
    } else { mainViewCtx.fillStyle = 'white'; mainViewCtx.fillText(`Image de fond '${backgroundKey}' non trouvée`, 20, 40); }
}

export function resizeGameView() {
    const wrapper = document.getElementById('main-view-wrapper'); const container = document.getElementById('main-view-container'); if (!wrapper || !container) return; const size = Math.min(wrapper.clientWidth, wrapper.clientHeight) - 10; container.style.width = `${size}px`; container.style.height = `${size}px`; mainViewCanvas.width = size; mainViewCanvas.height = size; charactersCanvas.width = size; charactersCanvas.height = size;
}

function drawCharacter(ctx, character, x, y, isPlayer = false) {
    const headRadius = 18; const bodyWidth = 30; const bodyHeight = 45; ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 4; ctx.fillStyle = character.color; ctx.beginPath(); ctx.moveTo(x - bodyWidth / 2, y + bodyHeight); ctx.lineTo(x + bodyWidth / 2, y + bodyHeight); ctx.lineTo(x + bodyWidth / 2 - 5, y); ctx.lineTo(x - bodyWidth / 2 + 5, y); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y - headRadius / 2, headRadius, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); if (isPlayer) { ctx.fillStyle = '#8b4513'; ctx.strokeStyle = '#5a2d0c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(x - bodyWidth/2 - 8, y + 10, 10, 25, 5); ctx.fill(); ctx.stroke(); } ctx.restore();
}

export function drawSceneCharacters(gameState) {
    const { player, npcs, enemies } = gameState;
    charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height);
    const canvasWidth = charactersCanvas.width;
    const canvasHeight = charactersCanvas.height;
    
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2 + 100;
    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    const characterPositions = [{ char: player, x: centerX, y: centerY, isPlayer: true }];
    if (visibleNpcs.length > 0) characterPositions.push({ char: visibleNpcs[0], x: centerX - 120, y: centerY, isPlayer: false });
    if (visibleNpcs.length > 1) characterPositions.push({ char: visibleNpcs[1], x: centerX + 120, y: centerY, isPlayer: false });

    if (player.animationState) {
        const { type, direction, progress } = player.animationState;
        const easeOut = 1 - Math.pow(1 - progress, 3);
        characterPositions.forEach(p => {
            let modX = 0, modY = 0;
            let distance = canvasWidth / 1.5 * easeOut;
            if (type === 'out') {
                if(direction === 'east') modX = distance; else if(direction === 'west') modX = -distance;
                else if(direction === 'south') modY = distance; else if(direction === 'north') modY = -distance;
                charactersCtx.globalAlpha = 1 - easeOut;
            } else {
                distance = canvasWidth / 1.5 * (1 - easeOut);
                if(direction === 'east') modX = -distance; else if(direction === 'west') modX = distance;
                else if(direction === 'south') modY = -distance; else if(direction === 'north') modY = distance;
                charactersCtx.globalAlpha = easeOut;
            }
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer);
        });
        charactersCtx.globalAlpha = 1;
    } else {
        characterPositions.forEach(p => {
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer);
        });
    }

    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !gameState.combatState);
    if (visibleEnemies.length > 0) {
        const enemy = visibleEnemies[0];
        const enemyX = canvasWidth / 2;
        const enemyY = canvasHeight / 2 - 100;
        charactersCtx.save();
        charactersCtx.fillStyle = enemy.color;
        charactersCtx.font = "80px sans-serif";
        charactersCtx.textAlign = 'center';
        charactersCtx.fillText(enemy.icon, enemyX, enemyY);
        charactersCtx.restore();
    }
}

export function updateTileInfoPanel(tile) {
    tileNameEl.textContent = tile.type.name; const descriptions = { 'Forêt': "L'air est lourd et humide...", 'Plaine': "Une plaine herbeuse...", 'Sable Doré': "Le sable chaud vous brûle les pieds...", 'Lagon': "L'eau turquoise vous invite...", 'Friche': "Le sol est nu...", 'Gisement de Pierre': "Des rochers affleurent...", 'Feu de Camp': "La chaleur des flammes danse...", 'Abri Individuel': "Un abri précaire...", 'Abri Collectif': "Un campement bien établi...", 'Mine': "L'entrée sombre de la mine..." }; tileDescriptionEl.textContent = descriptions[tile.type.name] || "Un lieu étrange...";
    if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity) { tileHarvestsInfoEl.textContent = `Récoltes restantes: ${tile.harvestsLeft}`; tileHarvestsInfoEl.style.display = 'block'; } else { tileHarvestsInfoEl.style.display = 'none'; }
}

function drawMinimap(gameState, config) {
    const { map, player, npcs, enemies } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff'; minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE); } }
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) { minimapCtx.beginPath(); minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height); minimapCtx.stroke(); }
    for (let y = 0; y <= MAP_HEIGHT; y++) { minimapCtx.beginPath(); minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE); minimapCtx.stroke(); }
    
    npcs.forEach(npc => {
        minimapCtx.fillStyle = npc.color;
        minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    });
    
    enemies.forEach(enemy => {
        minimapCtx.fillStyle = enemy.color;
        const x = enemy.x * MINIMAP_DOT_SIZE;
        const y = enemy.y * MINIMAP_DOT_SIZE;
        minimapCtx.beginPath();
        minimapCtx.moveTo(x, y + MINIMAP_DOT_SIZE);
        minimapCtx.lineTo(x + MINIMAP_DOT_SIZE / 2, y);
        minimapCtx.lineTo(x + MINIMAP_DOT_SIZE, y + MINIMAP_DOT_SIZE);
        minimapCtx.closePath();
        minimapCtx.fill();
    });

    minimapCtx.fillStyle = player.color || 'yellow';
    minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);
}

export function drawLargeMap(gameState, config) {
    const { map, player, npcs, enemies } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const headerSize = 30;
    const availableHeight = largeMapCanvas.parentElement.clientHeight - 40;
    const canvasSize = availableHeight;
    largeMapCanvas.width = canvasSize;
    largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT);

    largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);
    largeMapCtx.fillStyle = '#1d3557';
    largeMapCtx.fillRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;
            largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
            const icon = TILE_ICONS[tile.type.name] || TILE_ICONS.default;
            largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2);
        }
    }

    largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    largeMapCtx.lineWidth = 1;
    largeMapCtx.fillStyle = '#f1faee';
    largeMapCtx.font = `600 ${headerSize * 0.5}px Poppins`;
    largeMapCtx.textAlign = 'center';
    largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const x = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, x, headerSize / 2);
        const lineX = headerSize + i * cellSize;
        largeMapCtx.beginPath(); largeMapCtx.moveTo(lineX, headerSize); largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); largeMapCtx.stroke();
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const y = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, headerSize / 2, y);
        const lineY = headerSize + i * cellSize;
        largeMapCtx.beginPath(); largeMapCtx.moveTo(headerSize, lineY); largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); largeMapCtx.stroke();
    }
    largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    npcs.forEach(npc => {
        const drawX = headerSize + npc.x * cellSize + cellSize / 2;
        const drawY = headerSize + npc.y * cellSize + cellSize / 2;
        largeMapCtx.fillStyle = npc.color;
        largeMapCtx.beginPath(); largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill();
    });
    
    enemies.forEach(enemy => {
        const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
        const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
        largeMapCtx.fillStyle = enemy.color;
        largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`;
        largeMapCtx.textAlign = 'center';
        largeMapCtx.textBaseline = 'middle';
        largeMapCtx.fillText(enemy.icon, drawX, drawY);
    });

    const playerDrawX = headerSize + player.x * cellSize + cellSize / 2;
    const playerDrawY = headerSize + player.y * cellSize + cellSize / 2;
    largeMapCtx.fillStyle = player.color;
    largeMapCtx.beginPath(); largeMapCtx.arc(playerDrawX, playerDrawY, cellSize * 0.4, 0, Math.PI * 2); largeMapCtx.fill();
    largeMapCtx.strokeStyle = 'white';
    largeMapCtx.lineWidth = 3;
    largeMapCtx.stroke();
}

export function populateLargeMapLegend() {
    largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set();
    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const icon = TILE_ICONS[tileType.name] || TILE_ICONS.default;
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${icon} ${tileType.name}</span>`;
            largeMapLegendEl.appendChild(item);
            addedTypes.add(tileType.name);
        }
    }
    largeMapLegendEl.insertAdjacentHTML('beforeend', '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">');
    const playerItem = document.createElement('div');
    playerItem.className = 'legend-item';
    playerItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ffd700;">●</div><span>Vous</span>`;
    largeMapLegendEl.appendChild(playerItem);
    const npcItem = document.createElement('div');
    npcItem.className = 'legend-item';
    npcItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ff6347;">●</div><span>Survivants (PNJ)</span>`;
    largeMapLegendEl.appendChild(npcItem);
}

export function showCombatModal(combatState) {
    if (!combatState) return;
    updateCombatUI(combatState);
    combatModal.classList.remove('hidden');
}

export function hideCombatModal() {
    combatModal.classList.add('hidden');
}

export function updateCombatUI(combatState) {
    if (!combatState || !combatModal) return;
    const { enemy, isPlayerTurn, log } = combatState;
    const player = window.gameState.player;

    combatEnemyName.textContent = enemy.name;
    combatEnemyHealthBar.style.width = `${(enemy.currentHealth / enemy.health) * 100}%`;
    combatEnemyHealthText.textContent = `${enemy.currentHealth} / ${enemy.health}`;

    combatPlayerHealthBar.style.width = `${(player.health / 10) * 100}%`;
    combatPlayerHealthText.textContent = `${player.health} / 10`;

    combatLogEl.innerHTML = log.map(msg => `<p>${msg}</p>`).join('');

    combatActionsEl.innerHTML = `
        <button id="combat-attack-btn" ${!isPlayerTurn ? 'disabled' : ''}>⚔️ Attaquer</button>
        <button id="combat-flee-btn" ${!isPlayerTurn ? 'disabled' : ''}>🏃‍♂️ Fuir</button>
    `;

    if (isPlayerTurn) {
        document.getElementById('combat-attack-btn').onclick = () => window.handleCombatAction('attack');
        document.getElementById('combat-flee-btn').onclick = () => window.handleCombatAction('flee');
    }
}

export function showEquipmentModal(gameState) {
    updateEquipmentModal(gameState);
    equipmentModal.classList.remove('hidden');
}

export function hideEquipmentModal() {
    equipmentModal.classList.add('hidden');
}

export function updateEquipmentModal(gameState) {
    const { player } = gameState;
    
    equipmentPlayerInventoryEl.innerHTML = '';
    populateInventoryList(player.inventory, equipmentPlayerInventoryEl, 'player-inventory');
    const totalPlayerResources = getTotalResources(player.inventory);
    equipmentPlayerCapacityEl.textContent = `${totalPlayerResources} / ${CONFIG.PLAYER_MAX_RESOURCES}`;
    
    document.querySelectorAll('#equipment-slots .equipment-slot').forEach(slotEl => {
        const slotType = slotEl.dataset.slotType;
        const equippedItem = player.equipment[slotType];
        slotEl.innerHTML = '';
        if (equippedItem) {
            const li = document.createElement('div');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true');
            li.dataset.itemName = equippedItem.name;
            li.dataset.owner = 'equipment';
            li.dataset.slotType = slotType;
            li.innerHTML = `
                <span class="inventory-icon">${equippedItem.icon}</span>
                <span class="inventory-name">${equippedItem.name}</span>
            `;
            slotEl.appendChild(li);
        }
    });

    // MODIFIÉ: Utilise la constante importée directement
    const attack = (player.equipment.weapon?.stats?.damage || COMBAT_CONFIG.PLAYER_UNARMED_DAMAGE);
    const defense = (player.equipment.armor?.stats?.defense || 0);
    playerStatAttackEl.textContent = attack;
    playerStatDefenseEl.textContent = defense;
}

function drawSquaresBar(container, value, maxValue) {
    container.innerHTML = '';
    const numSquares = 10;
    const filledCount = Math.ceil((value / maxValue) * numSquares);
    for (let i = 0; i < numSquares; i++) {
        const square = document.createElement('div');
        square.classList.add('stat-square'); 
        square.classList.toggle('filled', i < filledCount);
        container.appendChild(square);
    }
}

function updateConsumeButtons(player) {
    const inv = player.inventory;
    const canDrink = inv['Eau'] && inv['Eau'] > 0;
    const canEat = (inv['Poisson Cuit'] && inv['Poisson Cuit'] > 0) || (inv['Poisson'] > 0);
    const canHeal = (inv['Poisson Cuit'] && inv['Poisson Cuit'] > 0) && player.health < 10;
    document.getElementById('consume-thirst-btn').disabled = !canDrink;
    document.getElementById('consume-hunger-btn').disabled = !canEat;
    document.getElementById('consume-health-btn').disabled = !canHeal;
}

function updateStatsPanel(player) {
    drawSquaresBar(healthBarSquaresEl, player.health, 10);
    drawSquaresBar(thirstBarSquaresEl, player.thirst, 100);
    drawSquaresBar(hungerBarSquaresEl, player.hunger, 100);
    drawSquaresBar(sleepBarSquaresEl, player.sleep, 100);
    healthStatusEl.textContent = player.status;
    healthBarSquaresEl.classList.toggle('pulsing', player.health <= 3);
    thirstBarSquaresEl.classList.toggle('pulsing', player.thirst <= 20);
    hungerBarSquaresEl.classList.toggle('pulsing', player.hunger <= 20);
    sleepBarSquaresEl.classList.toggle('pulsing', player.sleep <= 20);
    document.getElementById('survival-vignette').classList.toggle('active', player.health <= 3);
    updateConsumeButtons(player);
}

function updateInventory(player) {
    const inventoryListEl = document.getElementById('inventory-list');
    inventoryListEl.innerHTML = ''; 
    const inventory = player.inventory; 
    const total = getTotalResources(inventory); 
    inventoryCapacityEl.textContent = `(${total} / ${CONFIG.PLAYER_MAX_RESOURCES})`;

    if (Object.keys(inventory).length === 0) { 
        inventoryListEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; 
    } else { 
        for (const item in inventory) { 
            const li = document.createElement('li'); 
            const itemDef = ITEM_TYPES[item] || { icon: '❓' };
            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${item}</span><span class="inventory-count">${inventory[item]}</span>`; 
            li.classList.add('inventory-item'); 
            li.dataset.itemName = item; 
            inventoryListEl.appendChild(li); 
        } 
    }
}

function updateDayCounter(day) { 
    dayCounterEl.textContent = day; 
}

export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) return;
    const currentTile = gameState.map[gameState.player.y][gameState.player.x];
    updateStatsPanel(gameState.player);
    updateInventory(gameState.player);
    if (gameState.day) updateDayCounter(gameState.day);
    updateTileInfoPanel(currentTile);
    drawMinimap(gameState, CONFIG);
    hudCoordsEl.textContent = `(${gameState.player.x}, ${gameState.player.y})`;
}

export function showInventoryModal(gameState) {
    const { player, map } = gameState;
    const tile = map[player.y][player.x];
    if (!tile.inventory) {
        addChatMessage("Ce lieu n'a pas de stockage.", "system");
        return;
    }
    modalPlayerInventoryEl.innerHTML = '';
    modalSharedInventoryEl.innerHTML = '';
    populateInventoryList(player.inventory, modalPlayerInventoryEl, 'player');
    populateInventoryList(tile.inventory, modalSharedInventoryEl, 'shared');
    const totalPlayerResources = getTotalResources(player.inventory);
    modalPlayerCapacityEl.textContent = `${totalPlayerResources} / ${CONFIG.PLAYER_MAX_RESOURCES}`;
    inventoryModal.classList.remove('hidden');
}

export function hideInventoryModal() {
    inventoryModal.classList.add('hidden');
}

function populateInventoryList(inventory, listElement, owner) {
    if (Object.keys(inventory).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Vide)';
        listElement.appendChild(li);
    } else {
        for (const itemName in inventory) {
            const count = inventory[itemName];
            if (count <= 0) continue;
            const li = document.createElement('li');
            li.className = 'inventory-item';
            li.setAttribute('draggable', 'true'); 
            li.dataset.itemName = itemName;
            li.dataset.itemCount = count;
            li.dataset.owner = owner;
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            li.innerHTML = `
                <span class="inventory-icon">${itemDef.icon}</span>
                <span class="inventory-name">${itemName}</span>
                <span class="inventory-count">${count}</span>
            `;
            listElement.appendChild(li);
        }
    }
}

export function showQuantityModal(itemName, maxAmount, callback) {
    quantityModalTitle.textContent = `Transférer ${itemName}`;
    quantitySlider.max = maxAmount;
    quantitySlider.value = 1;
    quantityInput.max = maxAmount;
    quantityInput.value = 1;
    quantityConfirmCallback = callback;
    quantityModal.classList.remove('hidden');
}

export function hideQuantityModal() {
    quantityModal.classList.add('hidden');
    quantityConfirmCallback = null;
}

function setupQuantityModalListeners() {
    quantitySlider.addEventListener('input', () => { quantityInput.value = quantitySlider.value; });
    quantityInput.addEventListener('input', () => {
        const val = parseInt(quantityInput.value, 10);
        const max = parseInt(quantityInput.max, 10);
        if (isNaN(val) || val < 1) { quantityInput.value = 1; } 
        else if (val > max) { quantityInput.value = max; }
        quantitySlider.value = quantityInput.value;
    });
    quantityConfirmBtn.addEventListener('click', () => { if (quantityConfirmCallback) { quantityConfirmCallback(parseInt(quantityInput.value, 10)); } hideQuantityModal(); });
    quantityCancelBtn.addEventListener('click', hideQuantityModal);
    quantityMaxBtn.addEventListener('click', () => { quantityInput.value = quantityInput.max; quantitySlider.value = quantitySlider.max; });
    quantityShortcuts.addEventListener('click', (e) => { if (e.target.tagName === 'BUTTON' && e.target.dataset.amount) { const amount = Math.min(parseInt(e.target.dataset.amount, 10), quantityInput.max); quantityInput.value = amount; quantitySlider.value = amount; } });
}
setupQuantityModalListeners();

export function updateAllButtonsState(gameState) {
    const isPlayerBusy = gameState.player.isBusy || gameState.player.animationState;
    document.querySelectorAll('.nav-button-overlay, .consume-btn, #quick-chat-button').forEach(b => b.disabled = isPlayerBusy);
    actionsEl.querySelectorAll('button').forEach(b => { if (isPlayerBusy) b.disabled = true; });
}

export function addChatMessage(message, type, author) {
    const chatMessagesEl = document.getElementById('chat-messages');
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type);
    let content = author ? `<strong>${author}: </strong>` : '';
    content += `<span>${message}</span>`;
    msgDiv.innerHTML = content;
    chatMessagesEl.appendChild(msgDiv);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
}

export function showFloatingText(text, type) { const mainView = document.getElementById('main-view-container'); const textEl = document.createElement('div'); textEl.textContent = text; textEl.className = `floating-text ${type}`; const rect = mainView.getBoundingClientRect(); textEl.style.left = `${rect.left + rect.width / 2}px`; textEl.style.top = `${rect.top + rect.height / 3}px`; document.body.appendChild(textEl); setTimeout(() => { textEl.remove(); }, 2000); }
export function triggerActionFlash(type) { const flashEl = document.getElementById('action-flash'); flashEl.className = ''; void flashEl.offsetWidth; flashEl.classList.add(type === 'gain' ? 'flash-gain' : 'flash-cost'); }

export function triggerShake(element) {
    if (!element) return;
    element.classList.add('action-failed-shake');
    setTimeout(() => { element.classList.remove('action-failed-shake'); }, 500);
}