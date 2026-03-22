/**
 * Normalize model captions for readability.
 * This runs on every model response before rendering.
 *
 * @param {string | null | undefined} text
 * @returns {string | null | undefined}
 */
export function postProcessCaption(text) {
    if (!text) return text;

    let cleaned = text.replace(/\s+/g, ' ').trim();
    const ELLIPSIS_TOKEN = '__VLM_ELLIPSIS__';

    // Collapse immediate repeated 3-word phrases often produced by VLMs.
    cleaned = cleaned.replace(/\b(\w+\s+\w+\s+\w+)(\s+\1)+/gi, '$1');

    // Remove common filler and normalize punctuation noise.
    cleaned = cleaned.replace(/\buh+\b/gi, '');
    cleaned = cleaned.replace(/\.{3,}/g, '...');
    cleaned = cleaned.replace(/\.\.\./g, ELLIPSIS_TOKEN);
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');

    // Fix spacing around punctuation marks.
    cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
    cleaned = cleaned.replace(/([.,!?])(\w)/g, '$1 $2');
    cleaned = cleaned.replace(new RegExp(ELLIPSIS_TOKEN, 'g'), '...');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();

    return cleaned.trim();
}
