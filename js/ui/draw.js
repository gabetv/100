// js/ui/draw.js
import { TILE_TYPES, CONFIG } from '../config.js'; // Ajout CONFIG pour FOG_OF_WAR_REVEAL_THRESHOLD | '../' pour remonter de 'ui' à 'js'
import DOM from './dom.js'; // './' car dom.js est dans le même dossier 'ui'

const loadedAssets = {};

const TILE_ICONS = { 
    'Lagon': '🌊', 'Plage': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Gisement de Pierre': '⛰️', 'Feu de Camp': '🔥',
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine': '⛏️',
    'Trésor Caché': TILE_TYPES.TREASURE_CHEST.icon || '💎',
    'default': '❓'
};

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            loadedAssets[key] = img;
            resolve();
        };
        img.onerror = (err) => {
            console.error(`Failed to load ${key} from ${src}:`, err);
            reject(new Error(`Failed to load ${src}: ${err}`));
        };
    }));
    return Promise.all(promises);
}

export function drawMainBackground(gameState) {
    const { mainViewCtx, mainViewCanvas } = DOM;
    if (!mainViewCtx || !mainViewCanvas) return;

    if (!gameState || !gameState.player || !gameState.map ||
        !gameState.map[gameState.player.y] || !gameState.map[gameState.player.y][gameState.player.x]) {
        mainViewCtx.fillStyle = 'grey';
        mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        mainViewCtx.fillStyle = 'white';
        mainViewCtx.fillText("Données de jeu manquantes pour le fond", 20, 40);
        return;
    }

    const playerTile = gameState.map[gameState.player.y][gameState.player.x];
    const backgroundKey = playerTile.backgroundKey;
    const imageToDraw = loadedAssets[backgroundKey];

    mainViewCtx.fillStyle = 'black';
    mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);

    if (imageToDraw) {
        if (imageToDraw.complete && imageToDraw.naturalWidth > 0 && imageToDraw.naturalHeight > 0) {
            const canvasAspect = mainViewCanvas.width / mainViewCanvas.height;
            const imageAspect = imageToDraw.naturalWidth / imageToDraw.naturalHeight;
            let sx = 0, sy = 0, sWidth = imageToDraw.naturalWidth, sHeight = imageToDraw.naturalHeight;

            if (imageAspect > canvasAspect) {
                sHeight = imageToDraw.naturalHeight;
                sWidth = sHeight * canvasAspect;
                sx = (imageToDraw.naturalWidth - sWidth) / 2;
            } else if (imageAspect < canvasAspect) {
                sWidth = imageToDraw.naturalWidth;
                sHeight = sWidth / canvasAspect;
                sy = (imageToDraw.naturalHeight - sHeight) / 2;
            }
            mainViewCtx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, 0, 0, mainViewCanvas.width, mainViewCanvas.height);
        } else {
            mainViewCtx.fillStyle = '#333';
            mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        }
    } else {
        mainViewCtx.fillStyle = '#222';
        mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
    }
}

