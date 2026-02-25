/**
 * Glass Button Component
 */

import { createElement } from '../utils/dom-helpers.js';

export function createGlassButton(config = {}) {
    const {
        className = '',
        onClick = null,
        ariaLabel = null,
        children = []
    } = config;

    const button = createElement('button', {
        className: 'glass-button ' + className,
        attributes: {
            ...(ariaLabel && { 'aria-label': ariaLabel })
        },
        children
    });

    if (onClick) {
        button.addEventListener('click', onClick);
    }

    return button;
}
