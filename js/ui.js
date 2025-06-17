// js/ui.js
import { CONFIG } from './config.js';
import { getTotalResources } from './player.js';

export const mainViewCanvas = document.getElementById('main-view-canvas'), mainViewCtx = mainViewCanvas.getContext('2d');
export const charactersCanvas = document.getElementById('characters-canvas'), charactersCtx = charactersCanvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas'), minimapCtx = minimapCanvas.getContext('2d');
export const tileNameEl = document.getElementById('tile-name'), tileDescriptionEl = document.getElementById('tile-description'), actionsEl = document.getElementById('actions'), chatInputEl = document.getElementById('chat-input-field');
const dayCounterEl = document.getElementById('day-counter'), healthBarEl = document.getElementById('health-bar'), thirstBarEl = document.getElementById('thirst-bar'), hungerBarEl = document.getElementById('hunger-bar'), sleepBarEl = document.getElementById('sleep-bar'), inventoryListEl = document.getElementById('inventory-list'), chatMessagesEl = document.getElementById('chat-messages');
export const hudCoordsEl = document.getElementById('hud-coords');
const tileHarvestsInfoEl = document.getElementById('tile-harvests-info');
const sharedInventorySectionEl = document.getElementById('shared-inventory-section');
const sharedInventoryListEl = document.getElementById('shared-inventory-list');
const inventoryCapacityEl = document.getElementById('inventory-capacity-display');

export const largeMapModal = document.getElementById('large-map-modal');
export const largeMapCanvas = document.getElementById('large-map-canvas');
const largeMapCtx = largeMapCanvas.getContext('2d');
export const enlargeMapBtn = document.getElementById('enlarge-map-btn');
export const closeLargeMapBtn = document.getElementById('close-large-map-btn');

const loadedAssets = {};
const ITEM_ICONS = { 'Bois': '🪵', 'Pierre': '🪨', 'Poisson': '🐟', 'Eau': '💧', 'Poisson Cuit': '🔥', 'default': '物品' };

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
    const { player, npcs } = gameState; charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height); const canvasWidth = charactersCanvas.width; const canvasHeight = charactersCanvas.height; const centerX = canvasWidth / 2; const centerY = canvasHeight / 2 + 100; const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y); const characterPositions = [{ char: player, x: centerX, y: centerY, isPlayer: true }]; if (visibleNpcs.length > 0) characterPositions.push({ char: visibleNpcs[0], x: centerX - 120, y: centerY }); if (visibleNpcs.length > 1) characterPositions.push({ char: visibleNpcs[1], x: centerX + 120, y: centerY }); if (player.animationState) { const { type, direction, progress } = player.animationState; const easeOut = 1 - Math.pow(1 - progress, 3); characterPositions.forEach(p => { let modX = 0, modY = 0; let distance = canvasWidth / 1.5 * easeOut; if (type === 'out') { if(direction === 'east') modX = distance; else if(direction === 'west') modX = -distance; else if(direction === 'south') modY = distance; else if(direction === 'north') modY = -distance; charactersCtx.globalAlpha = 1 - easeOut; } else { distance = canvasWidth / 1.5 * (1 - easeOut); if(direction === 'east') modX = -distance; else if(direction === 'west') modX = distance; else if(direction === 'south') modY = -distance; else if(direction === 'north') modY = distance; charactersCtx.globalAlpha = easeOut; } drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer); }); charactersCtx.globalAlpha = 1; } else { characterPositions.forEach(p => { drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer); }); }
}

export function updateTileInfoPanel(tile) {
    tileNameEl.textContent = tile.type.name; const descriptions = { 'Forêt': "L'air est lourd et humide...", 'Plaine': "Une plaine herbeuse...", 'Sable Doré': "Le sable chaud vous brûle les pieds...", 'Lagon': "L'eau turquoise vous invite...", 'Friche': "Le sol est nu...", 'Gisement de Pierre': "Des rochers affleurent...", 'Feu de Camp': "La chaleur des flammes danse...", 'Abri Individuel': "Un abri précaire...", 'Abri Collectif': "Un campement bien établi...", 'Mine': "L'entrée sombre de la mine..." }; tileDescriptionEl.textContent = descriptions[tile.type.name] || "Un lieu étrange...";
    if (tile.type.resource && tile.harvestsLeft > 0 && tile.type.harvests !== Infinity) { tileHarvestsInfoEl.textContent = `Récoltes restantes: ${tile.harvestsLeft}`; tileHarvestsInfoEl.style.display = 'block'; } else { tileHarvestsInfoEl.style.display = 'none'; }
}

