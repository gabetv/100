// js/ui/draw.js
import { TILE_TYPES } from '../config.js';
import * as DOM from './dom.js';

const loadedAssets = {};

const TILE_ICONS = {
    'Lagon': '🌊', 'Sable Doré': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Gisement de Pierre': '⛰️', 'Feu de Camp': '🔥',
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine': '⛏️',
    'default': '❓'
};

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => {
        const img = new Image(); img.src = src; img.onload = () => { loadedAssets[key] = img; resolve(); }; img.onerror = (err) => reject(new Error(`Failed to load ${src}: ${err}`));
    }));
    return Promise.all(promises);
}

export function drawMainBackground(gameState) {
    if (Object.keys(loadedAssets).length === 0) return;
    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const backgroundKey = playerTile.backgroundKey;
    const imageToDraw = loadedAssets[backgroundKey];
    DOM.mainViewCtx.fillStyle = 'black';
    DOM.mainViewCtx.fillRect(0, 0, DOM.mainViewCanvas.width, DOM.mainViewCanvas.height);

    if (imageToDraw) {
        const canvasAspect = 1.0;
        const imageAspect = imageToDraw.width / imageToDraw.height;
        let sx, sy, sWidth, sHeight;
        if (imageAspect > canvasAspect) {
            sHeight = imageToDraw.height;
            sWidth = sHeight * canvasAspect;
            sx = (imageToDraw.width - sWidth) / 2;
            sy = 0;
        } else {
            sWidth = imageToDraw.width;
            sHeight = sWidth / canvasAspect;
            sx = 0;
            sy = (imageToDraw.height - sHeight) / 2;
        }
        DOM.mainViewCtx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, 0, 0, DOM.mainViewCanvas.width, DOM.mainViewCanvas.height);
    } else {
        DOM.mainViewCtx.fillStyle = 'white';
        DOM.mainViewCtx.fillText(`Image de fond '${backgroundKey}' non trouvée`, 20, 40);
    }
}

function drawCharacter(ctx, character, x, y, isPlayer = false) {
    const headRadius = 18;
    const bodyWidth = 30;
    const bodyHeight = 45;
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.fillStyle = character.color;
    ctx.beginPath();
    ctx.moveTo(x - bodyWidth / 2, y + bodyHeight);
    ctx.lineTo(x + bodyWidth / 2, y + bodyHeight);
    ctx.lineTo(x + bodyWidth / 2 - 5, y);
    ctx.lineTo(x - bodyWidth / 2 + 5, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - headRadius / 2, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isPlayer) {
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5a2d0c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(x - bodyWidth/2 - 8, y + 10, 10, 25, 5);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

export function drawSceneCharacters(gameState) {
    const { player, npcs, enemies } = gameState;
    DOM.charactersCtx.clearRect(0, 0, DOM.charactersCanvas.width, DOM.charactersCanvas.height);
    const canvasWidth = DOM.charactersCanvas.width;
    const canvasHeight = DOM.charactersCanvas.height;
    
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
                DOM.charactersCtx.globalAlpha = 1 - easeOut;
            } else {
                distance = canvasWidth / 1.5 * (1 - easeOut);
                if(direction === 'east') modX = -distance; else if(direction === 'west') modX = distance;
                else if(direction === 'south') modY = -distance; else if(direction === 'north') modY = distance;
                DOM.charactersCtx.globalAlpha = easeOut;
            }
            drawCharacter(DOM.charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer);
        });
        DOM.charactersCtx.globalAlpha = 1;
    } else {
        characterPositions.forEach(p => {
            drawCharacter(DOM.charactersCtx, p.char, p.x, p.y, p.isPlayer);
        });
    }

    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !gameState.combatState);
    if (visibleEnemies.length > 0) {
        const enemy = visibleEnemies[0];
        const enemyX = canvasWidth / 2;
        const enemyY = canvasHeight / 2 - 100;
        DOM.charactersCtx.save();
        DOM.charactersCtx.fillStyle = enemy.color;
        DOM.charactersCtx.font = "80px sans-serif";
        DOM.charactersCtx.textAlign = 'center';
        DOM.charactersCtx.fillText(enemy.icon, enemyX, enemyY);
        DOM.charactersCtx.restore();
    }
}

export function drawMinimap(gameState, config) {
    const { map, player, npcs, enemies } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    DOM.minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    DOM.minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    DOM.minimapCtx.clearRect(0, 0, DOM.minimapCanvas.width, DOM.minimapCanvas.height);
    for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { DOM.minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff'; DOM.minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE); } }
    DOM.minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    DOM.minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) { DOM.minimapCtx.beginPath(); DOM.minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); DOM.minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, DOM.minimapCanvas.height); DOM.minimapCtx.stroke(); }
    for (let y = 0; y <= MAP_HEIGHT; y++) { DOM.minimapCtx.beginPath(); DOM.minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); DOM.minimapCtx.lineTo(DOM.minimapCanvas.width, y * MINIMAP_DOT_SIZE); DOM.minimapCtx.stroke(); }
    
    npcs.forEach(npc => {
        DOM.minimapCtx.fillStyle = npc.color;
        DOM.minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    });
    
    enemies.forEach(enemy => {
        DOM.minimapCtx.fillStyle = enemy.color;
        const x = enemy.x * MINIMAP_DOT_SIZE;
        const y = enemy.y * MINIMAP_DOT_SIZE;
        DOM.minimapCtx.beginPath();
        DOM.minimapCtx.moveTo(x, y + MINIMAP_DOT_SIZE);
        DOM.minimapCtx.lineTo(x + MINIMAP_DOT_SIZE / 2, y);
        DOM.minimapCtx.lineTo(x + MINIMAP_DOT_SIZE, y + MINIMAP_DOT_SIZE);
        DOM.minimapCtx.closePath();
        DOM.minimapCtx.fill();
    });

    DOM.minimapCtx.fillStyle = player.color || 'yellow';
    DOM.minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    DOM.minimapCtx.strokeStyle = 'white';
    DOM.minimapCtx.lineWidth = 2;
    DOM.minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);
}

