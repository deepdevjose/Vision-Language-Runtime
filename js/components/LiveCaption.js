/**
 * Live Caption Component - Bottom Sheet
 */

import { createElement, addClass, removeClass } from '../utils/dom-helpers.js';
import { createGlassContainer } from './GlassContainer.js';
import { PROMPTS } from '../utils/constants.js';

export function createLiveCaption() {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    let isExpanded = !isMobile; // Collapsed by default on mobile
    let isPaused = false;
    
    const container = createGlassContainer({
        className: isMobile ? 'live-caption-bottom-sheet' : 'live-caption-container rounded-2xl shadow-2xl',
        children: []
    });

    // Header with controls
    const header = createElement('div', {
        className: 'live-caption-header'
    });

    // Live indicator pill
    const liveIndicator = createElement('div', {
        className: 'live-pill',
        children: [
            createElement('span', {
                className: 'live-pill-dot'
            }),
            createElement('span', {
                className: 'live-pill-text',
                text: 'Live'
            })
        ]
    });

    // Controls container
    const controls = createElement('div', {
        className: 'caption-controls'
    });

    // Copy button
    const copyBtn = createElement('button', {
        className: 'caption-control-btn',
        attributes: { 'aria-label': 'Copy caption' },
        children: [
            createElement('span', { text: '📋' })
        ]
    });
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const text = captionText.textContent;
        if (text && text !== PROMPTS.fallbackCaption) {
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '<span>✓</span>';
                setTimeout(() => {
                    copyBtn.innerHTML = '<span>📋</span>';
                }, 1500);
            }).catch(err => console.error('Failed to copy:', err));
        }
    });

    // Clear button
    const clearBtn = createElement('button', {
        className: 'caption-control-btn',
        attributes: { 'aria-label': 'Clear caption' },
        children: [
            createElement('span', { text: '🗑️' })
        ]
    });
    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        captionText.textContent = PROMPTS.fallbackCaption;
        removeClass(captionText, 'live-caption-error');
    });

    // Pause button
    const pauseBtn = createElement('button', {
        className: 'caption-control-btn',
        attributes: { 'aria-label': 'Pause updates' },
        children: [
            createElement('span', { text: '⏸️' })
        ]
    });
    pauseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused ? '<span>▶️</span>' : '<span>⏸️</span>';
        if (isPaused) {
            addClass(container, 'caption-paused');
        } else {
            removeClass(container, 'caption-paused');
        }
    });

    // Edit prompt button (mobile only) - shows prompt sheet
    let editPromptBtn;
    if (isMobile) {
        editPromptBtn = createElement('button', {
            className: 'caption-control-btn',
            attributes: { 'aria-label': 'Edit prompt' },
            children: [
                createElement('span', { text: '✏️' })
            ]
        });
        editPromptBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Dispatch event to show prompt
            window.dispatchEvent(new CustomEvent('togglePrompt'));
        });
    }

    // Expand/collapse chevron (mobile only)
    const chevron = createElement('button', {
        className: 'caption-chevron',
        attributes: { 'aria-label': 'Expand/collapse' },
        children: [
            createElement('span', { text: '▲' })
        ]
    });
    
    controls.appendChild(copyBtn);
    controls.appendChild(clearBtn);
    controls.appendChild(pauseBtn);
    if (isMobile && editPromptBtn) {
        controls.appendChild(editPromptBtn);
    }
    if (isMobile) {
        controls.appendChild(chevron);
    }

    header.appendChild(liveIndicator);
    header.appendChild(controls);

    // Content area
    const content = createElement('div', {
        className: 'live-caption-content'
    });

    const captionText = createElement('p', {
        className: 'live-caption-text',
        text: PROMPTS.fallbackCaption
    });

    content.appendChild(captionText);

    // Assemble container
    container.appendChild(header);
    container.appendChild(content);

    // Toggle expand/collapse on mobile
    const toggleExpand = () => {
        if (!isMobile) return;
        
        isExpanded = !isExpanded;
        if (isExpanded) {
            addClass(container, 'expanded');
            removeClass(container, 'collapsed');
            chevron.innerHTML = '<span>▼</span>';
        } else {
            removeClass(container, 'expanded');
            addClass(container, 'collapsed');
            chevron.innerHTML = '<span>▲</span>';
        }
    };

    // Click handlers
    header.addEventListener('click', toggleExpand);
    chevron.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleExpand();
    });

    // Set initial state
    if (isMobile && !isExpanded) {
        addClass(container, 'collapsed');
    }

    // Handle keyboard visibility on mobile
    if (isMobile && window.visualViewport) {
        window.visualViewport.addEventListener('resize', () => {
            const viewportHeight = window.visualViewport.height;
            const windowHeight = window.innerHeight;
            
            // Keyboard is open if viewport is significantly smaller
            if (windowHeight - viewportHeight > 150) {
                // Collapse when keyboard opens
                if (isExpanded) {
                    toggleExpand();
                }
            }
        });
    }

    // Public methods
    container.updateCaption = (caption, isStreaming = false) => {
        if (isPaused) return; // Don't update if paused
        
        // Trigger fade-in animation by removing and re-adding
        captionText.style.animation = 'none';
        // Force reflow to restart animation
        void captionText.offsetHeight;
        captionText.style.animation = '';
        
        captionText.textContent = caption || PROMPTS.fallbackCaption;

        if (isStreaming) {
            addClass(captionText, 'live-caption-streaming');
            addClass(liveIndicator, 'streaming');
        } else {
            removeClass(captionText, 'live-caption-streaming');
            removeClass(liveIndicator, 'streaming');
        }

        removeClass(captionText, 'live-caption-error');
    };

    container.showError = (errorMessage) => {
        if (isPaused) return;
        
        captionText.textContent = 'Error: ' + errorMessage;
        addClass(captionText, 'live-caption-error');
        removeClass(captionText, 'live-caption-streaming');
        removeClass(liveIndicator, 'streaming');
    };

    container.isPaused = () => isPaused;

    container.show = () => {
        container.style.display = '';
    };

    container.hide = () => {
        container.style.display = 'none';
    };

    return container;
}
