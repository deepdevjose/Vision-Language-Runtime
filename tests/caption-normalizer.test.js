/**
 * Unit Tests for caption normalization utility.
 *
 * Run with: node tests/caption-normalizer.test.js
 */

import { postProcessCaption } from '../src/js/utils/caption-normalizer.js';

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message}\nExpected: "${expected}"\nActual: "${actual}"`);
    }
}

test('Caption - normalizes multiple spaces', () => {
    const input = 'The  image   shows    something';
    const expected = 'The image shows something';
    assertEqual(postProcessCaption(input), expected, 'Should normalize spaces');
});

test('Caption - removes repetitions', () => {
    const input = 'The image shows the image shows something';
    const expected = 'The image shows something';
    assertEqual(postProcessCaption(input), expected, 'Should remove repetitions');
});

test('Caption - removes filler words', () => {
    const input = 'The image uh shows something';
    const expected = 'The image shows something';
    assertEqual(postProcessCaption(input), expected, 'Should remove fillers');
});

test('Caption - normalizes ellipsis', () => {
    const input = 'The image shows........something';
    const expected = 'The image shows...something';
    assertEqual(postProcessCaption(input), expected, 'Should normalize ellipsis');
});

test('Caption - normalizes exclamation marks', () => {
    const input = 'Amazing!!! Great!!!';
    const expected = 'Amazing! Great!';
    assertEqual(postProcessCaption(input), expected, 'Should normalize exclamation');
});

test('Caption - fixes spacing around punctuation', () => {
    const input = 'Hello , world .How are you ?';
    const expected = 'Hello, world. How are you?';
    assertEqual(postProcessCaption(input), expected, 'Should fix spacing');
});

test('Caption - trims leading/trailing spaces', () => {
    const input = '  The image shows something  ';
    const expected = 'The image shows something';
    assertEqual(postProcessCaption(input), expected, 'Should trim spaces');
});

test('Caption - handles empty string', () => {
    assertEqual(postProcessCaption(''), '', 'Should handle empty string');
});

test('Caption - handles null/undefined', () => {
    assertEqual(postProcessCaption(null), null, 'Should handle null');
    assertEqual(postProcessCaption(undefined), undefined, 'Should handle undefined');
});

test('Caption - complex case', () => {
    const input = 'The image shows the image shows  a person  holding uh something... Great !!!  ';
    const expected = 'The image shows a person holding something... Great!';
    assertEqual(postProcessCaption(input), expected, 'Should handle complex case');
});

async function runTests() {
    console.log('\nRunning Caption Normalizer Tests...\n');

    for (const { name, fn } of tests) {
        try {
            fn();
            console.log(`PASS ${name}`);
            passed++;
        } catch (error) {
            console.error(`FAIL ${name}`);
            console.error(`   ${error.message}`);
            failed++;
        }
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
    return { passed, failed, total: tests.length };
}

if (typeof process !== 'undefined') {
    runTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runTests };
