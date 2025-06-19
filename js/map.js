// js/map.js
import { TILE_TYPES, ITEM_TYPES } from './config.js'; 

export function generateMap(config) {
    console.log("Starting map generation with controlled stone deposits...");
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(null));
    const centerX = MAP_WIDTH / 2;
    const centerY = MAP_HEIGHT / 2;

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

    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (baseLayout[y][x] === 'water') {
                map[y][x] = { type: TILE_TYPES.WATER_LAGOON }; // Initialisation temporaire
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
    // Abri Collectif is no longer placed by default at generation.
    // It must be built by the player.
    const specialLocations = []; // Will store treasure, key locations etc.
    // Player start position can be considered a special location to avoid critical items spawning there.
    // Assuming player starts near center, let's mark it conceptually:
    // specialLocations.push({x: Math.floor(centerX) + 1, y: Math.floor(centerY)});


    let treasureX, treasureY;
    let treasureAttempts = 0;
    do {
        treasureX = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1; 
        treasureY = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        treasureAttempts++;
        if (treasureAttempts > 100) {
            console.warn("Could not place treasure chest after 100 attempts. Placing at default backup.");
            treasureX = 1; treasureY = 1; // Fallback très simple
            // Chercher une case accessible en fallback
            for(let ty=1; ty < MAP_HEIGHT -1; ty++) {
                for(let tx=1; tx < MAP_WIDTH -1; tx++) {
                    if(map[ty][tx].type.accessible && !specialLocations.some(loc => loc.x === tx && loc.y === ty)) {
                        treasureX = tx; treasureY = ty; break;
                    }
                }
                if(treasureX !== 1 || treasureY !== 1) break;
            }
            break;
        }
    } while (
        !map[treasureY][treasureX].type.accessible ||
        specialLocations.some(loc => loc.x === treasureX && loc.y === treasureY)
    );
    map[treasureY][treasureX].type = TILE_TYPES.TREASURE_CHEST;
    // map[treasureY][treasureX].isOpened = false; // Sera géré dans la finalisation
    specialLocations.push({x: treasureX, y: treasureY});
    console.log(`Treasure placed at (${treasureX}, ${treasureY})`);

    let keyX, keyY;
    let keyAttempts = 0;
    do {
        keyX = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
        keyY = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        keyAttempts++;
        if (keyAttempts > 100) { 
            console.warn("Could not place hidden key after 100 attempts.");
            keyX = -1; 
            break;
        }
    } while (
        !map[keyY][keyX].type.accessible ||
        specialLocations.some(loc => loc.x === keyX && loc.y === keyY)
    );

    if (keyX !== -1) {
        map[keyY][keyX].hiddenItemName = ITEM_TYPES['Clé du Trésor'].name; 
        specialLocations.push({x: keyX, y: keyY});
        console.log(`Hidden key placed at (${keyX}, ${keyY})`);
    }

    const possibleStoneLocations = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) { 
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (map[y][x].type.accessible && 
                !specialLocations.some(loc => loc.x === x && loc.y === y)) {
                possibleStoneLocations.push({ x, y });
            }
        }
    }
    
    let stonePlacedCount = 0;
    const maxStones = 2; 
    const placedStoneCoords = []; 
    for (let i = possibleStoneLocations.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [possibleStoneLocations[i], possibleStoneLocations[j]] = [possibleStoneLocations[j], possibleStoneLocations[i]]; }

    for (const loc of possibleStoneLocations) {
        if (stonePlacedCount >= maxStones) break;
        let isAdjacentToOtherStone = false;
        for (const placedLoc of placedStoneCoords) { 
            const dx = Math.abs(loc.x - placedLoc.x); 
            const dy = Math.abs(loc.y - placedLoc.y); 
            if (dx <= 1 && dy <= 1) { isAdjacentToOtherStone = true; break; } 
        }
        if (!isAdjacentToOtherStone) {
            map[loc.y][loc.x].type = TILE_TYPES.STONE_DEPOSIT;
            placedStoneCoords.push(loc); 
            specialLocations.push(loc);  
            stonePlacedCount++;
        }
    }
    console.log(`Map generation: Placed ${stonePlacedCount} stones.`);


    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const currentTileData = map[y][x]; // Contient { type: ..., hiddenItemName: ... }
            const type = currentTileData.type;
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
            
            map[y][x] = { 
                type: type, 
                x: x, 
                y: y, 
                backgroundKey: chosenBackground, 
                harvestsLeft: type.harvests === Infinity ? Infinity : (type.harvests || 0),
                resources: type.resource ? { ...type.resource } : null, 
                occupant: null,
                inventory: type.inventory ? JSON.parse(JSON.stringify(type.inventory)) : undefined,
                hiddenItem: currentTileData.hiddenItemName || null, 
                isOpened: type === TILE_TYPES.TREASURE_CHEST ? false : undefined 
            };
        }
    }
    
    console.log(`Map generation finished. Shared inventory should be available.`);
    return map;
}

export function getTile(map, x, y) { return (map[y] && map[y][x]) ? map[y][x] : null; }