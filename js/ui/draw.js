import { TILE_TYPES, CONFIG } from '../config.js';
import DOM from './dom.js';

const loadedAssets = {};

const TILE_ICONS = { // Utilisé comme fallback si tile.type.icon n'est pas défini
    'Lagon': '🌊', 'Plage': '🏖️', 'Forêt': '🌲', 'Friche': '🍂',
    'Plaine': '🌳', 'Mine': '⛰️', 'Feu de Camp': '🔥', // #29 Gisement de Pierre -> Mine (terrain)
    'Abri Individuel': '⛺', 'Abri Collectif': '🏠', 'Mine (Bâtiment)': '⛏️🏭', // #29 Renamed Mine building
    // Trésor Caché utilise déjà TILE_TYPES.TREASURE_CHEST.icon
    'default': '❓'
};

export function loadAssets(paths) {
    const promises = Object.entries(paths).map(([key, src]) => new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src + '?v=' + new Date().getTime(); // Cache busting for development
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

    mainViewCtx.fillStyle = 'black'; // Fond noir par défaut
    mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);

    if (imageToDraw) {
        if (imageToDraw.complete && imageToDraw.naturalWidth > 0 && imageToDraw.naturalHeight > 0) {
            const canvasAspect = mainViewCanvas.width / mainViewCanvas.height;
            const imageAspect = imageToDraw.naturalWidth / imageToDraw.naturalHeight;
            let sx = 0, sy = 0, sWidth = imageToDraw.naturalWidth, sHeight = imageToDraw.naturalHeight;

            // Calcul pour rogner l'image et remplir le canvas en gardant l'aspect ratio (cover)
            if (imageAspect > canvasAspect) { // Image plus large que le canvas
                sHeight = imageToDraw.naturalHeight;
                sWidth = sHeight * canvasAspect;
                sx = (imageToDraw.naturalWidth - sWidth) / 2;
            } else if (imageAspect < canvasAspect) { // Image plus haute que le canvas
                sWidth = imageToDraw.naturalWidth;
                sHeight = sWidth / canvasAspect;
                sy = (imageToDraw.naturalHeight - sHeight) / 2;
            }
            mainViewCtx.drawImage(imageToDraw, sx, sy, sWidth, sHeight, 0, 0, mainViewCanvas.width, mainViewCanvas.height);
        } else {
            // L'image n'est pas encore chargée ou a des dimensions invalides
            mainViewCtx.fillStyle = '#333'; // Couleur de secours si l'image n'est pas prête
            mainViewCtx.fillRect(0, 0, mainViewCanvas.width, mainViewCanvas.height);
        }
    } else {
        // Point 5: Si Bois (Forêt) ou Pierre (Gisement de Pierre) n'ont pas d'image de fond, afficher une couleur
        // Cette logique est déjà dans config.js pour TILE_TYPES.FOREST.color et TILE_TYPES.MINE_TERRAIN.color (anciennement STONE_DEPOSIT)
        // On utilise la couleur définie dans TILE_TYPES si backgroundKey est manquant
        let fallbackColor = playerTile.type.color || '#222'; // Couleur par défaut si aucune image et aucune couleur de tuile
        mainViewCtx.fillStyle = fallbackColor;
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

    // Calcul des positions
    const headCenterY = y - bodyHeight / 2 - neckHeight - headRadius;
    const bodyTopY = headCenterY + headRadius + neckHeight;
    const bodyBottomY = bodyTopY + bodyHeight;

    // Dessiner le corps (trapèze)
    ctx.beginPath();
    ctx.moveTo(x - bodyWidth / 2, bodyBottomY); // Bas gauche
    ctx.lineTo(x + bodyWidth / 2, bodyBottomY); // Bas droit
    ctx.lineTo(x + bodyShoulderWidth / 2, bodyTopY); // Haut droit (épaules)
    ctx.lineTo(x - bodyShoulderWidth / 2, bodyTopY); // Haut gauche (épaules)
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Dessiner la tête
    ctx.beginPath();
    ctx.arc(x, headCenterY, headRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Main du joueur (simplifié)
    if (isPlayer) {
        ctx.fillStyle = '#8b4513'; // Brun pour la main
        ctx.strokeStyle = '#5a2d0c';
        ctx.lineWidth = 3;
        const handX = x - bodyWidth / 2 - 12; // Position de la main (à gauche)
        const handY = bodyTopY + bodyHeight * 0.3;
        ctx.beginPath();
        ctx.arc(handX, handY, 6, 0, Math.PI * 2); // Petit cercle pour la main
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

    // Position de base du joueur (plus bas sur l'écran)
    const playerBaseX = canvasWidth / 2;
    const playerBaseY = canvasHeight * 0.70; // Ajusté pour être plus bas

    const charactersOnTile = [];
    // Ajouter le joueur
    charactersOnTile.push({ char: player, x: playerBaseX, y: playerBaseY, isPlayer: true, sortOrder: 1 }); // Joueur au premier plan (sortOrder plus élevé)

    // Ajouter les PNJ visibles sur la même tuile
    const visibleNpcs = npcs.filter(npc => npc.x === player.x && npc.y === player.y);
    visibleNpcs.forEach((npc, index) => {
        const sideOffset = (index % 2 === 0) ? -1 : 1; // Alterner gauche/droite
        const distanceOffset = 100 + (Math.floor(index / 2) * 40); // Éloignement progressif
        const offsetX = sideOffset * distanceOffset;
        charactersOnTile.push({ char: npc, x: playerBaseX + offsetX, y: playerBaseY, isPlayer: false, sortOrder: 0 }); // PNJ derrière le joueur
    });

    // Trier les personnages pour le dessin (le joueur sera dessiné en dernier s'il a le sortOrder le plus élevé)
    charactersOnTile.sort((a, b) => a.sortOrder - b.sortOrder);

    // Gérer l'animation de transition du joueur
    if (player.animationState) {
        const { type, direction, progress } = player.animationState;
        const easeInOutCubic = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        const easedProgress = easeInOutCubic(progress);

        charactersOnTile.forEach(p => {
            let modX = 0, modY = 0;
            // Distance de déplacement pour l'animation (plus grande pour le joueur)
            let distanceFactor = p.isPlayer ? 1 : 0.9; // Les PNJ bougent un peu moins
            let baseDistance = (canvasWidth / 2) + (p.char.bodyWidth || 30) + 20; // Distance pour sortir de l'écran

            if (type === 'out') { // Animation de sortie
                let distance = baseDistance * easedProgress * distanceFactor;
                if(direction === 'east') modX = distance;
                else if(direction === 'west') modX = -distance;
                else if(direction === 'south') modY = distance;
                else if(direction === 'north') modY = -distance;
                charactersCtx.globalAlpha = 1 - easedProgress; // Fade out
            } else { // Animation d'entrée (type === 'in')
                let distance = baseDistance * (1 - easedProgress) * distanceFactor; // Commence loin et se rapproche
                if(direction === 'east') modX = -distance; // Vient de la droite
                else if(direction === 'west') modX = distance;  // Vient de la gauche
                else if(direction === 'south') modY = -distance; // Vient du bas
                else if(direction === 'north') modY = distance;  // Vient du haut
                charactersCtx.globalAlpha = easedProgress; // Fade in
            }
            drawCharacter(charactersCtx, p.char, p.x + modX, p.y + modY, p.isPlayer);
        });
        charactersCtx.globalAlpha = 1; // Réinitialiser l'alpha
    } else {
        // Dessiner les personnages normalement si pas d'animation
        charactersOnTile.forEach(p => {
            drawCharacter(charactersCtx, p.char, p.x, p.y, p.isPlayer);
        });
    }

    // Dessiner les ennemis (simplifié, comme un "sprite" de texte)
    const visibleEnemies = enemies.filter(e => e.x === player.x && e.y === player.y && !gameState.combatState); // Ne pas afficher si en combat
    if (visibleEnemies.length > 0) {
        const enemy = visibleEnemies[0]; // Afficher le premier ennemi sur la tuile
        const enemyX = canvasWidth / 2; // Centré
        const enemyY = canvasHeight * 0.30; // Plus haut sur l'écran
        charactersCtx.save();
        charactersCtx.fillStyle = enemy.color || '#ff0000';
        charactersCtx.font = "70px sans-serif"; // Grande taille pour l'icône
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

    // Ajuster la taille du canvas de la minimap dynamiquement
    minimapCanvas.width = MAP_WIDTH * MINIMAP_DOT_SIZE;
    minimapCanvas.height = MAP_HEIGHT * MINIMAP_DOT_SIZE;
    minimapCtx.clearRect(0, 0, minimapCanvas.width, minimapCanvas.height);

    // Dessiner les tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            if (!player.visitedTiles.has(tileKey) && !globallyRevealedTiles.has(tileKey)) {
                minimapCtx.fillStyle = '#111'; // Non découvert
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            } else if (map[y] && map[y][x] && map[y][x].type) {
                minimapCtx.fillStyle = map[y][x].type.color || '#ff00ff'; // Couleur par défaut pour type inconnu
                minimapCtx.fillRect(x * MINIMAP_DOT_SIZE, y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
            }
        }
    }
    // Grille optionnelle
    minimapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    minimapCtx.lineWidth = 1;
    for (let x = 0; x <= MAP_WIDTH; x++) { minimapCtx.beginPath(); minimapCtx.moveTo(x * MINIMAP_DOT_SIZE, 0); minimapCtx.lineTo(x * MINIMAP_DOT_SIZE, minimapCanvas.height); minimapCtx.stroke(); }
    for (let y = 0; y <= MAP_HEIGHT; y++) { minimapCtx.beginPath(); minimapCtx.moveTo(0, y * MINIMAP_DOT_SIZE); minimapCtx.lineTo(minimapCanvas.width, y * MINIMAP_DOT_SIZE); minimapCtx.stroke(); }

    // Dessiner les PNJ (points)
    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            minimapCtx.fillStyle = npc.color;
            minimapCtx.fillRect(npc.x * MINIMAP_DOT_SIZE, npc.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
        }
    });

    // Dessiner les Ennemis (triangles)
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

    // Dessiner le joueur (carré avec contour)
    minimapCtx.fillStyle = player.color || 'yellow';
    minimapCtx.fillRect(player.x * MINIMAP_DOT_SIZE, player.y * MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE, MINIMAP_DOT_SIZE);
    minimapCtx.strokeStyle = 'white';
    minimapCtx.lineWidth = 2; // Contour plus épais
    minimapCtx.strokeRect(player.x * MINIMAP_DOT_SIZE -1, player.y * MINIMAP_DOT_SIZE -1, MINIMAP_DOT_SIZE + 2, MINIMAP_DOT_SIZE + 2);
}