function drawMinimap(gameState, config) { const { map, player, npcs } = gameState; const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config; minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE; minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE; minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height); for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff'; minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE); } } minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; minimapCtx.lineWidth = 1; for (let x = 0; x <= MAP_WIDTH; x++) { minimapCtx.beginPath(); minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height); minimapCtx.stroke(); } for (let y = 0; y <= MAP_HEIGHT; y++) { minimapCtx.beginPath(); minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE); minimapCtx.stroke(); } npcs.forEach(npc => { minimapCtx.fillStyle = npc.color; minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE); }); minimapCtx.fillStyle = player.color || 'yellow'; minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE); minimapCtx.strokeStyle = 'white'; minimapCtx.lineWidth = 2; minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2); }

export function drawLargeMap(gameState, config) { const { map, player, npcs } = gameState; const { MAP_WIDTH, MAP_HEIGHT } = config; const cellSize = Math.min(largeMapCanvas.parentElement.clientWidth / MAP_WIDTH, largeMapCanvas.parentElement.clientHeight / MAP_HEIGHT, 40); largeMapCanvas.width = MAP_WIDTH * cellSize; largeMapCanvas.height = MAP_HEIGHT * cellSize; largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height); for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { const tile = map[y][x]; largeMapCtx.fillStyle = tile.type.color || '#ff00ff'; largeMapCtx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize); largeMapCtx.fillStyle = 'rgba(255, 255, 255, 0.8)'; largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`; largeMapCtx.textAlign = 'center'; largeMapCtx.textBaseline = 'middle'; largeMapCtx.fillText(tile.type.name.charAt(0), x * cellSize + cellSize / 2, y * cellSize + cellSize / 2); } } largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)'; largeMapCtx.lineWidth = 1; for (let i = 0; i <= MAP_WIDTH; i++) { largeMapCtx.beginPath(); largeMapCtx.moveTo(i * cellSize, 0); largeMapCtx.lineTo(i * cellSize, largeMapCanvas.height); largeMapCtx.stroke(); } for (let i = 0; i <= MAP_HEIGHT; i++) { largeMapCtx.beginPath(); largeMapCtx.moveTo(0, i * cellSize); largeMapCtx.lineTo(largeMapCanvas.width, i * cellSize); largeMapCtx.stroke(); } npcs.forEach(npc => { largeMapCtx.fillStyle = npc.color; largeMapCtx.beginPath(); largeMapCtx.arc(npc.x * cellSize + cellSize / 2, npc.y * cellSize + cellSize / 2, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill(); }); largeMapCtx.fillStyle = player.color; largeMapCtx.beginPath(); largeMapCtx.arc(player.x * cellSize + cellSize / 2, player.y * cellSize + cellSize / 2, cellSize * 0.4, 0, Math.PI * 2); largeMapCtx.fill(); largeMapCtx.strokeStyle = 'white'; largeMapCtx.lineWidth = 3; largeMapCtx.stroke(); }

function updateConsumeButtons(player) {
    const inv = player.inventory; const canDrink = inv['Eau'] && inv['Eau'] > 0; const canEat = (inv['Poisson Cuit'] && inv['Poisson Cuit'] > 0) || (inv['Poisson'] && inv['Poisson'] > 0); const canHeal = inv['Poisson Cuit'] && inv['Poisson Cuit'] > 0; document.getElementById('consume-thirst-btn').disabled = !canDrink; document.getElementById('consume-hunger-btn').disabled = !canEat; document.getElementById('consume-health-btn').disabled = !canHeal;
}

function updateStatsPanel(player) { healthBarEl.style.width = `${player.health}%`; thirstBarEl.style.width = `${player.thirst}%`; hungerBarEl.style.width = `${player.hunger}%`; sleepBarEl.style.width = `${player.sleep}%`; healthBarEl.classList.toggle('pulsing', player.health <= 25); thirstBarEl.classList.toggle('pulsing', player.thirst <= 20); hungerBarEl.classList.toggle('pulsing', player.hunger <= 20); const vignetteEl = document.getElementById('survival-vignette'); vignetteEl.classList.toggle('active', player.health <= 35); updateConsumeButtons(player); }

function updateInventory(player) {
    inventoryListEl.innerHTML = ''; const inventory = player.inventory; const total = getTotalResources(inventory); inventoryCapacityEl.textContent = `(${total} / ${CONFIG.PLAYER_MAX_RESOURCES})`;
    if (Object.keys(inventory).length === 0) { inventoryListEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; } else { for (const item in inventory) { const li = document.createElement('li'); const icon = ITEM_ICONS[item] || ITEM_ICONS.default; li.innerHTML = `<span class="inventory-icon">${icon}</span><span class="inventory-name">${item}</span><span class="inventory-count">${inventory[item]}</span>`; li.classList.add('inventory-item'); li.dataset.itemName = item; inventoryListEl.appendChild(li); } }
}

function updateSharedInventory(tile, player) {
    if (tile.inventory) {
        sharedInventorySectionEl.classList.remove('hidden'); sharedInventoryListEl.innerHTML = '';
        const isPlayerInventoryFull = getTotalResources(player.inventory) >= CONFIG.PLAYER_MAX_RESOURCES;
        const allItemKeys = new Set([ ...Object.keys(tile.inventory || {}), ...Object.keys(player.inventory || {}) ]);
        if (allItemKeys.size === 0) { sharedInventoryListEl.innerHTML = '<li class="inventory-empty">(Vide)</li>'; return; }
        allItemKeys.forEach(itemName => {
            const sharedCount = tile.inventory[itemName] || 0; const playerCount = player.inventory[itemName] || 0; const icon = ITEM_ICONS[itemName] || ITEM_ICONS.default;
            const canWithdraw = sharedCount > 0 && !isPlayerInventoryFull; const canDeposit = playerCount > 0;
            const li = document.createElement('li'); li.classList.add('shared-inventory-item');
            li.innerHTML = `
                <span class="inventory-icon">${icon}</span>
                <span class="inventory-name">${itemName}</span>
                <span class="inventory-count">${sharedCount}</span>
                <div class="item-actions">
                    <button class="withdraw-btn" data-item-name="${itemName}" title="Prendre 1" ${!canWithdraw ? 'disabled' : ''}>-</button>
                    <button class="deposit-btn" data-item-name="${itemName}" title="Déposer 1 (Vous en avez ${playerCount})" ${!canDeposit ? 'disabled' : ''}>+</button>
                </div>
            `;
            sharedInventoryListEl.appendChild(li);
        });
    } else {
        sharedInventorySectionEl.classList.add('hidden');
    }
}

function updateDayCounter(day) { dayCounterEl.textContent = day; }

export function updateAllUI(gameState) {
    if (!gameState || !gameState.player) return;
    const currentTile = gameState.map[gameState.player.y][gameState.player.x];
    updateStatsPanel(gameState.player); updateInventory(gameState.player); if (gameState.day) updateDayCounter(gameState.day); updateTileInfoPanel(currentTile); updateSharedInventory(currentTile, gameState.player); drawMinimap(gameState, CONFIG); hudCoordsEl.textContent = `(${gameState.player.x}, ${gameState.player.y})`;
}

export function updateAllButtonsState(gameState) {
    const isPlayerBusy = gameState.player.isBusy || gameState.player.animationState;
    document.querySelectorAll('.nav-button-overlay, .consume-btn, #quick-chat-button').forEach(b => b.disabled = isPlayerBusy);
    actionsEl.querySelectorAll('button').forEach(b => { if (isPlayerBusy) b.disabled = true; });
}

export function addChatMessage(message, type, author) {
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

// NOUVEAU : Fonction pour secouer un élément de l'UI en cas d'échec
export function triggerShake(element) {
    if (!element) return;
    element.classList.add('action-failed-shake');
    setTimeout(() => {
        element.classList.remove('action-failed-shake');
    }, 500); // Doit correspondre à la durée de l'animation CSS
}