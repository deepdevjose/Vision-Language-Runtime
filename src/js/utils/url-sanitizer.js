/**
 * URL Detection and Sanitization Utility
 * Detects, sanitizes, and safely handles URLs in caption text
 */

import logger from './logger.js';

/**
 * URL regex patterns
 */
const URL_PATTERNS = {
    // Standard URLs with protocol
    withProtocol: /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    
    // URLs without protocol (e.g., www.example.com, example.com)
    withoutProtocol: /(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi,
    
    // Email-like patterns (to exclude)
    email: /\S+@\S+\.\S+/gi
};

/**
 * Detect URLs in text
 * @param {string} text - Text to scan for URLs
 * @returns {Array<{url: string, start: number, end: number}>}
 */
export function detectURLs(text) {
    if (!text || typeof text !== 'string') return [];
    
    const urls = [];
    const seen = new Set();
    
    // Find URLs with protocol (http://, https://)
    let match;
    const withProtocolRegex = new RegExp(URL_PATTERNS.withProtocol);
    while ((match = withProtocolRegex.exec(text)) !== null) {
        const url = match[0];
        if (!seen.has(url)) {
            urls.push({
                url: url,
                start: match.index,
                end: match.index + url.length,
                hasProtocol: true
            });
            seen.add(url);
        }
    }
    
    // Find potential URLs without protocol
    // But exclude email addresses
    const withoutProtocolRegex = new RegExp(URL_PATTERNS.withoutProtocol);
    while ((match = withoutProtocolRegex.exec(text)) !== null) {
        const url = match[0];
        
        // Skip if it's an email
        if (URL_PATTERNS.email.test(url)) continue;
        
        // Skip if already detected with protocol
        if (seen.has(url) || seen.has('http://' + url) || seen.has('https://' + url)) continue;
        
        // Must have domain extension (.com, .org, etc)
        if (!/\.[a-zA-Z]{2,}/.test(url)) continue;
        
        urls.push({
            url: url,
            start: match.index,
            end: match.index + url.length,
            hasProtocol: false
        });
        seen.add(url);
    }
    
    // Sort by position in text
    urls.sort((a, b) => a.start - b.start);
    
    logger.debug('URLs detected in text', { count: urls.length, urls: urls.map(u => u.url) });
    
    return urls;
}

/**
 * Sanitize URL for safe display
 * Escapes HTML entities and removes dangerous protocols
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL
 */
export function sanitizeURL(url) {
    if (!url || typeof url !== 'string') return '';
    
    // Remove whitespace
    let sanitized = url.trim();
    
    // Escape HTML entities
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
    
    return sanitized;
}

/**
 * Validate URL safety
 * Checks for dangerous protocols and patterns
 * @param {string} url - URL to validate
 * @returns {{safe: boolean, reason?: string}}
 */
export function validateURLSafety(url) {
    if (!url || typeof url !== 'string') {
        return { safe: false, reason: 'Invalid URL' };
    }
    
    const lower = url.toLowerCase().trim();
    
    // Dangerous protocols
    const dangerousProtocols = [
        'javascript:',
        'data:',
        'vbscript:',
        'file:',
        'about:',
        'chrome:',
        'chrome-extension:',
        'view-source:'
    ];
    
    for (const protocol of dangerousProtocols) {
        if (lower.startsWith(protocol)) {
            logger.warn('Dangerous URL protocol detected', { url, protocol });
            return { safe: false, reason: `Blocked protocol: ${protocol}` };
        }
    }
    
    // Check for suspicious patterns
    if (lower.includes('<script') || lower.includes('onerror=') || lower.includes('onclick=')) {
        logger.warn('Suspicious URL pattern detected', { url });
        return { safe: false, reason: 'Suspicious pattern detected' };
    }
    
    // Very long URLs (potential attack)
    if (url.length > 2000) {
        logger.warn('Excessively long URL detected', { url: url.substring(0, 100) + '...', length: url.length });
        return { safe: false, reason: 'URL too long (max 2000 chars)' };
    }
    
    return { safe: true };
}

/**
 * Normalize URL (add protocol if missing)
 * @param {string} url - URL to normalize
 * @returns {string} Normalized URL
 */
export function normalizeURL(url) {
    if (!url || typeof url !== 'string') return '';
    
    const trimmed = url.trim();
    
    // Already has protocol
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    
    // Add https:// by default
    return 'https://' + trimmed;
}

/**
 * Process text to replace URLs with safe placeholders
 * @param {string} text - Text containing URLs
 * @returns {{text: string, urls: Array<{original: string, sanitized: string, safe: boolean, position: number}>}}
 */
export function processTextWithURLs(text) {
    if (!text || typeof text !== 'string') {
        return { text: '', urls: [] };
    }
    
    const detectedURLs = detectURLs(text);
    
    if (detectedURLs.length === 0) {
        return { text, urls: [] };
    }
    
    let processedText = text;
    const urlData = [];
    let offset = 0; // Track text length changes
    
    // Replace URLs with placeholders (from end to start to preserve indices)
    [...detectedURLs].reverse().forEach((urlInfo, reverseIndex) => {
        const index = detectedURLs.length - 1 - reverseIndex;
        const { url, start, end } = urlInfo;
        
        // Validate safety
        const safety = validateURLSafety(url);
        const sanitized = sanitizeURL(url);
        const normalized = normalizeURL(url);
        
        // Create placeholder
        const placeholder = `[URL_${index}]`;
        
        // Replace in text
        processedText = processedText.substring(0, start) + placeholder + processedText.substring(end);
        
        urlData.unshift({
            index: index,
            original: url,
            sanitized: sanitized,
            normalized: normalized,
            safe: safety.safe,
            safetyReason: safety.reason,
            position: start,
            placeholder: placeholder
        });
    });
    
    logger.info('Processed text with URLs', { 
        originalLength: text.length, 
        processedLength: processedText.length, 
        urlCount: urlData.length 
    });
    
    return {
        text: processedText,
        urls: urlData
    };
}

/**
 * Create a safe clickable URL
 * Returns null if URL is not safe
 * @param {string} url - URL to make clickable
 * @returns {string|null} Safe URL or null
 */
export function createSafeClickableURL(url) {
    const safety = validateURLSafety(url);
    
    if (!safety.safe) {
        logger.warn('Blocked unsafe URL from being clickable', { url, reason: safety.reason });
        return null;
    }
    
    const normalized = normalizeURL(url);
    
    // Final validation
    try {
        const urlObj = new URL(normalized);
        
        // Only allow http/https
        if (!['http:', 'https:'].includes(urlObj.protocol)) {
            logger.warn('Non-HTTP protocol blocked', { url, protocol: urlObj.protocol });
            return null;
        }
        
        return normalized;
    } catch (error) {
        logger.error('Invalid URL format', { url, error: error.message });
        return null;
    }
}
