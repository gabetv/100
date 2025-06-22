// js/map.js
import { TILE_TYPES, ITEM_TYPES, CONFIG } from './config.js';

export function generateMap(config) {
    console.log("Starting map generation with controlled stone deposits...");
    const { MAP_WIDTH, MAP_HEIGHT } = config;
    const map = Array(MAP_HEIGHT).fill(null).map(() => Array(MAP_WIDTH).fill(null));
    const centerX = MAP_WIDTH / 2;
    const centerY = MAP_HEIGHT / 2;

    // Étape 1: Définir une disposition de base (eau/terre)
    const baseLayout = Array.from({ length: MAP_HEIGHT }, () => Array(MAP_WIDTH).fill(null));
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            // Bordures extérieures toujours de l'eau
            if (y === 0 || y === MAP_HEIGHT - 1 || x === 0 || x === MAP_WIDTH - 1) {
                baseLayout[y][x] = 'water';
            }
            // Deuxième couche (bordure intérieure) peut être eau ou terre
            else if (y === 1 || y === MAP_HEIGHT - 2 || x === 1 || x === MAP_WIDTH - 2) {
                baseLayout[y][x] = (Math.random() < 0.6) ? 'water' : 'land'; // Plus de chance d'être de l'eau pour des côtes plus naturelles
            }
            // Centre de la carte est de la terre
            else {
                baseLayout[y][x] = 'land';
            }
        }
    }

    // Étape 2: Affiner les types de tuiles en fonction de la disposition
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            if (baseLayout[y][x] === 'water') {
                map[y][x] = { type: TILE_TYPES.WATER_LAGOON }; // Assigner Lagon
                continue;
            }

            // Vérifier si c'est une tuile côtière (adjacente à l'eau)
            let isCoastal = false;
            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { // Vérifier les 4 voisins directs
                const nx = x + dx, ny = y + dy;
                if (ny >=0 && ny < MAP_HEIGHT && nx >=0 && nx < MAP_WIDTH && baseLayout[ny][nx] === 'water') {
                    isCoastal = true;
                    break;
                }
            }

            if (isCoastal) {
                map[y][x] = { type: TILE_TYPES.PLAGE }; // Assigner Plage
            } else {
                // Pour les terres non côtières, choisir entre Forêt et Plaine
                map[y][x] = { type: (Math.random() < 0.6) ? TILE_TYPES.FOREST : TILE_TYPES.PLAINS };
            }
        }
    }

    // Placement des éléments spéciaux
    const specialLocations = []; // Pour éviter de superposer des éléments spéciaux

    // Placer le Trésor Caché
    let treasureX, treasureY;
    let treasureAttempts = 0;
    do {
        treasureX = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1; // Éviter les bordures d'eau extrêmes
        treasureY = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        treasureAttempts++;
        if (treasureAttempts > 100) {
            console.warn("Could not place treasure chest after 100 attempts. Placing at default backup.");
            // Logique de secours pour placer le trésor si la position aléatoire échoue
            treasureX = 1; treasureY = 1; // Valeurs par défaut
            let foundSpot = false;
            for(let ty=1; ty < MAP_HEIGHT -1 && !foundSpot; ty++) {
                for(let tx=1; tx < MAP_WIDTH -1 && !foundSpot; tx++) {
                    if(map[ty] && map[ty][tx] && map[ty][tx].type.accessible && !specialLocations.some(loc => loc.x === tx && loc.y === ty)) {
                        treasureX = tx; treasureY = ty; foundSpot = true;
                    }
                }
            }
            break;
        }
    } while (
        !map[treasureY] || !map[treasureY][treasureX] || !map[treasureY][treasureX].type.accessible || // S'assurer que la tuile est accessible
        specialLocations.some(loc => loc.x === treasureX && loc.y === treasureY) // Vérifier si déjà utilisé
    );
    if(map[treasureY] && map[treasureY][treasureX]) { // Vérifier que la tuile existe
      map[treasureY][treasureX].type = TILE_TYPES.TREASURE_CHEST;
      specialLocations.push({x: treasureX, y: treasureY});
      console.log(`Treasure placed at (${treasureX}, ${treasureY})`);
    }


    // Placer la Clé du Trésor (cachée)
    let keyX, keyY;
    let keyAttempts = 0;
    do {
        keyX = Math.floor(Math.random() * (MAP_WIDTH - 2)) + 1;
        keyY = Math.floor(Math.random() * (MAP_HEIGHT - 2)) + 1;
        keyAttempts++;
        if (keyAttempts > 100) { // Limite pour éviter une boucle infinie
            console.warn("Could not place hidden key after 100 attempts.");
            keyX = -1; // Marqueur pour indiquer l'échec
            break;
        }
    } while (
        !map[keyY] || !map[keyY][keyX] || !map[keyY][keyX].type.accessible ||
        specialLocations.some(loc => loc.x === keyX && loc.y === keyY)
    );

    if (keyX !== -1 && map[keyY] && map[keyY][keyX]) { // Si une position a été trouvée
        map[keyY][keyX].hiddenItemName = 'Clé du Trésor'; // Le nom de l'objet caché
        specialLocations.push({x: keyX, y: keyY});
        console.log(`Hidden key placed at (${keyX}, ${keyY})`);
    }


    // Placer les Gisements de Pierre
    const possibleStoneLocations = [];
    for (let y = 1; y < MAP_HEIGHT - 1; y++) { // Parcourir les tuiles intérieures
        for (let x = 1; x < MAP_WIDTH - 1; x++) {
            if (map[y] && map[y][x] && map[y][x].type.accessible &&
                !specialLocations.some(loc => loc.x === x && loc.y === y)) { // Non déjà utilisé
                possibleStoneLocations.push({ x, y });
            }
        }
    }

    let stonePlacedCount = 0;
    const maxStones = 2; // Nombre de gisements de pierre à placer
    const placedStoneCoords = []; // Pour éviter que les gisements soient adjacents
    // Mélanger les emplacements possibles pour un placement aléatoire
    for (let i = possibleStoneLocations.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [possibleStoneLocations[i], possibleStoneLocations[j]] = [possibleStoneLocations[j], possibleStoneLocations[i]]; }

    for (const loc of possibleStoneLocations) {
        if (stonePlacedCount >= maxStones) break;
        // Vérifier si adjacent à un autre gisement déjà placé (optionnel, pour espacer)
        let isAdjacentToOtherStone = false;
        for (const placedLoc of placedStoneCoords) {
            const dx = Math.abs(loc.x - placedLoc.x);
            const dy = Math.abs(loc.y - placedLoc.y);
            if (dx <= 1 && dy <= 1) { isAdjacentToOtherStone = true; break; } // Si adjacent (y compris diagonale)
        }
        if (!isAdjacentToOtherStone && map[loc.y] && map[loc.y][loc.x]) { // Si non adjacent et la tuile existe
            map[loc.y][loc.x].type = TILE_TYPES.STONE_DEPOSIT;
            placedStoneCoords.push(loc); // Ajouter aux coordonnées des pierres placées
            specialLocations.push(loc);  // Marquer comme emplacement spécial
            stonePlacedCount++;
        }
    }
    console.log(`Map generation: Placed ${stonePlacedCount} stones.`);


    // Finaliser chaque tuile
    for (let y = 0; y < MAP_HEIGHT; y++) {
        for (let x = 0; x < MAP_WIDTH; x++) {
            const currentTileData = map[y][x]; // Récupérer les données de type déjà assignées
            const type = currentTileData.type;
            const backgroundOptions = type.background || [];
            let chosenBackground = null;

            if (backgroundOptions.length > 0) {
                let allowedBackgrounds = [...backgroundOptions];
                // Essayer d'éviter des répétitions directes de fond pour le même type de tuile
                if (allowedBackgrounds.length > 1) { // Seulement si plusieurs options
                    if (x > 0 && map[y][x - 1].type === type) { // Voisin gauche
                        allowedBackgrounds = allowedBackgrounds.filter(key => key !== map[y][x - 1].backgroundKey);
                    }
                    if (y > 0 && map[y - 1][x].type === type) { // Voisin haut
                        allowedBackgrounds = allowedBackgrounds.filter(key => key !== map[y - 1][x].backgroundKey);
                    }
                }
                // Si toutes les options ont été filtrées, réinitialiser pour éviter erreur
                if (allowedBackgrounds.length === 0 && backgroundOptions.length > 0) {
                    allowedBackgrounds = backgroundOptions;
                }
                // Choisir un fond parmi les options restantes (ou initiales si toutes filtrées)
                if (allowedBackgrounds.length > 0) chosenBackground = allowedBackgrounds[Math.floor(Math.random() * allowedBackgrounds.length)];
                else chosenBackground = 'bg_plains_1'; // Fallback si aucune option de fond
            }

            // Créer l'objet tuile final
            const tileObject = {
                type: type, // type déjà défini
                x: x,
                y: y,
                backgroundKey: chosenBackground,
                harvestsLeft: type.harvests === Infinity ? Infinity : (type.harvests || 0),
                resources: type.resource ? { ...type.resource } : null, // Copier l'objet resource
                occupant: null, // Sera rempli par les PNJ/ennemis plus tard
                inventory: type.inventory ? JSON.parse(JSON.stringify(type.inventory)) : undefined,
                hiddenItem: currentTileData.hiddenItemName || null, // Nom de l'objet caché, ou null
                isOpened: type === TILE_TYPES.TREASURE_CHEST ? false : undefined, // Pour le trésor
                groundItems: {}, // Pour les objets au sol
                buildings: [], // Sera rempli par les constructions
                actionsLeft: type.name === TILE_TYPES.PLAGE.name ? { ...TILE_TYPES.PLAGE.actionsAvailable } : undefined, // Point 1
            };

            // Si le type de tuile est un bâtiment par défaut (ex: trésor), l'ajouter
            if (type.isBuilding && !tileObject.buildings.find(b => b.key === Object.keys(TILE_TYPES).find(k => TILE_TYPES[k] === type))) {
                tileObject.buildings.push({
                    key: Object.keys(TILE_TYPES).find(k => TILE_TYPES[k] === type), // Trouver la clé du type
                    durability: type.durability,
                    maxDurability: type.durability,
                });
            }
            map[y][x] = tileObject;
        }
    }

    console.log(`Map generation finished.`);
    return map;
}

export function getTile(map, x, y) { return (map[y] && map[y][x]) ? map[y][x] : null; }