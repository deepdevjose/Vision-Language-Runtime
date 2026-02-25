/**
 * Error Screen Component
 * Formal error state display with recovery actions
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassContainer } from './glass-container.js';
import { createGlassButton } from './glass-button.js';
import logger from '../utils/logger.js';

/**
 * Error icon mapping
 */
const ERROR_ICONS = {
    'CAMERA_DENIED': '🚫',
    'CAMERA_NOT_FOUND': '📷',
    'STREAM_LOST': '⚠️',
    'MODEL_LOAD_FAILED': '❌',
    'WEBGPU_NOT_SUPPORTED': '⚡',
    'UNKNOWN_ERROR': '⚠️'
};

/**
 * Creates error screen component
 * @param {Object} errorState - Error state object
 * @param {string} errorState.code - Error code
 * @param {string} errorState.message - User-friendly message
 * @param {string} [errorState.technical] - Technical details
 * @param {Object} [errorState.recoverAction] - Recovery action
 * @param {string} errorState.recoverAction.label - Button label
 * @param {Function} errorState.recoverAction.handler - Click handler
 * @returns {HTMLElement}
 */
export function createErrorScreen(errorState) {
    logger.error('Error screen displayed', {
        code: errorState.code,
        message: errorState.message,
        technical: errorState.technical
    });

    const wrapper = createElement('div', {
        className: 'error-screen-wrapper flex items-center justify-center min-h-screen'
    });

    const container = createGlassContainer({
        className: 'max-w-md mx-4 p-8'
    });

    // Error icon
    const icon = createElement('div', {
        className: 'text-6xl text-center mb-6 animate-pulse',
        textContent: ERROR_ICONS[errorState.code] || ERROR_ICONS['UNKNOWN_ERROR']
    });

    // Error title
    const title = createElement('h2', {
        className: 'text-2xl font-light text-center mb-3',
        textContent: getErrorTitle(errorState.code)
    });

    // Error message
    const message = createElement('p', {
        className: 'text-sm opacity-80 text-center mb-6 leading-relaxed',
        textContent: errorState.message
    });

    // Technical details (collapsible)
    let technicalDetails = null;
    if (errorState.technical) {
        const detailsToggle = createElement('button', {
            className: 'text-xs opacity-60 hover:opacity-100 transition-opacity mb-4 w-full text-center underline',
            textContent: 'Show technical details'
        });

        technicalDetails = createElement('div', {
            className: 'hidden bg-black/30 rounded-lg p-4 mb-6 text-xs font-mono overflow-x-auto'
        });

        const technicalText = createElement('code', {
            className: 'text-red-300',
            textContent: errorState.technical
        });

        technicalDetails.appendChild(technicalText);

        let isExpanded = false;
        detailsToggle.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                technicalDetails.classList.remove('hidden');
                detailsToggle.textContent = 'Hide technical details';
            } else {
                technicalDetails.classList.add('hidden');
                detailsToggle.textContent = 'Show technical details';
            }
        });

        container.appendChild(detailsToggle);
        container.appendChild(technicalDetails);
    }

    // Action buttons
    const buttonContainer = createElement('div', {
        className: 'flex gap-3 justify-center'
    });

    // Recovery action button
    if (errorState.recoverAction) {
        const recoverButton = createGlassButton({
            text: errorState.recoverAction.label,
            className: 'px-6 py-3'
        });

        recoverButton.addEventListener('click', () => {
            logger.info('Recovery action triggered', { code: errorState.code });
            errorState.recoverAction.handler();
        });

        buttonContainer.appendChild(recoverButton);
    }

    // Always provide a "Reload" fallback
    const reloadButton = createGlassButton({
        text: 'Reload Page',
        className: 'px-6 py-3 opacity-60'
    });

    reloadButton.addEventListener('click', () => {
        logger.info('Manual page reload triggered');
        window.location.reload();
    });

    buttonContainer.appendChild(reloadButton);

    // Assembly
    container.appendChild(icon);
    container.appendChild(title);
    container.appendChild(message);
    container.appendChild(buttonContainer);
    wrapper.appendChild(container);

    return wrapper;
}

/**
 * Get user-friendly error title
 * @param {string} code - Error code
 * @returns {string}
 */
function getErrorTitle(code) {
    const titles = {
        'CAMERA_DENIED': 'Camera Access Denied',
        'CAMERA_NOT_FOUND': 'No Camera Detected',
        'STREAM_LOST': 'Camera Connection Lost',
        'MODEL_LOAD_FAILED': 'Model Load Failed',
        'WEBGPU_NOT_SUPPORTED': 'WebGPU Not Supported',
        'UNKNOWN_ERROR': 'Something Went Wrong'
    };

    return titles[code] || titles['UNKNOWN_ERROR'];
}
