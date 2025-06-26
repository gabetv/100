// js/ui/panels.js
import { ITEM_TYPES, TILE_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import { state as gameState } from '../state.js';
import DOM from './dom.js';

function updateSquaresBar(containerElement, value, maxValue, type) {
    if (!containerElement) return;

    containerElement.innerHTML = ''; // Clear existing squares

    const numFilledSquares = Math.round((value / maxValue) * 10); // Calculate how many of 10 squares should be filled

    for (let i = 0; i < 10; i++) {
        const square = document.createElement('div');
        square.classList.add('stat-square');
        if (i < numFilledSquares) {
            square.classList.add(`filled-${type}`);
        }
        containerElement.appendChild(square);
    }
}

export function updateStatsPanel(player) {
    if (!player) return;
    const { healthSquaresContainerEl, thirstSquaresContainerEl, hungerSquaresContainerEl, sleepSquaresContainerEl, healthStatusEl } = DOM;

    updateSquaresBar(healthSquaresContainerEl, player.health, player.maxHealth, 'health');
    updateSquaresBar(thirstSquaresContainerEl, player.thirst, player.maxThirst, 'thirst');
    updateSquaresBar(hungerSquaresContainerEl, player.hunger, player.maxHunger, 'hunger');
    updateSquaresBar(sleepSquaresContainerEl, player.sleep, player.maxSleep, 'sleep');

    if (healthStatusEl) {
        const statusText = player.status.join(', ') || 'normale';
        healthStatusEl.textContent = statusText;
    }

    if (healthSquaresContainerEl) healthSquaresContainerEl.parentElement.classList.toggle('pulsing', player.health <= (player.maxHealth * 0.3));
    if (thirstSquaresContainerEl) thirstSquaresContainerEl.parentElement.classList.toggle('pulsing', player.thirst <= (player.maxThirst * 0.2));
    if (hungerSquaresContainerEl) hungerSquaresContainerEl.parentElement.classList.toggle('pulsing', player.hunger <= (player.maxHunger * 0.2));
    if (sleepSquaresContainerEl) sleepSquaresContainerEl.parentElement.classList.toggle('pulsing', player.sleep <= (player.maxSleep * 0.2));

    const survivalVignette = document.getElementById('survival-vignette');
    if (survivalVignette) survivalVignette.classList.toggle('active', player.health <= (player.maxHealth * 0.3));
}

export function updateQuickSlots(player) {
    // Quick slots are not used in this version.
}

export function updateInventory(player) {
    if (!player || !player.inventory || !DOM.inventoryCategoriesEl || !DOM.inventoryCapacityEl) return;

    DOM.inventoryCategoriesEl.innerHTML = '';
    const total = getTotalResources(player.inventory);
    DOM.inventoryCapacityEl.textContent = `(${total} / ${player.maxInventory})`;

    const categories = {
        ressources: {},
        outilsEtArmes: {},
        nourritureEtSoins: {},
        equipements: {},
        divers: {},
    };

    // Classify items
    for (const itemName in player.inventory) {
        const itemValue = player.inventory[itemName];
        // This handles cases where items with durability are stored as objects/instances
        const baseItemName = typeof itemValue === 'object' && itemValue.name ? itemValue.name : itemName;
        const baseItemDef = ITEM_TYPES[baseItemName] || { type: 'resource', icon: '❓' };
        
        let type = 'divers';

        if (baseItemDef.type === 'resource') {
            type = 'ressources';
        } else if (baseItemDef.type === 'tool' || baseItemDef.type === 'weapon' || (baseItemDef.type === 'usable' && baseItemDef.slot === 'weapon')) {
            type = 'outilsEtArmes';
        } else if (baseItemDef.type === 'consumable') {
            type = 'nourritureEtSoins';
        } else if (baseItemDef.slot) {
            type = 'equipements';
        }
        
        const targetCategory = categories[type];
        targetCategory[itemName] = itemValue;
    }

    const categoryOrder = [
        { key: 'ressources', name: 'Ressources' },
        { key: 'outilsEtArmes', name: 'Outils et Armes' },
        { key: 'nourritureEtSoins', name: 'Nourriture et Soins' },
        { key: 'equipements', name: 'Équipements' },
        { key: 'divers', name: 'Divers' },
    ];
    
    let hasItems = false;
    categoryOrder.forEach(cat => {
        const itemsInCategory = categories[cat.key];
        if (Object.keys(itemsInCategory).length > 0) {
            hasItems = true;
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'inventory-category';
            const header = document.createElement('div');
            header.className = 'category-header open';
            header.innerHTML = `<span>${cat.name}</span><span class="category-toggle">▶</span>`;
            const content = document.createElement('ul');
            content.className = 'category-content visible';
            
            Object.keys(itemsInCategory).sort().forEach(itemName => {
                const itemValue = itemsInCategory[itemName];
                const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
                let baseItemName = itemName;
                let instanceData = null;

                if (typeof itemValue === 'object' && itemValue.name) {
                    baseItemName = itemValue.name;
                    instanceData = itemValue;
                }
                
                const baseItemDef = ITEM_TYPES[baseItemName] || { icon: '❓', rarity: 'common' };

                const li = document.createElement('li');
                li.className = 'inventory-item';
                li.classList.add(`rarity-${baseItemDef.rarity}`);
                if (baseItemDef.type === 'consumable' || baseItemDef.teachesRecipe || baseItemDef.slot || baseItemDef.type === 'usable' || baseItemDef.type === 'key') {
                    li.classList.add('clickable');
                    if (baseItemDef.slot) {
                        li.addEventListener('click', () => {
                            State.equipItem(baseItemName);
                            UI.updateInventory(player);
                            UI.updateBottomBarEquipmentPanel(player);
                        });
                    } else if (baseItemDef.type === 'consumable') {
                        li.addEventListener('click', () => {
                            if (window.handleGlobalPlayerAction) {
                                window.handleGlobalPlayerAction('consume_item_context', { itemKey: li.dataset.itemKey });
                            }
                            UI.updateInventory(player);
                        });
                    }
                }
                li.dataset.itemKey = itemName;
                li.dataset.itemName = baseItemName;
                li.setAttribute('draggable', 'true');
                li.dataset.owner = 'player-inventory';

                let displayName = baseItemName;
                let count = (typeof itemValue === 'number') ? itemValue : 1;
                
                if (instanceData && instanceData.hasOwnProperty('currentDurability')) {
                    displayName += ` (${instanceData.currentDurability}/${instanceData.durability})`;
                }

                li.dataset.itemCount = count;
                li.innerHTML = `<span class="inventory-icon">${baseItemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">${count}</span>`;
                content.appendChild(li);
            });
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(content);
            DOM.inventoryCategoriesEl.appendChild(categoryDiv);
        }
    });

    if (!hasItems) DOM.inventoryCategoriesEl.innerHTML = '<li class="inventory-empty">(Vide)</li>';

    // Setup inventory search functionality
    const searchInput = document.getElementById('inventory-search');
    if (searchInput) {
        searchInput.oninput = function(e) {
            const searchTerm = e.target.value.toLowerCase();
            const inventoryItems = DOM.inventoryCategoriesEl.querySelectorAll('.inventory-item');
            inventoryItems.forEach(item => {
                const itemName = item.dataset.itemName.toLowerCase();
                if (searchTerm === '' || itemName.includes(searchTerm)) {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            });
        };
    }

    // Quick slots removed as per user request
    const quickSlotsContainer = document.getElementById('quick-slots');
    if (quickSlotsContainer) {
        quickSlotsContainer.innerHTML = '';
    }
}

export function updateDayCounter(day) {
    if (DOM.dayCounterTileInfoEl) {
        const span = DOM.dayCounterTileInfoEl; // This is the span itself based on new HTML
        if (span) span.textContent = day;
    }
}

// Update tile information in both the right panel and the main view HUD
export function updateTileInfoPanel(tile) {
    if (!tile || !DOM.tileNameEl || !DOM.tileHarvestsInfoEl) return;

    let mainDisplayName = tile.type.name;
    let mainDurabilityInfo = "";

    if (tile.buildings && tile.buildings.length > 0) {
        const mainBuildingInstance = tile.buildings[0];
        const mainBuildingDef = TILE_TYPES[mainBuildingInstance.key];
        if (mainBuildingDef) {
            mainDisplayName = mainBuildingDef.name;
            if (mainBuildingInstance.hasOwnProperty('durability') && mainBuildingInstance.hasOwnProperty('maxDurability')) {
                 mainDurabilityInfo = `Durabilité: ${mainBuildingInstance.durability}/${mainBuildingInstance.maxDurability}`;
            }
        }
    }

    // Update right panel tile info
    DOM.tileNameEl.textContent = mainDisplayName;

    let actionCountInfo = "";
    if (tile.type.name === TILE_TYPES.FOREST.name) actionCountInfo = `Actions Bois: ${tile.woodActionsLeft || 0}, Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.PLAINS.name) actionCountInfo = `Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) actionCountInfo = `Pierre: ${tile.harvestsLeft || 0}`;
    else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
        const building = tile.buildings[0];
        actionCountInfo = `Récoltes dispo: ${building.harvestsAvailable || 0}/${building.maxHarvestsPerCycle || 0}`;
    } else if (tile.type.name === TILE_TYPES.PLAGE.name && tile.actionsLeft) {
        actionCountInfo = `Fouilles: ${tile.actionsLeft.search_zone}, Sable: ${tile.actionsLeft.harvest_sand}, Pêche: ${tile.actionsLeft.fish}, Eau salée: ${tile.actionsLeft.harvest_salt_water}`;
    }

    if (mainDurabilityInfo && DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.textContent = mainDurabilityInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else if (actionCountInfo && DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.textContent = actionCountInfo;
        DOM.tileHarvestsInfoEl.style.display = 'block';
    } else if (DOM.tileHarvestsInfoEl) {
        DOM.tileHarvestsInfoEl.style.display = 'none';
    }

    // Update tile info in main view HUD - hide all to recover space
    const tileNameHud = document.getElementById('tile-name-hud');
    const tileDetailsHud = document.getElementById('tile-details-hud');

    if (tileNameHud) {
        tileNameHud.style.display = 'none'; // Remove biome type display
    }

    if (tileDetailsHud) {
        tileDetailsHud.style.display = 'none'; // Remove position and resources display to recover space
    }
}

// Initialize tab functionality for right panel
export function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active-tab'));

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active-tab');
        });
    });
}

