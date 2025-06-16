// js/ui.js
import { SPRITESHEET_DATA, CONFIG } from './config.js';

export const mainViewCanvas = document.getElementById('main-view-canvas'), mainViewCtx = mainViewCanvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas'), minimapCtx = minimapCanvas.getContext('2d');
export const tileNameEl = document.getElementById('tile-name'), tileDescriptionEl = document.getElementById('tile-description'), actionsEl = document.getElementById('actions'), chatInputEl = document.getElementById('chat-input-field');
const dayCounterEl = document.getElementById('day-counter'), healthBarEl = document.getElementById('health-bar'), thirstBarEl = document.getElementById('thirst-bar'), hungerBarEl = document.getElementById('hunger-bar'), sleepBarEl = document.getElementById('sleep-bar'), inventoryListEl = document.getElementById('inventory-list'), chatMessagesEl = document.getElementById('chat-messages');

const loadedAssets = {};
export function loadAssets(paths) { const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => { const img = new Image(); img.src = src; img.onload = () => { loadedAssets[key] = img; resolve(); }; img.onerror = (err) => reject(new Error(`Failed to load ${src}: ${err}`)); })); return Promise.all(promises); }

export function draw(gameState) {
    if (Object.keys(loadedAssets).length === 0) return;
    
    mainViewCtx.clearRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
    
    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const backgroundKey = playerTile.type.background; 
    const imageToDraw = loadedAssets[backgroundKey];

    if (imageToDraw) {
        mainViewCtx.drawImage(imageToDraw, 0, 0, mainViewCanvas.width, mainViewCanvas.height);
    } else {
        mainViewCtx.fillStyle = '#ff00ff';
        mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        mainViewCtx.fillStyle = 'white';
        mainViewCtx.fillText(`Image de fond '${backgroundKey}' non trouvée`, 20, 40);
    }
}

export function updateTileInfoPanel(tile) {
    tileNameEl.textContent = tile.type.name;
    const descriptions = { 'Forêt': "L'air est lourd et humide. Des bruits d'insectes emplissent l'atmosphère.", 'Plaine': "Une plaine herbeuse balayée par le vent. Un bon endroit pour construire.", 'Sable Doré': "Le sable chaud vous brûle la plante des pieds. Le bruit des vagues est constant.", 'Lagon': "L'eau turquoise et cristalline vous invite à la baignade.", 'Friche': "Le sol est nu, marqué par les souches des arbres abattus.", 'Abri Individuel': "Un abri précaire mais qui protège du vent.", 'Abri Collectif': "Un campement bien établi. Un sentiment de sécurité vous envahit.", 'Mine': "L'entrée sombre de la mine sent la terre humide et le renfermé." };
    tileDescriptionEl.textContent = descriptions[tile.type.name] || "Un lieu étrange et inconnu...";
}

/**
 * MINIMAP MISE À JOUR : Ajout d'un quadrillage pour une meilleure lisibilité.
 */
function drawMinimap(gameState, config) {
    const { map, player, npcs } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Dessin des cases de la carte
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff';
            minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
        }
    }
    
    // NOUVEAU : Dessin du quadrillage
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) {
        minimapCtx.beginPath();
        minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0);
        minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height);
        minimapCtx.stroke();
    }
    for (let y = 0; y <= MAP_HEIGHT; y++) {
        minimapCtx.beginPath();
        minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE);
        minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE);
        minimapCtx.stroke();
    }

    // Dessin des PNJ
    npcs.forEach(npc => {
        minimapCtx.fillStyle = npc.color;
        minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    });
    
    // Dessin du joueur
    minimapCtx.fillStyle = player.color || 'yellow';
    minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 2; // Ligne plus épaisse pour le joueur
    minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);
}

export function updateAllUI(gameState, config) { if(!gameState || !gameState.player) return; updateStatsPanel(gameState.player); updateInventory(gameState.player); if(gameState.day) updateDayCounter(gameState.day); const currentTile = gameState.map[gameState.player.y][gameState.player.x]; updateTileInfoPanel(currentTile); drawMinimap(gameState, config); }
function updateStatsPanel(player) { healthBarEl.style.width = `${player.health}%`; thirstBarEl.style.width = `${player.thirst}%`; hungerBarEl.style.width = `${player.hunger}%`; sleepBarEl.style.width = `${player.sleep}%`; }
function updateInventory(player) { inventoryListEl.innerHTML = ''; const inventory = player.inventory; if (Object.keys(inventory).length === 0) { inventoryListEl.innerHTML = '<li>(Vide)</li>'; } else { for (const item in inventory) { const li = document.createElement('li'); li.textContent = `${item}: ${inventory[item]}`; li.classList.add('inventory-item'); li.dataset.itemName = item; inventoryListEl.appendChild(li); } } }
function updateDayCounter(day) { dayCounterEl.textContent = day; }
export function addChatMessage(message, type, author) { const msgDiv = document.createElement('div'); msgDiv.classList.add('chat-message', type); let content = author ? `<strong>${author}: </strong>` : ''; content += `<span>${message}</span>`; msgDiv.innerHTML = content; chatMessagesEl.appendChild(msgDiv); chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; }