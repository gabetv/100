// js/admin.js
import { ITEM_TYPES } from './config.js'; // CORRIGÉ: de '../config.js' à './config.js'
import * as State from './state.js';       // CORRIGÉ: de '../state.js' à './state.js'
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

    let itemsGivenCount = 0;
    const itemsToGiveDetails = {}; // Pour le log console

    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        // Donner ressources, consommables, clés, et 'usable' simples.
        // Exclure les équipements (type: tool, weapon, shield, armor, body, head, feet, bag)
        // car ils ne stackent pas de la même manière et sont destinés à être équipés.
        if (itemDef.type === 'resource' ||
            itemDef.type === 'consumable' ||
            itemDef.type === 'key' ||
            (itemDef.type === 'usable' && !itemDef.slot && itemName !== 'Torche') || // 'usable' sans slot (ex: Boussole, Sifflet, Carte). Exclure Torche (qui a un slot)
            (itemName === 'Torche' && itemDef.slot === 'weapon') // Inclure spécifiquement la torche si elle est de type 'weapon'
           ) {

            let quantity = 100; // Quantité par défaut
            if (itemDef.type === 'key' || itemDef.unique) {
                quantity = 1;
            } else if (itemDef.uses || (itemDef.hasOwnProperty('durability') && itemDef.type === 'consumable')) {
                // Pour les objets avec 'uses' (comme Carte) ou consommables avec durabilité (comme Allumettes, Briquet)
                quantity = 5; // En donner quelques-uns
            } else if (itemName === 'Torche') {
                quantity = 5; // 5 torches
            }


            // Ne pas donner si c'est un parchemin déjà connu
            if (itemDef.teachesRecipe && State.state.knownRecipes[itemDef.teachesRecipe]) {
                // Si on veut quand même donner le parchemin même si connu, commenter cette condition
                // Pour l'instant, on ne le donne pas s'il est connu pour éviter le spam.
                // Si on veut le donner, on peut ajouter 1 à player.inventory et logger, puis continuer.
            } else {
                 State.addResourceToPlayer(itemName, quantity);
                 itemsGivenCount++;
                 itemsToGiveDetails[itemName] = (itemsToGiveDetails[itemName] || 0) + quantity;
            }
        }
    }

    // Donner spécifiquement 1 exemplaire de chaque parchemin non encore connu
    // (même si la logique ci-dessus avec type 'consumable' les couvre, ceci est plus explicite)
    for (const itemName in ITEM_TYPES) {
        const itemDef = ITEM_TYPES[itemName];
        if (itemDef.teachesRecipe && !State.state.knownRecipes[itemDef.teachesRecipe]) {
            if (!itemsToGiveDetails[itemName]) { // S'il n'a pas déjà été ajouté par la boucle précédente
                 State.addResourceToPlayer(itemName, 1);
                 itemsGivenCount++; // Compter comme un type d'item distinct si pas déjà compté
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
    if (clickTimer) clearTimeout(clickTimer); // Annule le timer précédent si on clique à nouveau

    if (clickCount >= REQUIRED_CLICKS) {
        clickCount = 0; // Reset
        showAdminModal();
    } else {
        clickTimer = setTimeout(() => {
            clickCount = 0; // Reset après un délai si le nombre requis n'est pas atteint
        }, 700); // Ex: 5 clics en 0.7 secondes
    }
}

export function initAdminControls() {
    console.log("admin.js: initAdminControls() a été appelée."); // Log de test
    adminModalEl = document.getElementById('admin-modal');
    const giveAllBtn = document.getElementById('admin-give-all-resources-btn');
    const closeAdminBtn = document.getElementById('admin-close-modal-btn');

    if (!adminModalEl || !giveAllBtn || !closeAdminBtn) {
        console.error("Admin: Modal elements not found in DOM. (#admin-modal, #admin-give-all-resources-btn, #admin-close-modal-btn)");
        return;
    }
    console.log("Admin: Modal elements trouvés."); // Log de test

    giveAllBtn.addEventListener('click', handleGiveAllResources);
    closeAdminBtn.addEventListener('click', hideAdminModal);

    adminTriggerEl = document.createElement('div');
    adminTriggerEl.id = 'admin-trigger-dot';
    adminTriggerEl.style.cssText = `
        position: fixed;
        bottom: 3px; /* Ajusté pour être plus discret */
        left: 3px;   /* Ajusté pour être plus discret */
        width: 8px;  /* Plus petit */
        height: 8px; /* Plus petit */
        background-color: rgba(128,0,0,0.4); /* Rouge foncé semi-transparent */
        z-index: 10000;
        cursor: pointer;
        border-radius: 50%;
        opacity: 0.3; /* Plus discret */
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
    console.log("Admin: Trigger dot ajouté au body."); // Log de test
    adminTriggerEl.addEventListener('click', adminTriggerClickHandler);

    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'm') { // Ctrl+Alt+M (M pour Menu)
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