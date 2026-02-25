/**
 * URL Display Component
 * Shows detected URLs with safe display and confirmation dialog
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassContainer } from './glass-container.js';
import { createGlassButton } from './glass-button.js';
import { createSafeClickableURL, sanitizeURL } from '../utils/url-sanitizer.js';
import logger from '../utils/logger.js';

/**
 * Create URL badge component
 * @param {Object} urlData - URL data from url-sanitizer
 * @returns {HTMLElement}
 */
function createURLBadge(urlData) {
    const badge = createElement('div', {
        className: 'inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors'
    });
    
    // Icon based on safety
    const icon = createElement('span', {
        className: 'text-lg',
        textContent: urlData.safe ? '🔗' : '⚠️'
    });
    
    // URL text (sanitized and truncated)
    const urlText = createElement('span', {
        className: 'text-sm font-mono',
        textContent: urlData.sanitized.length > 50 
            ? urlData.sanitized.substring(0, 47) + '...' 
            : urlData.sanitized
    });
    
    // Open button (only if safe)
    if (urlData.safe) {
        const openButton = createGlassButton({
            text: 'Open',
            className: 'px-3 py-1 text-xs'
        });
        
        openButton.addEventListener('click', () => {
            showURLConfirmationDialog(urlData);
        });
        
        badge.appendChild(icon);
        badge.appendChild(urlText);
        badge.appendChild(openButton);
    } else {
        // Blocked badge
        const blockedLabel = createElement('span', {
            className: 'text-xs text-red-300',
            textContent: 'Blocked'
        });
        
        badge.classList.add('opacity-60', 'cursor-not-allowed');
        badge.title = urlData.safetyReason || 'Unsafe URL';
        
        badge.appendChild(icon);
        badge.appendChild(urlText);
        badge.appendChild(blockedLabel);
    }
    
    return badge;
}

/**
 * Show confirmation dialog before opening URL
 * @param {Object} urlData - URL data
 */
function showURLConfirmationDialog(urlData) {
    logger.info('Showing URL confirmation dialog', { url: urlData.original });
    
    // Create overlay
    const overlay = createElement('div', {
        className: 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] animate-fade-in'
    });
    
    // Dialog container
    const dialog = createGlassContainer({
        className: 'max-w-md mx-4 p-6 animate-scale-in'
    });
    
    // Title
    const title = createElement('h3', {
        className: 'text-xl font-light mb-4 flex items-center gap-2',
        innerHTML: '🔗 Open External Link'
    });
    
    // Warning message
    const warning = createElement('p', {
        className: 'text-sm mb-4 opacity-80',
        textContent: 'You are about to open an external link. Make sure you trust this URL:'
    });
    
    // URL display (scrollable, monospace)
    const urlDisplay = createElement('div', {
        className: 'bg-black/30 rounded-lg p-4 mb-4 max-h-32 overflow-y-auto border border-white/10'
    });
    
    const urlTextElement = createElement('code', {
        className: 'text-sm break-all text-blue-300',
        textContent: urlData.normalized
    });
    
    urlDisplay.appendChild(urlTextElement);
    
    // Security notice
    const securityNotice = createElement('p', {
        className: 'text-xs opacity-60 mb-6',
        textContent: '⚠️ Never open links from untrusted sources. Links may lead to phishing sites or malware.'
    });
    
    // Buttons
    const buttonContainer = createElement('div', {
        className: 'flex gap-3 justify-end'
    });
    
    const cancelButton = createGlassButton({
        text: 'Cancel',
        className: 'px-6 py-2 opacity-60'
    });
    
    const openButton = createGlassButton({
        text: 'Open Link',
        className: 'px-6 py-2'
    });
    
    // Cancel action
    cancelButton.addEventListener('click', () => {
        logger.info('URL open cancelled by user', { url: urlData.original });
        overlay.classList.add('animate-fade-out');
        setTimeout(() => overlay.remove(), 200);
    });
    
    // Open action
    openButton.addEventListener('click', () => {
        const safeURL = createSafeClickableURL(urlData.original);
        
        if (safeURL) {
            logger.info('Opening URL in new tab', { url: safeURL });
            
            // Open in new tab with security measures
            const newWindow = window.open(safeURL, '_blank', 'noopener,noreferrer');
            
            if (newWindow) {
                // Prevent new window from accessing this window
                newWindow.opener = null;
            } else {
                logger.warn('Popup blocked - URL not opened', { url: safeURL });
                alert('Popup blocked. Please allow popups for this site to open links.');
            }
        } else {
            logger.error('URL validation failed during open', { url: urlData.original });
            alert('This URL cannot be opened due to security restrictions.');
        }
        
        overlay.classList.add('animate-fade-out');
        setTimeout(() => overlay.remove(), 200);
    });
    
    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            cancelButton.click();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            cancelButton.click();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // Assembly
    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(openButton);
    
    dialog.appendChild(title);
    dialog.appendChild(warning);
    dialog.appendChild(urlDisplay);
    dialog.appendChild(securityNotice);
    dialog.appendChild(buttonContainer);
    
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
}

/**
 * Create URL list component
 * Shows all detected URLs in a caption
 * @param {Array} urls - Array of URL data objects
 * @returns {HTMLElement}
 */
export function createURLList(urls) {
    if (!urls || urls.length === 0) {
        return null;
    }
    
    logger.info('Creating URL list component', { count: urls.length });
    
    const container = createElement('div', {
        className: 'mt-4 p-4 rounded-lg bg-white/5 border border-white/10'
    });
    
    // Header
    const header = createElement('div', {
        className: 'flex items-center gap-2 mb-3'
    });
    
    const icon = createElement('span', {
        textContent: '🔗'
    });
    
    const title = createElement('h4', {
        className: 'text-sm font-medium',
        textContent: `${urls.length} Link${urls.length !== 1 ? 's' : ''} Detected`
    });
    
    header.appendChild(icon);
    header.appendChild(title);
    
    // URL badges
    const badgeContainer = createElement('div', {
        className: 'flex flex-wrap gap-2'
    });
    
    urls.forEach(urlData => {
        const badge = createURLBadge(urlData);
        badgeContainer.appendChild(badge);
    });
    
    container.appendChild(header);
    container.appendChild(badgeContainer);
    
    return container;
}

/**
 * Check if text contains URLs and process it
 * @param {string} text - Text to check
 * @returns {{hasURLs: boolean, processedText: string, urlComponent: HTMLElement|null}}
 */
export async function processTextForURLs(text) {
    const { processTextWithURLs } = await import('../utils/url-sanitizer.js');
    const result = processTextWithURLs(text);
    
    return {
        hasURLs: result.urls.length > 0,
        processedText: result.text,
        urlComponent: result.urls.length > 0 ? createURLList(result.urls) : null,
        urls: result.urls
    };
}
