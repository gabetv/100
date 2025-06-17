// js/map.js
import { TILE_TYPES } from './config.js';

export function generateMap(config) {
    console.log("Starting map generation...");
    const { MAP_WIDTH, MAP_HEIGHT } = config, map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(null)), centerX = MAP_WIDTH / 2, centerY = MAP_HEIGHT / 2, maxRadius = Math.min(MAP_WIDTH, MAP_HEIGHT) / 2.5;
    const baseLayout = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(null));
    for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2)); baseLayout[y][x] = (distance < maxRadius - Math.random() * 2.5) ? 'land' : 'water'; } }
    for (let y = 0; y < MAP_HEIGHT; y++) { for (let x = 0; x < MAP_WIDTH; x++) { if (baseLayout[y][x] === 'water') { map[y][x] = { type: TILE_TYPES.WATER_LAGOON }; continue; } let isCoastal = false; for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { const nx = x + dx, ny = y + dy; if (baseLayout[ny] && baseLayout[ny][nx] === 'water') { isCoastal = true; break; } } if (isCoastal) { map[y][x] = { type: TILE_TYPES.SAND_GOLDEN }; } else { map[y][x] = { type: (Math.random() < 0.7) ? TILE_TYPES.FOREST : TILE_TYPES.PLAINS }; } } }
    const shelterX = Math.floor(centerX), shelterY = Math.floor(centerY); if (map[shelterY] && map[shelterY][shelterX].type.accessible) { map[shelterY][shelterX].type = TILE_TYPES.SHELTER_COLLECTIVE; }

    // CORRIGÉ : Placement plus fréquent des gisements de pierre
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const tile = map[y][x];
            // On augmente la probabilité à 30% et on ajoute les friches comme lieu d'apparition possible
            if (tile.type === TILE_TYPES.PLAINS || tile.type === TILE_TYPES.WASTELAND) {
                if (Math.random() < 0.30) { // 30% de chance
                    map[y][x].type = TILE_TYPES.STONE_DEPOSIT;
                }
            }
        }
    }
    
    // Finalisation des tuiles
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const type = map[y][x].type;
            const backgroundOptions = type.background || [];
            const chosenBackground = backgroundOptions.length > 0 ? backgroundOptions[Math.floor(Math.random() * backgroundOptions.length)] : null;
            map[y][x] = { type, x, y, backgroundKey: chosenBackground, harvestsLeft: type.harvests || 0, resources: type.resource ? { type: type.resource.type, yield: type.resource.yield } : null, occupant: null };
        }
    }
    console.log("Map generation finished with more stone deposits.");
    return map;
}

export function getTile(map, x, y) { return (map[y] && map[y][x]) ? map[y][x] : null; }