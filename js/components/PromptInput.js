/**
 * Prompt Input Component - Bottom Sheet on Mobile
 */

import { createElement, addClass, removeClass } from '../utils/dom-helpers.js';
import { createGlassContainer } from './GlassContainer.js';
import { PROMPTS } from '../utils/constants.js';

export function createPromptInput(onPromptChange, onFocusChange) {
    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    let isExpanded = false; // Collapsed by default on mobile
    
    const container = createGlassContainer({
        className: isMobile ? 'prompt-input-bottom-sheet' : 'prompt-input-container rounded-2xl shadow-2xl',
        children: []
    });

    // Mobile: Header with handle and collapse button
    let header;
    if (isMobile) {
        header = createElement('div', {
            className: 'prompt-input-header'
        });

        const handle = createElement('div', {
            className: 'prompt-handle'
        });

        const titleRow = createElement('div', {
            className: 'prompt-title-row'
        });

        const title = createElement('span', {
            className: 'prompt-title-text',
            text: 'Prompt'
        });

        const chevron = createElement('button', {
            className: 'prompt-chevron',
            attributes: { 'aria-label': 'Expand/collapse' },
            children: [createElement('span', { text: '▲' })]
        });

        titleRow.appendChild(title);
        titleRow.appendChild(chevron);
        header.appendChild(handle);
        header.appendChild(titleRow);
    }

    const content = createElement('div', {
        className: isMobile ? 'prompt-input-content' : 'p-4'
    });

    const label = createElement('label', {
        className: 'text-sm font-semibold text-gray-200 mb-2',
        text: 'Prompt:',
        style: { display: isMobile ? 'none' : 'block' }
    });

    const textarea = createElement('textarea', {
        className: 'prompt-textarea',
        attributes: {
            placeholder: PROMPTS.placeholder,
            rows: isMobile ? '2' : '3'
        }
    });

    textarea.value = PROMPTS.default;

    // Handle input changes
    let debounceTimer;
    textarea.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const value = e.target.value.trim() || PROMPTS.default;
            onPromptChange?.(value);
        }, 300);
    });

    // Focus/blur handlers for conditional visibility
    textarea.addEventListener('focus', () => {
        onFocusChange?.(true);
        if (isMobile && !isExpanded) {
            toggleExpand();
        }
    });

    textarea.addEventListener('blur', () => {
        // Delay to allow click events on suggestions
        setTimeout(() => {
            if (isMobile && document.activeElement !== textarea) {
                onFocusChange?.(false);
            }
        }, 150);
    });

    const suggestionsLabel = createElement('p', {
        className: 'text-sm text-gray-400 mt-3 mb-2',
        text: 'Suggestions:',
        style: { display: isMobile ? 'none' : 'block' }
    });

    const suggestionsContainer = createElement('div', {
        className: 'prompt-suggestions'
    });

    PROMPTS.suggestions.forEach((suggestion) => {
        const chip = createElement('button', {
            className: 'prompt-suggestion-chip',
            text: suggestion.substring(0, 30) + (suggestion.length > 30 ? '...' : '')
        });

        chip.addEventListener('click', (e) => {
            e.stopPropagation();
            textarea.value = suggestion;
            onPromptChange?.(suggestion);
            if (isMobile) {
                // Keep focus briefly then collapse
                textarea.focus();
                setTimeout(() => {
                    textarea.blur();
                    if (isExpanded) toggleExpand();
                }, 100);
            } else {
                textarea.focus();
            }
        });

        suggestionsContainer.appendChild(chip);
    });

    content.appendChild(label);
    content.appendChild(textarea);
    content.appendChild(suggestionsLabel);
    content.appendChild(suggestionsContainer);

    // Assemble
    if (isMobile && header) {
        container.appendChild(header);
    }
    container.appendChild(content);

    // Toggle expand/collapse on mobile
    const toggleExpand = () => {
        if (!isMobile) return;
        
        isExpanded = !isExpanded;
        const chevron = header?.querySelector('.prompt-chevron span');
        
        if (isExpanded) {
            addClass(container, 'expanded');
            removeClass(container, 'collapsed');
            if (chevron) chevron.textContent = '▼';
        } else {
            removeClass(container, 'expanded');
            addClass(container, 'collapsed');
            if (chevron) chevron.textContent = '▲';
            textarea.blur();
        }
    };

    // Click handlers for mobile
    if (isMobile && header) {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.prompt-chevron')) {
                toggleExpand();
            } else {
                // Tapping anywhere on header expands and focuses
                if (!isExpanded) {
                    toggleExpand();
                }
                setTimeout(() => textarea.focus(), 100);
            }
        });
    }

    // Set initial state (collapsed and hidden on mobile)
    if (isMobile) {
        addClass(container, 'collapsed');
        container.style.display = 'none'; // Hidden by default on mobile
        
        // Listen for toggle event
        window.addEventListener('togglePrompt', () => {
            if (container.style.display === 'none') {
                container.style.display = '';
                onFocusChange?.(true); // Notify that prompt is shown
                setTimeout(() => {
                    if (!isExpanded) toggleExpand();
                    setTimeout(() => textarea.focus(), 100);
                }, 50);
            } else {
                container.style.display = 'none';
                onFocusChange?.(false); // Notify that prompt is hidden
                if (isExpanded) toggleExpand();
            }
        });
    }

    // Public methods
    container.show = () => {
        container.style.display = '';
        onFocusChange?.(true);
        if (isMobile && !isExpanded) {
            toggleExpand();
        }
    };

    container.hide = () => {
        container.style.display = 'none';
        onFocusChange?.(false);
        if (isMobile && isExpanded) {
            toggleExpand();
        }
    };

    container.collapse = () => {
        if (isMobile && isExpanded) {
            toggleExpand();
        }
    };

    container.toggle = () => {
        if (container.style.display === 'none') {
            container.show();
        } else {
            container.hide();
        }
    };

    return container;
}