// Update the actions tab content with possible actions
export function updateActionsTab() {
    const actionsEl = document.getElementById('actions-tab-content');
    if (!actionsEl) return;

    actionsEl.innerHTML = '';
    if (typeof window.getTileActions === 'function') {
        const actions = window.getTileActions();
        if (actions.length > 0) {
            actions.forEach(action => {
                const button = document.createElement('button');
                button.className = 'action-button';
                button.setAttribute('data-action', action.actionId);
                button.setAttribute('title', action.title || action.text);
                button.textContent = action.text;
                button.disabled = action.disabled;
                button.addEventListener('click', () => {
                    if (typeof window.handleGlobalPlayerAction === 'function') {
                        window.handleGlobalPlayerAction(action.actionId, action.data || {});
                    }
                });
                actionsEl.appendChild(button);
            });
        } else {
            const noActionsMsg = document.createElement('p');
            noActionsMsg.textContent = "Aucune action disponible pour cette tuile.";
            noActionsMsg.style.textAlign = 'center';
            noActionsMsg.style.padding = '10px';
            actionsEl.appendChild(noActionsMsg);
        }
    } else {
        const noActionsMsg = document.createElement('p');
        noActionsMsg.textContent = "Actions non disponibles pour le moment.";
        noActionsMsg.style.textAlign = 'center';
        noActionsMsg.style.padding = '10px';
        actionsEl.appendChild(noActionsMsg);
    }
}

