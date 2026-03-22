/**
 * Unit Tests for createElement (dom-helpers.js)
 * Validates the whitelist-based property contract after meta-audit fix #3.
 *
 * Run with: node tests/dom-helpers.test.js
 */

// Minimal DOM shim for Node.js
class MockElement {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.className = '';
        this.id = '';
        this.textContent = '';
        this.innerHTML = '';
        this.style = {};
        this._children = [];
        this._attributes = {};
    }
    setAttribute(k, v) {
        this._attributes[k] = v;
    }
    getAttribute(k) {
        return this._attributes[k];
    }
    appendChild(child) {
        this._children.push(child);
        return child;
    }
}

class MockTextNode {
    constructor(text) {
        this.textContent = text;
        this.nodeType = 3;
    }
}

// Patch globals so createElement import works
globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    createTextNode: (text) => new MockTextNode(text),
};
globalThis.Node = MockElement;

// Now import
const { createElement } = await import('../src/js/utils/dom-helpers.js');

// ── Test harness ────────────────────────────────────────────────
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, msg) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
            `${msg}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`
        );
    }
}
function assertTrue(v, msg) {
    if (!v) throw new Error(msg || 'Expected true');
}

// ================================================================
// Tests
// ================================================================

test('className and id are set', () => {
    const el = createElement('div', { className: 'foo', id: 'bar' });
    assertEqual(el.className, 'foo', 'className');
    assertEqual(el.id, 'bar', 'id');
});

test('text alias sets textContent', () => {
    const el = createElement('p', { text: 'hello' });
    assertEqual(el.textContent, 'hello', 'text should map to textContent');
});

test('html alias sets innerHTML', () => {
    const el = createElement('div', { html: '<b>bold</b>' });
    assertEqual(el.innerHTML, '<b>bold</b>', 'html should map to innerHTML');
});

test('textContent property is set directly', () => {
    const el = createElement('h3', { textContent: 'Title' });
    assertEqual(el.textContent, 'Title', 'textContent prop should be set');
});

test('type and accept properties are set (image-upload fix)', () => {
    const el = createElement('input', { type: 'file', accept: 'image/*' });
    assertEqual(el.type, 'file', 'type should be set as DOM property');
    assertEqual(el.accept, 'image/*', 'accept should be set as DOM property');
});

test('placeholder is set as DOM property', () => {
    const el = createElement('input', { placeholder: 'Search...' });
    assertEqual(el.placeholder, 'Search...', 'placeholder should be DOM prop');
});

test('value is set as DOM property', () => {
    const el = createElement('input', { value: 'initial' });
    assertEqual(el.value, 'initial', 'value should be DOM prop');
});

test('checked and disabled are set as DOM properties', () => {
    const el = createElement('input', { checked: true, disabled: true });
    assertTrue(el.checked, 'checked');
    assertTrue(el.disabled, 'disabled');
});

test('attributes map uses setAttribute', () => {
    const el = createElement('div', {
        attributes: { 'data-id': '42', 'aria-label': 'test' },
    });
    assertEqual(el.getAttribute('data-id'), '42', 'data-id');
    assertEqual(el.getAttribute('aria-label'), 'test', 'aria-label');
});

test('style is merged via Object.assign', () => {
    const el = createElement('div', { style: { color: 'red', opacity: '0.5' } });
    assertEqual(el.style.color, 'red', 'color');
    assertEqual(el.style.opacity, '0.5', 'opacity');
});

test('children array appends nodes and strings', () => {
    const child = createElement('span', { text: 'inner' });
    const el = createElement('div', {
        children: [child, 'text-node'],
    });
    assertEqual(el._children.length, 2, 'should have 2 children');
    assertEqual(el._children[0].tagName, 'SPAN', 'first child is span');
    assertEqual(el._children[1].textContent, 'text-node', 'second child text');
});

test('unknown keys fall through to setAttribute', () => {
    const el = createElement('div', { 'data-custom': 'value', role: 'button' });
    assertEqual(el.getAttribute('data-custom'), 'value', 'data-custom via setAttribute');
    assertEqual(el.getAttribute('role'), 'button', 'role via setAttribute');
});

test('combined options work together (real-world image-upload)', () => {
    const el = createElement('input', {
        type: 'file',
        accept: 'image/*',
        className: 'hidden',
        id: 'file-input',
    });
    assertEqual(el.tagName, 'INPUT', 'tag');
    assertEqual(el.type, 'file', 'type');
    assertEqual(el.accept, 'image/*', 'accept');
    assertEqual(el.className, 'hidden', 'className');
    assertEqual(el.id, 'file-input', 'id');
});

test('text and textContent: textContent wins (last-write)', () => {
    // text is applied first, then textContent overwrites via DOM_PROPERTIES loop
    const el = createElement('p', { text: 'alias', textContent: 'direct' });
    assertEqual(el.textContent, 'direct', 'textContent should overwrite text alias');
});

// ================================================================
// Runner
// ================================================================

async function runTests() {
    console.log('\n🧪 Running createElement Tests...\n');

    for (const { name, fn } of tests) {
        try {
            fn();
            console.log(`✅ ${name}`);
            passed++;
        } catch (error) {
            console.error(`❌ ${name}`);
            console.error(`   ${error.message}`);
            failed++;
        }
    }

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
    return { passed, failed, total: tests.length };
}

if (typeof process !== 'undefined') {
    runTests().then((results) => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runTests };