export function drawLargeMap(gameState, config) {
    const { map, player, npcs, enemies } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const headerSize = 30;
    const availableHeight = DOM.largeMapCanvas.parentElement.clientHeight - 40;
    const canvasSize = availableHeight;
    DOM.largeMapCanvas.width = canvasSize;
    DOM.largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT);

    DOM.largeMapCtx.clearRect(0, 0, DOM.largeMapCanvas.width, DOM.largeMapCanvas.height);
    DOM.largeMapCtx.fillStyle = '#1d3557';
    DOM.largeMapCtx.fillRect(0, 0, DOM.largeMapCanvas.width, DOM.largeMapCanvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;
            DOM.largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            DOM.largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
            const icon = TILE_ICONS[tile.type.name] || TILE_ICONS.default;
            DOM.largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            DOM.largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
            DOM.largeMapCtx.textAlign = 'center';
            DOM.largeMapCtx.textBaseline = 'middle';
            DOM.largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2);
        }
    }

    DOM.largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    DOM.largeMapCtx.lineWidth = 1;
    DOM.largeMapCtx.fillStyle = '#f1faee';
    DOM.largeMapCtx.font = `600 ${headerSize * 0.5}px Poppins`;
    DOM.largeMapCtx.textAlign = 'center';
    DOM.largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const x = headerSize + (i + 0.5) * cellSize;
        DOM.largeMapCtx.fillText(i, x, headerSize / 2);
        const lineX = headerSize + i * cellSize;
        DOM.largeMapCtx.beginPath(); DOM.largeMapCtx.moveTo(lineX, headerSize); DOM.largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); DOM.largeMapCtx.stroke();
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const y = headerSize + (i + 0.5) * cellSize;
        DOM.largeMapCtx.fillText(i, headerSize / 2, y);
        const lineY = headerSize + i * cellSize;
        DOM.largeMapCtx.beginPath(); DOM.largeMapCtx.moveTo(headerSize, lineY); DOM.largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); DOM.largeMapCtx.stroke();
    }
    DOM.largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    npcs.forEach(npc => {
        const drawX = headerSize + npc.x * cellSize + cellSize / 2;
        const drawY = headerSize + npc.y * cellSize + cellSize / 2;
        DOM.largeMapCtx.fillStyle = npc.color;
        DOM.largeMapCtx.beginPath(); DOM.largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); DOM.largeMapCtx.fill();
    });
    
    enemies.forEach(enemy => {
        const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
        const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
        DOM.largeMapCtx.fillStyle = enemy.color;
        DOM.largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`;
        DOM.largeMapCtx.textAlign = 'center';
        DOM.largeMapCtx.textBaseline = 'middle';
        DOM.largeMapCtx.fillText(enemy.icon, drawX, drawY);
    });

    const playerDrawX = headerSize + player.x * cellSize + cellSize / 2;
    const playerDrawY = headerSize + player.y * cellSize + cellSize / 2;
    DOM.largeMapCtx.fillStyle = player.color;
    DOM.largeMapCtx.beginPath(); DOM.largeMapCtx.arc(playerDrawX, playerDrawY, cellSize * 0.4, 0, Math.PI * 2); DOM.largeMapCtx.fill();
    DOM.largeMapCtx.strokeStyle = 'white';
    DOM.largeMapCtx.lineWidth = 3;
    DOM.largeMapCtx.stroke();
}

export function populateLargeMapLegend() {
    DOM.largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set();
    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const icon = TILE_ICONS[tileType.name] || TILE_ICONS.default;
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${icon} ${tileType.name}</span>`;
            DOM.largeMapLegendEl.appendChild(item);
            addedTypes.add(tileType.name);
        }
    }
    DOM.largeMapLegendEl.insertAdjacentHTML('beforeend', '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">');
    const playerItem = document.createElement('div');
    playerItem.className = 'legend-item';
    playerItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ffd700;">●</div><span>Vous</span>`;
    DOM.largeMapLegendEl.appendChild(playerItem);
    const npcItem = document.createElement('div');
    npcItem.className = 'legend-item';
    npcItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ff6347;">●</div><span>Survivants (PNJ)</span>`;
    DOM.largeMapLegendEl.appendChild(npcItem);
}