/**
 * Caption History Component
 * Shows last 20 captions with copy/export functionality
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassContainer } from './glass-container.js';

export function createCaptionHistory() {
    const MAX_HISTORY = 20;
    const history = []; // Array of {timestamp, prompt, caption, frozen}

    const container = createGlassContainer({
        className: 'caption-history-container rounded-2xl shadow-2xl',
        children: []
    });

    // Header
    const header = createElement('div', {
        className: 'caption-history-header'
    });

    const title = createElement('h3', {
        className: 'text-sm font-semibold text-gray-200',
        text: 'Caption History'
    });

    // Export button
    const exportBtn = createElement('button', {
        className: 'glass-button text-xs px-3 py-1',
        text: '📥 Export JSON',
        attributes: { 'aria-label': 'Export history as JSON' }
    });

    exportBtn.addEventListener('click', () => {
        exportHistory();
    });

    header.appendChild(title);
    header.appendChild(exportBtn);

    // History list
    const listContainer = createElement('div', {
        className: 'caption-history-list'
    });

    const emptyState = createElement('p', {
        className: 'text-sm text-gray-400 text-center py-4',
        text: 'No captions yet. Start capturing to see history.'
    });

    listContainer.appendChild(emptyState);

    container.appendChild(header);
    container.appendChild(listContainer);

    // Add caption to history
    function addCaption(caption, prompt, isFrozen = false) {
        const entry = {
            timestamp: new Date().toISOString(),
            prompt: prompt || 'N/A',
            caption: caption,
            frozen: isFrozen
        };

        history.unshift(entry); // Add to beginning
        if (history.length > MAX_HISTORY) {
            history.pop(); // Remove oldest
        }

        updateUI();
    }

    // Update UI to show current history
    function updateUI() {
        listContainer.innerHTML = '';

        if (history.length === 0) {
            listContainer.appendChild(emptyState.cloneNode(true));
            return;
        }

        history.forEach((entry, index) => {
            const item = createElement('div', {
                className: 'caption-history-item'
            });

            const meta = createElement('div', {
                className: 'caption-history-meta'
            });

            const time = new Date(entry.timestamp).toLocaleTimeString();
            const timeSpan = createElement('span', {
                className: 'text-xs text-gray-400',
                text: `${time}${entry.frozen ? ' 🧊' : ''}`
            });

            const promptSpan = createElement('span', {
                className: 'text-xs text-gray-500 italic truncate',
                text: entry.prompt.substring(0, 30) + (entry.prompt.length > 30 ? '...' : '')
            });

            meta.appendChild(timeSpan);
            meta.appendChild(promptSpan);

            const captionText = createElement('p', {
                className: 'caption-history-text',
                text: entry.caption
            });

            const actions = createElement('div', {
                className: 'caption-history-actions'
            });

            const copyBtn = createElement('button', {
                className: 'glass-button text-xs px-2 py-1',
                text: '📋',
                attributes: { 'aria-label': 'Copy caption' }
            });

            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(entry.caption).then(() => {
                    copyBtn.textContent = '✅';
                    setTimeout(() => {
                        copyBtn.textContent = '📋';
                    }, 1000);
                });
            });

            actions.appendChild(copyBtn);

            item.appendChild(meta);
            item.appendChild(captionText);
            item.appendChild(actions);

            listContainer.appendChild(item);
        });
    }

    // Export history as JSON
    function exportHistory() {
        const dataStr = JSON.stringify(history, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = createElement('a', {
            attributes: {
                href: url,
                download: `caption-history-${Date.now()}.json`
            }
        });
        link.click();
        URL.revokeObjectURL(url);
    }

    // Public API
    return {
        element: container,
        addCaption,
        getHistory: () => [...history],
        clearHistory: () => {
            history.length = 0;
            updateUI();
        }
    };
}