function drawCharacter(ctx, character, x, y, isPlayer = false) {
    const headRadius = 18;
    const bodyWidth = 30;
    const bodyShoulderWidth = 20;
    const bodyHeight = 45;
    const neckHeight = 3;

    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.fillStyle = character.color;

    const headCenterY = y - bodyHeight / 2 - neckHeight - headRadius;
    const bodyTopY = headCenterY + headRadius + neckHeight;
    const bodyBottomY = bodyTopY + bodyHeight;

    ctx.beginPath();
    ctx.moveTo(x - bodyWidth / 2, bodyBottomY);
    ctx.lineTo(x + bodyWidth / 2, bodyBottomY);
    ctx.lineTo(x + bodyShoulderWidth / 2, bodyTopY);
    ctx.lineTo(x - bodyShoulderWidth / 2, bodyTopY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (isPlayer) {
        ctx.fillStyle = '#8b4513';
        ctx.strokeStyle = '#5a2d0c';
        ctx.lineWidth = 3;
        const handX = x - bodyWidth / 2 - 12;
        const handY = bodyTopY + bodyHeight * 0.3;
        ctx.beginPath();
        ctx.arc(handX, handY, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}


export function drawSceneCharacters(gameState) {
    if (!gameState || !gameState.player) return;
    const { player, npcs, enemies } = gameState;
    const { charactersCtx, charactersCanvas } = DOM;
    if (!charactersCtx || !charactersCanvas) return;

    charactersCtx.clearRect(0, 0, charactersCanvas.width, charactersCanvas.height);
    const canvasWidth = charactersCanvas.width;
    const canvasHeight = charactersCanvas.height;

    const playerBaseX = canvasWidth / 2;
    const playerBaseY = canvasHeight * 0.70;

    const charactersOnTile = [];
    charactersOnTile.push({ char: player, x: playerBaseX, y: playerBaseY, isPlayer: true, sortOrder: 1 });

    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    visibleNpcs.forEach((npc, index) => {
        const sideOffset = (index % 2 === 0) ? -1 : 1;
        const distanceOffset = 100 + (Math.floor(index / 2) * 40);
        const offsetX = sideOffset * distanceOffset;
        charactersOnTile.push({ char: npc, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 });
    });

    charactersOnTile.sort((a, b) => a.sortOrder - b.sortOrder);

    if (player.animationState) {
        const { type, direction, progress } = player.animationState;
        const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const easedProgress = easeInOutCubic(progress);

        charactersOnTile.forEach(p => {
            let modX = 0, modY = 0;
            let distanceFactor = p.isPlayer ? 1 : 0.9;
            let baseDistance = (canvasWidth / 2) + (p.char.bodyWidth || 30) + 20;

            if (type === 'out') {
                let distance = baseDistance * easedProgress * distanceFactor;
                if(direction === 'east') modX = distance;
                else if(direction === 'west') modX = -distance;
                else if(direction === 'south') modY = distance;
                else if(direction === 'north') modY = -distance;
                charactersCtx.globalAlpha = 1 - easedProgress;
            } else {
                let distance = baseDistance * (1 - easedProgress) * distanceFactor;
                if(direction === 'east') modX = -distance;
                else if(direction === 'west') modX = distance;
                else if(direction === 'south') modY = -distance;
                else if(direction === 'north') modY = distance;
                charactersCtx.globalAlpha = easedProgress;
            }
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer);
        });
        charactersCtx.globalAlpha = 1;
    } else {
        charactersOnTile.forEach(p => {
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer);
        });
    }

    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !gameState.combatState);
    if (visibleEnemies.length > 0) {
        const enemy = visibleEnemies[0];
        const enemyX = canvasWidth / 2;
        const enemyY = canvasHeight * 0.30;
        charactersCtx.save();
        charactersCtx.fillStyle = enemy.color || '#ff0000';
        charactersCtx.font = "70px sans-serif";
        charactersCtx.textAlign = 'center';
        charactersCtx.textBaseline = 'middle';
        charactersCtx.fillText(enemy.icon || '❓', enemyX, enemyY);
        charactersCtx.restore();
    }
}

export function drawMinimap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState; 
    const { MAP_WIDTH, MAP_HEIGHT, MINIMAP_DOT_SIZE } = config;
    const { minimapCanvas, minimapCtx } = DOM;
    if(!minimapCtx || !minimapCanvas) return;

    minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            if (!player.visitedTiles.has(tileKey) && !globallyRevealedTiles.has(tileKey)) {
                minimapCtx.fillStyle = '#111'; 
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            } else if (map[y] && map[y][x] && map[y][x].type) {
                minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff';
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            }
        }
    }
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) { minimapCtx.beginPath(); minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height); minimapCtx.stroke(); }
    for (let y = 0; y <= MAP_HEIGHT; y++) { minimapCtx.beginPath(); minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE); minimapCtx.stroke(); }

    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            minimapCtx.fillStyle = npc.color;
            minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
        }
    });

    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            minimapCtx.fillStyle = enemy.color || '#ff0000';
            const ex = enemy.x * MINIMAP_DOT_SIZE;
            const ey = enemy.y * MINIMAP_DOT_SIZE;
            minimapCtx.beginPath();
            minimapCtx.moveTo(ex, ey + MINIMAP_DOT_SIZE);
            minimapCtx.lineTo(ex + MINIMAP_DOT_SIZE / 2, ey);
            minimapCtx.lineTo(ex + MINIMAP_DOT_SIZE, ey + MINIMAP_DOT_SIZE);
            minimapCtx.closePath();
            minimapCtx.fill();
        }
    });

    minimapCtx.fillStyle = player.color || 'yellow';
    minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);
}

