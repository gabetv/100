// js/ui/panels.js
import { ITEM_TYPES, TILE_TYPES } from '../config.js';
import { getTotalResources } from '../player.js';
import { state as gameState } from '../state.js';
import DOM from './dom.js';
import * as State from '../state.js';
import * as UI from '../ui.js';

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
    for (const itemKey in player.inventory) {
        const itemValue = player.inventory[itemKey];
        const isInstance = typeof itemValue === 'object' && itemValue.name;
        const baseItemName = isInstance ? itemValue.name : itemKey;
        const baseItemDef = ITEM_TYPES[baseItemName] || { type: 'resource', icon: '❓' };
        
        let type = 'divers';

        if (baseItemDef.type === 'resource' || baseItemDef.type === 'component') {
            type = 'ressources';
        } else if (baseItemDef.type === 'tool' || baseItemDef.type === 'weapon') {
            type = 'outilsEtArmes';
        } else if (baseItemDef.type === 'consumable' || baseItemDef.teachesRecipe) {
            type = 'nourritureEtSoins';
        } else if (baseItemDef.slot) {
            type = 'equipements';
        }
        
        // CORRIGÉ: S'assurer que les clés uniques sont préservées
        if (!categories[type][baseItemName]) {
            categories[type][baseItemName] = [];
        }
        categories[type][baseItemName].push({ key: itemKey, value: itemValue });
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
            
            Object.keys(itemsInCategory).sort().forEach(baseItemName => {
                const items = itemsInCategory[baseItemName];
                const firstItem = items[0].value;

                if (typeof firstItem === 'number') { // It's a stackable item
                    const itemDef = ITEM_TYPES[baseItemName] || { icon: '❓', rarity: 'common' };
                    const li = document.createElement('li');
                    li.className = `inventory-item rarity-${itemDef.rarity}`;
                    li.classList.add('clickable');
                    li.dataset.itemKey = baseItemName; // For stackable, key is name
                    li.dataset.itemName = baseItemName;
                    li.setAttribute('draggable', 'true');
                    li.dataset.owner = 'player-inventory';
                    const count = firstItem;
                    li.dataset.itemCount = count;
                    li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${baseItemName}</span><span class="inventory-count">${count}</span>`;
                    content.appendChild(li);

                } else { // It's one or more unique instances
                    items.forEach(itemData => {
                        const { key, value: instanceData } = itemData;
                        const itemDef = ITEM_TYPES[instanceData.name] || { icon: '❓', rarity: 'common' };
                         const li = document.createElement('li');
                        li.className = `inventory-item rarity-${itemDef.rarity}`;
                        li.classList.add('clickable');
                        li.dataset.itemKey = key; // Use the unique key
                        li.dataset.itemName = instanceData.name;
                        li.setAttribute('draggable', 'true');
                        li.dataset.owner = 'player-inventory';
                        li.dataset.itemCount = 1;
                        
                        let displayName = instanceData.name;
                        if (instanceData.hasOwnProperty('currentDurability')) {
                            displayName += ` (${instanceData.currentDurability}/${instanceData.durability})`;
                        } else if (instanceData.hasOwnProperty('currentUses')) {
                            displayName += ` (${instanceData.currentUses}/${instanceData.uses})`;
                        }

                        li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${displayName}</span><span class="inventory-count">1</span>`;
                        content.appendChild(li);
                    });
                }
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

    const quickSlotsContainer = document.getElementById('quick-slots');
    if (quickSlotsContainer) {
        quickSlotsContainer.innerHTML = '';
    }
}