export function drawLargeMap(gameState, config) {
    if (!gameState || !gameState.map || !gameState.player || !config) return;
    const { map, player, npcs, enemies, globallyRevealedTiles } = gameState;
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const { largeMapCanvas, largeMapCtx } = DOM;
    if(!largeMapCtx || !largeMapCanvas) return;

    const headerSize = 30; // Espace pour les coordonnées
    const parentWrapper = largeMapCanvas.parentElement; // Le div #large-map-content-wrapper
    if (!parentWrapper) return;

    // Calculer la taille disponible pour le canvas, en tenant compte de la légende
    const legendWidth = DOM.largeMapLegendEl ? DOM.largeMapLegendEl.offsetWidth + 20 : 0; // +20 pour le gap
    const availableWidth = parentWrapper.clientWidth - legendWidth - 40 ; // -40 pour padding du wrapper
    const availableHeight = parentWrapper.clientHeight - 40; // -40 pour padding du wrapper

    let canvasSize = Math.min(availableWidth, availableHeight);
    canvasSize = Math.max(canvasSize, 200); // Taille minimale

    largeMapCanvas.width = canvasSize;
    largeMapCanvas.height = canvasSize;
    const cellSize = (canvasSize - headerSize) / Math.max(MAP_WIDTH, MAP_HEIGHT); // Cellules carrées

    largeMapCtx.clearRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);
    largeMapCtx.fillStyle = '#1d3557'; // Fond bleu foncé
    largeMapCtx.fillRect(0, 0, largeMapCanvas.width, largeMapCanvas.height);

    // Dessiner les tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tileKey = `${x},${y}`;
            const drawX = headerSize + x * cellSize;
            const drawY = headerSize + y * cellSize;

            if (!player.visitedTiles.has(tileKey) && !globallyRevealedTiles.has(tileKey)) {
                largeMapCtx.fillStyle = '#000'; // Non découvert
                largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);
                continue;
            }

            if (!map[y] || !map[y][x] || !map[y][x].type) continue;
            const tile = map[y][x];
            largeMapCtx.fillStyle = tile.type.color || '#ff00ff';
            largeMapCtx.fillRect(drawX, drawY, cellSize, cellSize);

            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
            const icon = tile.type.icon || TILE_ICONS[tile.type.name] || TILE_ICONS.default;
            largeMapCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Ombre pour l'icône
            largeMapCtx.font = `bold ${cellSize * 0.6}px Poppins`;
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            let iconOffsetY = 0; // Ajustement vertical pour certains emojis
            if (icon === '💎' || icon === '🌊' || icon === '🏖️' || icon === '🍂' || icon === '🔥' || icon === '⛏️' || icon === '⛺' || icon === '🏠' || icon === '🌲' || icon === '⛰️' || icon === '🌳' || icon === '⛏️🏭') { // Added Mine Building
                iconOffsetY = cellSize * 0.05;
            }
            largeMapCtx.fillText(icon, drawX + cellSize / 2, drawY + cellSize / 2 + iconOffsetY);
        }
    }

    // Dessiner la grille et les coordonnées
    largeMapCtx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    largeMapCtx.lineWidth = 1;
    largeMapCtx.fillStyle = '#f1faee'; // Couleur pour les textes des coordonnées
    largeMapCtx.font = `600 ${Math.min(14, headerSize * 0.5)}px Poppins`; // Taille de police pour les coordonnées
    largeMapCtx.textAlign = 'center';
    largeMapCtx.textBaseline = 'middle';

    for (let i = 0; i < MAP_WIDTH; i++) {
        const xCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, xCoordText, headerSize / 2); // Coordonnées X en haut
        const lineX = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne verticale à gauche
            largeMapCtx.beginPath(); largeMapCtx.moveTo(lineX, headerSize); largeMapCtx.lineTo(lineX, headerSize + MAP_HEIGHT * cellSize); largeMapCtx.stroke();
        }
    }
    for (let i = 0; i < MAP_HEIGHT; i++) {
        const yCoordText = headerSize + (i + 0.5) * cellSize;
        largeMapCtx.fillText(i, headerSize / 2, yCoordText); // Coordonnées Y à gauche
        const lineY = headerSize + i * cellSize;
        if (i > 0) { // Ne pas dessiner la première ligne horizontale en haut
            largeMapCtx.beginPath(); largeMapCtx.moveTo(headerSize, lineY); largeMapCtx.lineTo(headerSize + MAP_WIDTH * cellSize, lineY); largeMapCtx.stroke();
        }
    }
    // Contour de la carte
    largeMapCtx.strokeRect(headerSize, headerSize, MAP_WIDTH * cellSize, MAP_HEIGHT * cellSize);

    // Dessiner les PNJ (cercles)
    npcs.forEach(npc => {
        const tileKey = `${npc.x},${npc.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + npc.x * cellSize + cellSize / 2;
            const drawY = headerSize + npc.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = npc.color;
            largeMapCtx.beginPath(); largeMapCtx.arc(drawX, drawY, cellSize * 0.35, 0, Math.PI * 2); largeMapCtx.fill();
        }
    });

    // Dessiner les Ennemis (icônes)
    enemies.forEach(enemy => {
        const tileKey = `${enemy.x},${enemy.y}`;
        if (player.visitedTiles.has(tileKey) || globallyRevealedTiles.has(tileKey)) {
            const drawX = headerSize + enemy.x * cellSize + cellSize / 2;
            const drawY = headerSize + enemy.y * cellSize + cellSize / 2;
            largeMapCtx.fillStyle = enemy.color || '#ff0000';
            largeMapCtx.font = `bold ${cellSize * 0.7}px Poppins`; // Icône plus grande pour les ennemis
            largeMapCtx.textAlign = 'center';
            largeMapCtx.textBaseline = 'middle';
            largeMapCtx.fillText(enemy.icon || '❓', drawX, drawY);
        }
    });

    // Dessiner le joueur (cercle avec contour)
    const playerDrawX = headerSize + player.x * cellSize + cellSize / 2;
    const playerDrawY = headerSize + player.y * cellSize + cellSize / 2;
    largeMapCtx.fillStyle = player.color;
    largeMapCtx.beginPath(); largeMapCtx.arc(playerDrawX, playerDrawY, cellSize * 0.4, 0, Math.PI * 2); largeMapCtx.fill();
    largeMapCtx.strokeStyle = 'white';
    largeMapCtx.lineWidth = 3; // Contour plus épais
    largeMapCtx.stroke();
}


export function populateLargeMapLegend() {
    const { largeMapLegendEl } = DOM;
    if(!largeMapLegendEl) return;

    largeMapLegendEl.innerHTML = '<h3>Légende</h3>';
    const addedTypes = new Set(); // Pour éviter les doublons dans la légende

    // Ajouter les types de tuiles depuis TILE_TYPES
    for (const tileKey in TILE_TYPES) {
        const tileType = TILE_TYPES[tileKey];
        if (!addedTypes.has(tileType.name)) { // Si le nom du type n'a pas encore été ajouté
            const item = document.createElement('div');
            item.className = 'legend-item';
            // Utiliser tile.type.icon si disponible, sinon TILE_ICONS comme fallback
            const icon = tileType.icon || TILE_ICONS[tileType.name] || TILE_ICONS.default;
            item.innerHTML = `<div class="legend-color-box" style="background-color: ${tileType.color};"></div><span>${icon} ${tileType.name}</span>`;
            largeMapLegendEl.appendChild(item);
            addedTypes.add(tileType.name); // Marquer ce nom de type comme ajouté
        }
    }
    // Séparateur
    largeMapLegendEl.insertAdjacentHTML('beforeend', '<hr style="border-color: rgba(255,255,255,0.1); margin: 10px 0;">');
    // Entités
    const playerItem = document.createElement('div');
    playerItem.className = 'legend-item';
    playerItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ffd700;">●</div><span>Vous</span>`; // Utiliser un rond pour le joueur
    largeMapLegendEl.appendChild(playerItem);

    const npcItem = document.createElement('div');
    npcItem.className = 'legend-item';
    npcItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #ff6347;">●</div><span>Survivants (PNJ)</span>`; // Utiliser un rond pour les PNJ
    largeMapLegendEl.appendChild(npcItem);

    const enemyItem = document.createElement('div');
    enemyItem.className = 'legend-item';
    enemyItem.innerHTML = `<div class="legend-color-box legend-character-icon" style="color: #dc2626;">▲</div><span>Ennemis</span>`; // Utiliser un triangle pour les ennemis
    largeMapLegendEl.appendChild(enemyItem);

    const unknownItem = document.createElement('div'); // Tuile non découverte
    unknownItem.className = 'legend-item';
    unknownItem.innerHTML = `<div class="legend-color-box" style="background-color: #000;"></div><span>Non découvert</span>`;
    largeMapLegendEl.appendChild(unknownItem);
}