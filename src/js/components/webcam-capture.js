/**
 * Webcam Capture Component (Play/Pause controls)
 */

import { createElement, addClass, removeClass } from '../utils/dom-helpers.js';

export function createWebcamCapture(onToggle) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    
    const container = createElement('div', {
        className: 'webcam-controls'
    });

    // Toggle button (Play/Pause)
    const toggleButton = createElement('button', {
        className: 'webcam-toggle-btn',
        attributes: {
            'aria-label': 'Toggle video captioning'
        }
    });

    // Play icon (default state)
    const playIcon = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
        </svg>
    `;

    // Pause icon
    const pauseIcon = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
        </svg>
    `;

    let isRunning = true;
    toggleButton.innerHTML = pauseIcon;

    toggleButton.addEventListener('click', () => {
        isRunning = !isRunning;
        toggleButton.innerHTML = isRunning ? pauseIcon : playIcon;

        if (isRunning) {
            removeClass(toggleButton, 'paused');
        } else {
            addClass(toggleButton, 'paused');
        }

        onToggle?.(isRunning);
    });

    container.appendChild(toggleButton);

    // Processing pill (mobile: top-right, desktop: below button)
    const processingPill = createElement('div', {
        className: isMobile ? 'processing-pill' : 'webcam-status',
        text: ''
    });

    if (isMobile) {
        // Position separately in top-right
        processingPill.style.position = 'fixed';
        processingPill.style.top = '20px';
        processingPill.style.right = '20px';
        processingPill.style.zIndex = '10';
        document.body.appendChild(processingPill); // Add to body for top-right positioning
    } else {
        container.appendChild(processingPill);
    }

    // Auto-hide timer
    let hideTimer;
    const autoHide = () => {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => {
            processingPill.style.opacity = '0';
            processingPill.style.transform = 'translateY(-10px)';
        }, 3000);
    };

    // Public methods
    container.updateStatus = (status, isError = false) => {
        processingPill.textContent = status;
        
        if (isError) {
            addClass(processingPill, 'error');
        } else {
            removeClass(processingPill, 'error');
        }

        // Show pill and auto-hide
        processingPill.style.opacity = '1';
        processingPill.style.transform = 'translateY(0)';
        
        if (!isError && isMobile) {
            autoHide();
        }
    };

    container.setRunning = (running) => {
        isRunning = running;
        toggleButton.innerHTML = isRunning ? pauseIcon : playIcon;

        if (isRunning) {
            removeClass(toggleButton, 'paused');
        } else {
            addClass(toggleButton, 'paused');
        }
    };

    // Cleanup
    container.cleanup = () => {
        if (isMobile && processingPill.parentElement) {
            processingPill.parentElement.removeChild(processingPill);
        }
    };

    return container;
}
