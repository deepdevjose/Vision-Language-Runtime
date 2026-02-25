/**
 * Freeze Frame Component
 * Capture and caption a static frame
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassButton } from './glass-button.js';

export function createFreezeFrame(onFreeze, onUnfreeze) {
    let isFrozen = false;
    let frozenImageData = null;

    // Freeze button
    const freezeButton = createGlassButton({
        className: 'freeze-frame-button',
        ariaLabel: 'Freeze frame',
        children: [
            createElement('span', {
                className: 'freeze-icon',
                text: '📸'
            }),
            createElement('span', {
                className: 'freeze-text ml-2',
                text: 'Freeze'
            })
        ]
    });

    // Handle freeze/unfreeze
    freezeButton.addEventListener('click', () => {
        if (isFrozen) {
            unfreeze();
        } else {
            freeze();
        }
    });

    function freeze() {
        isFrozen = true;
        frozenImageData = null;
        
        // Update button UI
        const icon = freezeButton.querySelector('.freeze-icon');
        const text = freezeButton.querySelector('.freeze-text');
        icon.textContent = '▶️';
        text.textContent = 'Resume';
        freezeButton.classList.add('frozen');

        onFreeze?.();
    }

    function unfreeze() {
        isFrozen = false;
        frozenImageData = null;
        
        // Update button UI
        const icon = freezeButton.querySelector('.freeze-icon');
        const text = freezeButton.querySelector('.freeze-text');
        icon.textContent = '📸';
        text.textContent = 'Freeze';
        freezeButton.classList.remove('frozen');

        onUnfreeze?.();
    }

    function setFrozenFrame(imageData) {
        frozenImageData = imageData;
    }

    function getFrozenFrame() {
        return frozenImageData;
    }

    // Public API
    return {
        element: freezeButton,
        isFrozen: () => isFrozen,
        freeze,
        unfreeze,
        setFrozenFrame,
        getFrozenFrame
    };
}
