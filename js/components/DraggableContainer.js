/**
 * Draggable Container Component
 */

import { createElement, addClass, removeClass } from '../utils/dom-helpers.js';

export function createDraggableContainer(config = {}) {
    const {
        initialPosition = 'bottom-left',
        children = []
    } = config;

    const container = createElement('div', {
        className: 'draggable-container',
        children
    });

    // Set initial position
    const margin = 20;
    if (initialPosition === 'bottom-left') {
        container.style.left = margin + 'px';
        container.style.bottom = margin + 'px';
    } else if (initialPosition === 'bottom-right') {
        container.style.right = margin + 'px';
        container.style.bottom = margin + 'px';
    }

    // Dragging state
    let isDragging = false;
    let currentX = 0;
    let currentY = 0;
    let initialX = 0;
    let initialY = 0;
    let containerWidth = 0;
    let containerHeight = 0;
    
    // Disable dragging on mobile devices (position fixed via CSS)
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    function dragStart(e) {
        // Skip on mobile (fixed positioning via CSS)
        if (isMobile) return;
        
        // Don't drag if clicking on interactive elements
        const target = e.target;
        if (target.tagName === 'BUTTON' || 
            target.tagName === 'TEXTAREA' || 
            target.tagName === 'INPUT' ||
            target.closest('button') ||
            target.closest('textarea') ||
            target.closest('input')) {
            return;
        }

        // Use pointer events (unified for mouse/touch/pen)
        initialX = e.clientX - currentX;
        initialY = e.clientY - currentY;

        isDragging = true;
        addClass(container, 'dragging');
        
        // Cache dimensions during drag start to avoid layout thrashing
        const rect = container.getBoundingClientRect();
        containerWidth = rect.width;
        containerHeight = rect.height;
        
        // Set pointer capture for better tracking
        container.setPointerCapture(e.pointerId);
    }

    function drag(e) {
        if (!isDragging) return;

        e.preventDefault();

        currentX = e.clientX - initialX;
        currentY = e.clientY - initialY;

        // Use cached dimensions instead of getBoundingClientRect()
        const maxX = window.innerWidth - containerWidth;
        const maxY = window.innerHeight - containerHeight;

        // Constrain to viewport
        currentX = Math.max(0, Math.min(currentX, maxX));
        currentY = Math.max(0, Math.min(currentY, maxY));

        container.style.left = currentX + 'px';
        container.style.top = currentY + 'px';
        container.style.right = 'auto';
        container.style.bottom = 'auto';
    }

    function dragEnd(e) {
        if (!isDragging) return;
        
        isDragging = false;
        removeClass(container, 'dragging');
        
        // Release pointer capture (only if we captured it)
        try {
            container.releasePointerCapture(e.pointerId);
        } catch (err) {
            // Ignore if pointer wasn't captured
        }
    }

    // Use pointer events (modern, unified API for mouse/touch/pen)
    container.addEventListener('pointerdown', dragStart);
    container.addEventListener('pointermove', drag);
    container.addEventListener('pointerup', dragEnd);
    container.addEventListener('pointercancel', dragEnd);

    // Cleanup function
    container.cleanup = () => {
        container.removeEventListener('pointerdown', dragStart);
        container.removeEventListener('pointermove', drag);
        container.removeEventListener('pointerup', dragEnd);
        container.removeEventListener('pointercancel', dragEnd);
    };

    return container;
}
