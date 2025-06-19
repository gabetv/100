// js/ui/effects.js

export function showFloatingText(text, type) {
    const mainView = document.getElementById('main-view-container');
    const textEl = document.createElement('div');
    textEl.textContent = text;
    textEl.className = `floating-text ${type}`;
    const rect = mainView.getBoundingClientRect();
    textEl.style.left = `${rect.left + rect.width / 2}px`;
    textEl.style.top = `${rect.top + rect.height / 3}px`;
    document.body.appendChild(textEl);
    setTimeout(() => {
        textEl.remove();
    }, 2000);
}

export function triggerActionFlash(type) {
    const flashEl = document.getElementById('action-flash');
    flashEl.className = '';
    void flashEl.offsetWidth; // Force reflow
    flashEl.classList.add(type === 'gain' ? 'flash-gain' : 'flash-cost');
}

export function triggerShake(element) {
    if (!element) return;
    element.classList.add('action-failed-shake');
    setTimeout(() => {
        element.classList.remove('action-failed-shake');
    }, 500);
}

export function resizeGameView() {
    const wrapper = document.getElementById('main-view-wrapper');
    const container = document.getElementById('main-view-container');
    if (!wrapper || !container) return;

    // CORRECTION : On s'assure que la taille n'est jamais négative
    const size = Math.max(10, Math.min(wrapper.clientWidth, wrapper.clientHeight) - 10);
    
    container.style.width = `${size}px`;
    container.style.height = `${size}px`;

    const mainViewCanvas = document.getElementById('main-view-canvas');
    const charactersCanvas = document.getElementById('characters-canvas');
    if(mainViewCanvas) {
        mainViewCanvas.width = size;
        mainViewCanvas.height = size;
    }
    if(charactersCanvas) {
        charactersCanvas.width = size;
        charactersCanvas.height = size;
    }
}