// js/map.js
import { TILE_TYPES } from './config.js';

export function generateMap(config) {
    console.log("Starting map generation with controlled stone deposits...");
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(null));
    const centerX = MAP_WIDTH / 2;
    const centerY = MAP_HEIGHT / 2;

    // --- Étape 1: Création du terrain de base (terre/eau) ---
    const baseLayout = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(null));
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
                baseLayout[y][x] = 'water';
            } else if (y === 1 || y === MAP_HEIGHT - 2 || x === 1 || x === MAP_WIDTH - 2) {
                baseLayout[y][x] = (Math.random() < 0.6) ? 'water' : 'land';
            } else {
                baseLayout[y][x] = 'land';
            }
        }
    }

    // --- Étape 2: Placement des biomes de base ---
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (baseLayout[y][x] === 'water') {
                map[y][x] = { type: TILE_TYPES.WATER_LAGOON };
                continue;
            }
            let isCoastal = false;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nx = x + dx, ny = y + dy;
                if (baseLayout[ny] && baseLayout[ny][nx] === 'water') {
                    isCoastal = true;
                    break;
                }
            }
            if (isCoastal) {
                map[y][x] = { type: TILE_TYPES.SAND_GOLDEN };
            } else {
                map[y][x] = { type: (Math.random() < 0.6) ? TILE_TYPES.FOREST : TILE_TYPES.PLAINS };
            }
        }
    }

    // --- Étape 3: Placement des structures spéciales (Abri, Gisements) ---
    const shelterX = Math.floor(centerX);
    const shelterY = Math.floor(centerY);
    if (map[shelterY] && map[shelterY][shelterX].type.accessible) {
        // On remplace le type de la tuile par celui de l'abri
        map[shelterY][shelterX].type = TILE_TYPES.SHELTER_COLLECTIVE;
    }

    const possibleStoneLocations = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if ((map[y][x].type === TILE_TYPES.PLAINS || map[y][x].type === TILE_TYPES.WASTELAND) && map[y][x].type !== TILE_TYPES.SHELTER_COLLECTIVE) {
                possibleStoneLocations.push({ x, y });
            }
        }
    }
    // ... (la logique de placement des pierres reste la même)
    let stonePlacedCount = 0;
    const maxStones = 2;
    const placedCoordinates = [];
    for (let i = possibleStoneLocations.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [possibleStoneLocations[i], possibleStoneLocations[j]] = [possibleStoneLocations[j], possibleStoneLocations[i]]; }
    for (const loc of possibleStoneLocations) {
        if (stonePlacedCount >= maxStones) break;
        let isAdjacent = false;
        for (const placedLoc of placedCoordinates) { const dx = Math.abs(loc.x - placedLoc.x); const dy = Math.abs(loc.y - placedLoc.y); if (dx <= 1 && dy <= 1) { isAdjacent = true; break; } }
        if (!isAdjacent) {
            map[loc.y][loc.x].type = TILE_TYPES.STONE_DEPOSIT;
            placedCoordinates.push(loc);
            stonePlacedCount++;
        }
    }
    
    // --- Étape 4: Finalisation de TOUTES les tuiles (C'est ici que la correction a lieu) ---
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const type = map[y][x].type;
            const backgroundOptions = type.background || [];
            let chosenBackground = null;

            if (backgroundOptions.length > 0) {
                let allowedBackgrounds = [...backgroundOptions];
                if (allowedBackgrounds.length > 1) {
                    if (x > 0 && map[y][x - 1].type === type) { allowedBackgrounds = allowedBackgrounds.filter(key => key !== map[y][x - 1].backgroundKey); }
                    if (y > 0 && map[y - 1][x].type === type) { allowedBackgrounds = allowedBackgrounds.filter(key => key !== map[y - 1][x].backgroundKey); }
                }
                if (allowedBackgrounds.length === 0) { allowedBackgrounds = backgroundOptions; }
                chosenBackground = allowedBackgrounds[Math.floor(Math.random() * allowedBackgrounds.length)];
            }
            
            // On remplace l'objet temporaire par l'objet final complet
            map[y][x] = { 
                type: type, 
                x: x, 
                y: y, 
                backgroundKey: chosenBackground, 
                harvestsLeft: type.harvests === Infinity ? Infinity : (type.harvests || 0),
                resources: type.resource ? { ...type.resource } : null, 
                occupant: null,
                // =======================================================================
                // == LA CORRECTION EST ICI : On copie la propriété 'inventory' si elle ==
                // == existe sur le modèle de la tuile (ex: SHELTER_COLLECTIVE).       ==
                // =======================================================================
                inventory: type.inventory ? JSON.parse(JSON.stringify(type.inventory)) : undefined
            };
        }
    }
    
    console.log(`Map generation finished. Placed ${stonePlacedCount} stones. Shared inventory should be available.`);
    return map;
}

export function getTile(map, x, y) { return (map[y] && map[y][x]) ? map[y][x] : null; }