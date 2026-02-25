/**
 * Glass Container Component
 */

import { createElement } from '../utils/dom-helpers.js';

export function createGlassContainer(config = {}) {
    const {
        className = '',
        bgColor = null,
        role = null,
        ariaLabel = null,
        children = []
    } = config;

    let containerClass = 'glass-container ' + className;

    if (bgColor) {
        if (bgColor.includes('50, 0, 0')) {
            containerClass += ' glass-error';
        } else if (bgColor.includes('0, 50, 0')) {
            containerClass += ' glass-success';
        }
    }

    const container = createElement('div', {
        className: containerClass,
        attributes: {
            ...(role && { role }),
            ...(ariaLabel && { 'aria-label': ariaLabel })
        },
        style: bgColor ? { background: bgColor } : {},
        children
    });

    return container;
}
