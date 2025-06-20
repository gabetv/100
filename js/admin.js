// js/admin.js
import { ITEM_TYPES } from './config.js';
import * as State from './state.js';
import * as UI from './ui.js'; // Pour addChatMessage

let adminModalEl = null;
let adminTriggerEl = null;
let clickCount = 0;
let clickTimer = null;
const REQUIRED_CLICKS = 5; // Nombre de clics pour activer

function showAdminModal() {
    if (adminModalEl) adminModalEl.classList.remove('hidden');
}

function hideAdminModal() {
    if (adminModalEl) adminModalEl.classList.add('hidden');
}

function handleGiveAllResources() {
    const player = State.state.player;
    if (!player) {
        console.warn("Admin: Player not found.");
        UI.addChatMessage("Erreur Admin: Joueur non trouvé.", "system_error");
        return;
    }

    // --- MODIFICATION : Augmenter maxInventory ---
    player.maxInventory = 15000;
    UI.addChatMessage(`Admin: Capacité d'inventaire augmentée à ${player.maxInventory}.`, "system_event");
    // --- FIN MODIFICATION ---

    let itemsGivenCount = 0;
    const itemsToGiveDetails = {}; // Pour le log console

    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.type === 'resource' ||
            itemDef.type === 'consumable' ||
            itemDef.type === 'key' ||
            (itemDef.type === 'usable' && !itemDef.slot && itemName !== 'Torche') ||
            (itemName === 'Torche' && itemDef.slot === 'weapon')
           ) {

            let quantity = 100;
            if (itemDef.type === 'key' || itemDef.unique) {
                quantity = 1;
            } else if (itemDef.uses || (itemDef.hasOwnProperty('durability') && itemDef.type === 'consumable')) {
                quantity = 5;
            } else if (itemName === 'Torche') {
                quantity = 5;
            }

            if (itemDef.teachesRecipe && State.state.knownRecipes[itemDef.teachesRecipe]) {
                // Ne rien faire si la recette est déjà connue
            } else {
                 State.addResourceToPlayer(itemName, quantity);
                 itemsGivenCount++;
                 itemsToGiveDetails[itemName] = (itemsToGiveDetails[itemName] || 0) + quantity;
            }
        }
    }

    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && !State.state.knownRecipes[itemDef.teachesRecipe]) {
            if (!itemsToGiveDetails[itemName]) {
                 State.addResourceToPlayer(itemName, 1);
                 itemsGivenCount++;
                 itemsToGiveDetails[itemName] = (itemsToGiveDetails[itemName] || 0) + 1;
            }
        }
    }

    if (itemsGivenCount > 0) {
        UI.addChatMessage(`Admin: ${itemsGivenCount} types d'objets/ressources ajoutés à l'inventaire.`, "system_event");
        console.log("Admin: Items given:", itemsToGiveDetails);
    } else {
        UI.addChatMessage("Admin: Aucun objet pertinent à ajouter (ou déjà tous connus/ajoutés).", "system");
    }

    if (window.fullUIUpdate) {
        window.fullUIUpdate();
    }
    hideAdminModal();
}

function adminTriggerClickHandler() {
    clickCount++;
    if (clickTimer) clearTimeout(clickTimer);

    if (clickCount >= REQUIRED_CLICKS) {
        clickCount = 0;
        showAdminModal();
    } else {
        clickTimer = setTimeout(() => {
            clickCount = 0;
        }, 700);
    }
}

export function initAdminControls() {
    console.log("admin.js: initAdminControls() a été appelée.");
    adminModalEl = document.getElementById('admin-modal');
    const giveAllBtn = document.getElementById('admin-give-all-resources-btn');
    const closeAdminBtn = document.getElementById('admin-close-modal-btn');

    if (!adminModalEl || !giveAllBtn || !closeAdminBtn) {
        console.error("Admin: Modal elements not found in DOM. (#admin-modal, #admin-give-all-resources-btn, #admin-close-modal-btn)");
        return;
    }
    console.log("Admin: Modal elements trouvés.");

    giveAllBtn.addEventListener('click', handleGiveAllResources);
    closeAdminBtn.addEventListener('click', hideAdminModal);

    adminTriggerEl = document.createElement('div');
    adminTriggerEl.id = 'admin-trigger-dot';
    adminTriggerEl.style.cssText = `
        position: fixed;
        bottom: 3px;
        left: 3px;
        width: 8px;
        height: 8px;
        background-color: rgba(128,0,0,0.4);
        z-index: 10000;
        cursor: pointer;
        border-radius: 50%;
        opacity: 0.3;
        transition: opacity 0.3s, background-color 0.3s;
    `;
    adminTriggerEl.title = `Admin Panel (${REQUIRED_CLICKS} clicks)`;
    adminTriggerEl.addEventListener('mouseenter', () => {
        adminTriggerEl.style.opacity = '0.8';
        adminTriggerEl.style.backgroundColor = 'rgba(255,0,0,0.6)';
    });
    adminTriggerEl.addEventListener('mouseleave', () => {
        adminTriggerEl.style.opacity = '0.3';
        adminTriggerEl.style.backgroundColor = 'rgba(128,0,0,0.4)';
    });

    document.body.appendChild(adminTriggerEl);
    console.log("Admin: Trigger dot ajouté au body.");
    adminTriggerEl.addEventListener('click', adminTriggerClickHandler);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') {
            e.preventDefault();
            if (adminModalEl.classList.contains('hidden')) {
                showAdminModal();
            } else {
                hideAdminModal();
            }
        } else if (e.key === 'Escape' && adminModalEl && !adminModalEl.classList.contains('hidden')) {
            hideAdminModal();
        }
    });

    console.log(`Admin controls initialized. Click the bottom-left dot ${REQUIRED_CLICKS} times, or press Ctrl+Alt+M.`);
}