export function addChatMessage(message, type, author) {
    const chatMessagesEl = document.getElementById('chat-messages');
    if (!chatMessagesEl) return;

    const msgDiv = document.createElement('div');
    msgDiv.classList.add('chat-message', type || 'system');
    let content = author ? `<strong>${author}: </strong>` : '';
    const spanMessage = document.createElement('span');
    spanMessage.textContent = message;
    if (type === 'npc-dialogue') {
        msgDiv.innerHTML = author ? `<strong>${author}: </strong>${message}` : message;
    } else {
        msgDiv.innerHTML = content + spanMessage.outerHTML;
    }
    chatMessagesEl.appendChild(msgDiv);

    if (DOM.bottomBarChatPanelEl && !DOM.bottomBarChatPanelEl.classList.contains('chat-enlarged')) {
        while (chatMessagesEl.children.length > 3) {
            chatMessagesEl.removeChild(chatMessagesEl.firstChild);
        }
    }
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    return msgDiv;
}

export function updateAllButtonsState(gameState) {
    if (!gameState || !gameState.player) return;
    const { player } = gameState;
    const isPlayerBusy = player.isBusy || !!player.animationState;

    document.querySelectorAll('.nav-button-overlay').forEach(b => {
        b.disabled = isPlayerBusy;
    });

    if (DOM.consumeHealthBtn) {
        let canHeal = false;
        if ((player.inventory['Kit de Secours'] > 0 && player.status.includes('Malade')) ||
            (player.inventory['Médicaments'] > 0 && (player.status.includes('Malade') || player.status.includes('Drogué'))) ||
            (player.inventory['Antiseptique'] > 0 && (player.status.includes('Blessé') || player.status.includes('Malade')) && player.health < player.maxHealth) ||
            (player.inventory['Bandage'] > 0 && player.health < player.maxHealth) ||
            (player.inventory['Savon'] > 0 && player.health < player.maxHealth) ||
            (player.inventory['Huile de coco'] > 0 && player.health < player.maxHealth)
        ) {
            canHeal = true;
        }
        DOM.consumeHealthBtn.disabled = isPlayerBusy || !canHeal || player.health >= player.maxHealth;
        DOM.consumeHealthBtn.style.visibility = (!canHeal) ? 'hidden' : 'visible';
    }
    if (DOM.consumeThirstBtn) {
        let canDrink = false;
        if ((player.inventory['Eau pure'] > 0 && player.thirst < player.maxThirst) ||
            (player.inventory['Noix de coco'] > 0 && player.thirst < player.maxThirst) ||
            (player.inventory['Alcool'] > 0 && player.thirst < player.maxThirst - 1)
        ) {
            canDrink = true;
        }
        DOM.consumeThirstBtn.disabled = isPlayerBusy || !canDrink;
        DOM.consumeThirstBtn.style.visibility = !canDrink ? 'hidden' : 'visible';
    }
    if (DOM.consumeHungerBtn) {
        let canEat = false;
        const foodItems = ['Viande cuite', 'Poisson cuit', 'Oeuf cuit', 'Barre Énergétique', 'Banane', 'Sucre', 'Sel'];
        for (const food of foodItems) {
            if (player.inventory[food] > 0 && player.hunger < player.maxHunger) {
                canEat = true;
                break;
            }
        }
        DOM.consumeHungerBtn.disabled = isPlayerBusy || !canEat;
        DOM.consumeHungerBtn.style.visibility = !canEat ? 'hidden' : 'visible';

    }

    if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    if (DOM.actionsEl) {
        DOM.actionsEl.querySelectorAll('button').forEach(b => {
            if (isPlayerBusy && !b.classList.contains('action-always-enabled')) {
                b.disabled = true;
            }
        });
    }
    if (DOM.buildModalGridEl) {
        DOM.buildModalGridEl.querySelectorAll('button').forEach(b => {
             if (isPlayerBusy && !b.classList.contains('action-always-enabled')) {
                b.disabled = true;
            }
        });
    }
}