export function updateDayCounter(day) {
    if (DOM.dayCounterTileInfoEl) {
        const span = DOM.dayCounterTileInfoEl;
        if (span) span.textContent = day;
    }
}

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

    DOM.tileNameEl.textContent = mainDisplayName;

    let actionCountInfo = "";
    if (tile.type.name === TILE_TYPES.FOREST.name) actionCountInfo = `Bois: ${tile.woodActionsLeft || 0}, Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.PLAINS.name) actionCountInfo = `Chasse: ${tile.huntActionsLeft || 0}, Fouille: ${tile.searchActionsLeft || 0}`;
    else if (tile.type.name === TILE_TYPES.MINE_TERRAIN.name) actionCountInfo = `Pierre: ${tile.harvestsLeft || 0}`;
    else if (tile.buildings && tile.buildings.length > 0 && TILE_TYPES[tile.buildings[0].key]?.maxHarvestsPerCycle) {
        const building = tile.buildings[0];
        actionCountInfo = `Récoltes: ${building.harvestsAvailable || 0}/${building.maxHarvestsPerCycle || 0}`;
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

    const tileNameHud = document.getElementById('tile-name-hud');
    const tileDetailsHud = document.getElementById('tile-details-hud');
    if (tileNameHud) tileNameHud.style.display = 'none';
    if (tileDetailsHud) tileDetailsHud.style.display = 'none';
}

export function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active-tab'));
            button.classList.add('active');
            const tabId = button.dataset.tab;
            document.getElementById(tabId).classList.add('active-tab');
        });
    });
}

export function updateActionsTab() {
    // Cette fonction est désormais gérée par updatePossibleActions dans main.js
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
        let canHeal = (player.inventory['Kit de Secours'] > 0 && player.status.includes('Malade')) ||
                      (player.inventory['Médicaments'] > 0 && (player.status.includes('Malade') || player.status.includes('Drogué'))) ||
                      (player.inventory['Antiseptique'] > 0 && (player.status.includes('Blessé') || player.status.includes('Malade')) && player.health < player.maxHealth) ||
                      (player.inventory['Bandage'] > 0 && player.health < player.maxHealth) ||
                      (player.inventory['Savon'] > 0 && player.health < player.maxHealth) ||
                      (player.inventory['Huile de coco'] > 0 && player.health < player.maxHealth);
        DOM.consumeHealthBtn.disabled = isPlayerBusy || !canHeal || player.health >= player.maxHealth;
        DOM.consumeHealthBtn.style.visibility = (!canHeal) ? 'hidden' : 'visible';
    }
    if (DOM.consumeThirstBtn) {
        let canDrink = (player.inventory['Eau pure'] > 0 && player.thirst < player.maxThirst) ||
                       (player.inventory['Noix de coco'] > 0 && player.thirst < player.maxThirst) ||
                       (player.inventory['Alcool'] > 0 && player.thirst < player.maxThirst - 1);
        DOM.consumeThirstBtn.disabled = isPlayerBusy || !canDrink;
        DOM.consumeThirstBtn.style.visibility = !canDrink ? 'hidden' : 'visible';
    }
    if (DOM.consumeHungerBtn) {
        const foodItems = ['Viande cuite', 'Poisson cuit', 'Oeuf cuit', 'Barre Énergétique', 'Banane', 'Sucre', 'Sel'];
        let canEat = foodItems.some(food => player.inventory[food] > 0 && player.hunger < player.maxHunger);
        DOM.consumeHungerBtn.disabled = isPlayerBusy || !canEat;
        DOM.consumeHungerBtn.style.visibility = !canEat ? 'hidden' : 'visible';
    }

    if (DOM.quickChatButton) DOM.quickChatButton.disabled = isPlayerBusy;

    document.querySelectorAll('.action-button').forEach(b => {
        if (isPlayerBusy && !b.classList.contains('action-always-enabled')) {
            b.disabled = true;
        }
    });
}


export function updateGroundItemsPanel(tile) {
    if (!DOM.bottomBarGroundItemsEl || !tile) return;

    const groundItems = tile.groundItems || {};
    const list = DOM.bottomBarGroundItemsEl.querySelector('.ground-items-list');
    if (!list) {
        console.error("Élément .ground-items-list non trouvé dans #bottom-bar-ground-items");
        return;
    }
    list.innerHTML = '';
    
    if (Object.keys(groundItems).length === 0) {
        const li = document.createElement('li');
        li.className = 'inventory-empty';
        li.textContent = '(Rien au sol)';
        list.appendChild(li);
    } else {
        for (const itemKey in groundItems) {
            const itemValue = groundItems[itemKey];
            const isInstance = typeof itemValue === 'object';
            const itemName = isInstance ? itemValue.name : itemKey;
            const count = isInstance ? 1 : itemValue;
            const itemDef = ITEM_TYPES[itemName] || { icon: '❓', rarity: 'common' };
            
            const li = document.createElement('li');
            li.className = `inventory-item clickable rarity-${itemDef.rarity}`;
            li.dataset.itemKey = itemKey;
            li.dataset.itemName = itemName;
            li.dataset.itemCount = count;
            li.setAttribute('draggable', 'true');
            li.dataset.owner = 'ground';

            li.innerHTML = `<span class="inventory-icon">${itemDef.icon}</span><span class="inventory-name">${itemName}</span><span class="inventory-count">${count}</span>`;
            list.appendChild(li);
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
        slotContainer.dataset.owner = 'equipment';
        slotContainer.dataset.slotType = slotInfo.type;
        const label = document.createElement('label');
        label.textContent = slotInfo.label;
        slotContainer.appendChild(label);

        const slotEl = document.createElement('div');
        slotEl.className = 'equipment-slot-small droppable';
        slotEl.dataset.slotType = slotInfo.type;
        slotEl.dataset.owner = 'equipment';

        const equippedItem = player.equipment[slotInfo.type];
        if (equippedItem) {
            const itemDef = ITEM_TYPES[equippedItem.name] || { icon: '❓' };
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.setAttribute('draggable', 'true');
            itemDiv.dataset.itemName = equippedItem.name;
            itemDiv.dataset.owner = 'equipment';
            itemDiv.dataset.slotType = slotInfo.type;
            // CORRIGÉ: Utiliser une clé unique pour l'item équipé pour le drag & drop
            itemDiv.dataset.itemKey = `${equippedItem.name}_equipped`;


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