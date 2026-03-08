/**
 * Helper function to create DOM elements.
 *
 * Supported options:
 *   - className, id         → set directly
 *   - text (alias)          → element.textContent
 *   - html (alias)          → element.innerHTML
 *   - textContent, innerHTML, value, checked, disabled,
 *     type, accept, placeholder, rows, maxLength,
 *     src, alt, href, target → set as DOM properties
 *   - style                 → Object.assign(element.style, ...)
 *   - children              → array of Node | string
 *   - attributes            → explicit setAttribute() map
 *   - Any other key         → setAttribute(key, value)
 */

// Properties that must be assigned directly on the DOM node (not via setAttribute)
const DOM_PROPERTIES = new Set([
    'textContent', 'innerHTML', 'value', 'checked', 'disabled',
    'type', 'accept', 'placeholder', 'rows', 'maxLength',
    'src', 'alt', 'href', 'target', 'readOnly', 'required',
    'autoComplete', 'tabIndex', 'draggable'
]);

// Keys handled explicitly by createElement — skip in the fallback loop
const HANDLED_KEYS = new Set([
    'className', 'id', 'text', 'html', 'style', 'children', 'attributes'
]);

export function createElement(tag, options = {}) {
    const element = document.createElement(tag);

    if (options.className) element.className = options.className;
    if (options.id) element.id = options.id;

    // Aliases: text → textContent, html → innerHTML
    if (options.text) element.textContent = options.text;
    if (options.html) element.innerHTML = options.html;

    // Explicit attributes map
    if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
            element.setAttribute(key, value);
        }
    }

    // Style object
    if (options.style) Object.assign(element.style, options.style);

    // Children array
    if (options.children) {
        for (const child of options.children) {
            if (child instanceof Node) {
                element.appendChild(child);
            } else if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            }
        }
    }

    // DOM properties + fallback to setAttribute for anything else
    for (const [key, value] of Object.entries(options)) {
        if (HANDLED_KEYS.has(key)) continue;
        if (DOM_PROPERTIES.has(key)) {
            element[key] = value;
        } else {
            element.setAttribute(key, value);
        }
    }

    return element;
}

/**
 * Remove element from DOM
 */
export function removeElement(element) {
    if (element && element.parentNode) {
        element.parentNode.removeChild(element);
    }
}

/**
 * Add class to element
 */
export function addClass(element, ...classNames) {
    element.classList.add(...classNames);
}

/**
 * Remove class from element
 */
export function removeClass(element, ...classNames) {
    element.classList.remove(...classNames);
}

/**
 * Toggle class on element
 */
export function toggleClass(element, className) {
    element.classList.toggle(className);
}

/**
 * Clear all children from an element
 */
export function clearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Set multiple attributes at once
 */
export function setAttributes(element, attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
}

/**
 * Debounce function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Abortable sleep function
 * Resolves after ms milliseconds, or rejects if signal is aborted
 */
export function sleep(ms, signal) {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }

        const timeout = setTimeout(resolve, ms);

        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timeout);
                reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
        }
    });
}