export function updateGroundItemsPanel(tile) {
    if (!DOM.bottomBarGroundItemsEl || !tile) return;

    const groundItems = tile.groundItems || {};
    const list = DOM.bottomBarGroundItemsEl.querySelector('.ground-items-list');
    if (list) {
        list.innerHTML = '';
    } else {
        console.error("Élément .ground-items-list non trouvé dans #bottom-bar-ground-items");
        return;
    }

    if (Object.keys(groundItems).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Rien au sol)';
        list.appendChild(li);
    } else {
        for (const itemKey in groundItems) {
            const item = groundItems[itemKey];
            if (item) {
                const itemDef = ITEM_TYPES[item.name] || { icon: '❓' };
                const li = document.createElement('li');
                li.className = 'inventory-item clickable';
                li.dataset.itemKey = itemKey; // La clé unique de l'inventaire
                li.dataset.itemName = item.name; // Le nom de base pour la définition de l'objet
                li.dataset.itemCount = 1;
                li.setAttribute('draggable', 'true');
                li.dataset.owner = 'ground';

                li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${item.name}</span><span class="inventory-count">1</span>`;
                list.appendChild(li);
            }
        }
    }
}

export function updateBottomBarEquipmentPanel(player) {
    if (!DOM.bottomBarEquipmentPanelEl || !player || !DOM.bottomBarEquipmentSlotsEl) return;

    const slotsContainer = DOM.bottomBarEquipmentSlotsEl;
    slotsContainer.innerHTML = '';

    const slotTypesAndLabels = [
        { type: 'head', label: 'Tête' }, { type: 'weapon', label: 'Arme/Outil' },
        { type: 'shield', label: 'Bouclier' }, { type: 'body', label: 'Habits' },
        { type: 'feet', label: 'Chaussures' },
        { type: 'bag', label: 'Sac' }
    ];

    slotTypesAndLabels.forEach(slotInfo => {
        const slotContainer = document.createElement('div');
        slotContainer.className = 'equipment-slot-container-small droppable';
        const label = document.createElement('label');
        label.textContent = slotInfo.label;
        slotContainer.appendChild(label);

        const slotEl = document.createElement('div');
        slotEl.className = 'equipment-slot-small droppable';
        slotEl.dataset.slotType = slotInfo.type;
        slotEl.dataset.owner = 'equipment';

        const equippedItem = player.equipment[slotInfo.type];
        if (equippedItem) {
            const itemName = equippedItem.name || Object.keys(ITEM_TYPES).find(key => ITEM_TYPES[key] === equippedItem);
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓' };
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.setAttribute('draggable', 'true');
            itemDiv.dataset.itemName = itemName;
            itemDiv.dataset.owner = 'equipment';
            itemDiv.dataset.slotType = slotInfo.type;

            const iconEl = document.createElement('span');
            iconEl.className = 'inventory-icon';
            iconEl.textContent = itemDef.icon;
            itemDiv.appendChild(iconEl);

            if (equippedItem.hasOwnProperty('currentDurability') && equippedItem.hasOwnProperty('durability')) {
                const durabilityEl = document.createElement('span');
                durabilityEl.className = 'item-durability-overlay';
                durabilityEl.textContent = `${equippedItem.currentDurability}/${equippedItem.durability}`;
                itemDiv.appendChild(durabilityEl);
            }
            slotEl.appendChild(itemDiv);
        }
        slotContainer.appendChild(slotEl);
        slotsContainer.appendChild(slotContainer);
    });
}