export function drawLargeMap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState; 
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const { largeMapCanvas, largeMapCtx } = DOM;
    if(!largeMapCtx || !largeMapCanvas) return;

    const headerSize = 30;
    const parentWrapper = largeMapCanvas.parentElement;
    if (!parentWrapper) return;

    const legendWidth = DOM.largeMapLegendEl ? DOM.largeMapLegendEl.offsetWidth + 20 : 0;
    const availableWidth = parentWrapper.clientWidth - legendWidth - 40 ;
    const availableHeight = parentWrapper.clientHeight - 40;

    let canvasSize = Math.min(availableWidth, availableHeight);
    canvasSize = Math.max(canvasSize, 200);

    largeMapCanvas.width = canvasSize;
    largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT);

    largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);
    largeMapCtx.fillStyle = '#1d3557';
    largeMapCtx.fillRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;

            if (!player.visitedTiles.has(tileKey) && !globallyRevealedTiles.has(tileKey)) {
                largeMapCtx.fillStyle = '#000'; 
                largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
                continue;
            }

            if (!map[y] || !map[y][x] || !map[y][x].type) continue;
            const tile = map[y][x];
            largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);

            const icon = tile.type.icon || TILE_ICONS[tile.type.name] || TILE_ICONS.default;
            largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            let iconOffsetY = 0;
            if (icon === '💎' || icon === '🌊' || icon === '🏖️' || icon === '🍂' || icon === '🔥' || icon === '⛏️' || icon === '⛺' || icon === '🏠') {
                iconOffsetY = cellSize * 0.05;
            }
            largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2 + iconOffsetY);
        }
    }

    largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    largeMapCtx.lineWidth = 1;
    largeMapCtx.fillStyle = '#f1faee';
    largeMapCtx.font = `600 ${Math.min(14, headerSize * 0.5)}px Poppins`;
    largeMapCtx.textAlign = 'center';
    largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const xCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, xCoordText, headerSize / 2);
        const lineX = headerSize + i * cellSize;
        if (i > 0) {
            largeMapCtx.beginPath(); largeMapCtx.moveTo(lineX, headerSize); largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); largeMapCtx.stroke();
        }
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const yCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, headerSize / 2, yCoordText);
        const lineY = headerSize + i * cellSize;
        if (i > 0) {
            largeMapCtx.beginPath(); largeMapCtx.moveTo(headerSize, lineY); largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); largeMapCtx.stroke();
        }
    }
    largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + npc.x * cellSize + cellSize / 2;
            const drawY = headerSize + npc.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = npc.color;
            largeMapCtx.beginPath(); largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill();
        }
    });

    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
            const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = enemy.color || '#ff0000';
            largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`;
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            largeMapCtx.fillText(enemy.icon || '❓', drawX, drawY);
        }
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
    const { largeMapLegendEl } = DOM;
    if(!largeMapLegendEl) return;

    largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set();

    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) {
            const item = document.createElement('div');
            item.className = 'legend-item';
            const icon = tileType.icon || TILE_ICONS[tileType.name] || TILE_ICONS.default;
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
    const enemyItem = document.createElement('div');
    enemyItem.className = 'legend-item';
    enemyItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #dc2626;">▲</div><span>Ennemis</span>`;
    largeMapLegendEl.appendChild(enemyItem);
    const unknownItem = document.createElement('div'); 
    unknownItem.className = 'legend-item';
    unknownItem.innerHTML = `<div class="legend-color-box" style="background-color: #000;"></div><span>Non découvert</span>`;
    largeMapLegendEl.appendChild(unknownItem);
}