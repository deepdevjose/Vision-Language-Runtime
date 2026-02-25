/**
 * Unit Tests for StateManager
 * Run with: npm test or in browser console
 */

import StateManager from '../src/js/utils/state-manager.js';

// Simple test framework
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
    }
}

function assertTrue(value, message) {
    if (!value) {
        throw new Error(message || 'Expected true');
    }
}

function assertFalse(value, message) {
    if (value) {
        throw new Error(message || 'Expected false');
    }
}

// Tests
test('StateManager - initial state', () => {
    const sm = new StateManager({ count: 0 });
    assertEqual(sm.getState(), { count: 0 }, 'Initial state should match');
});

test('StateManager - setState updates state', () => {
    const sm = new StateManager({ count: 0 });
    sm.setState({ count: 1 });
    assertEqual(sm.getState(), { count: 1 }, 'State should be updated');
});

test('StateManager - setState merges state', () => {
    const sm = new StateManager({ count: 0, name: 'test' });
    sm.setState({ count: 1 });
    assertEqual(sm.getState(), { count: 1, name: 'test' }, 'State should be merged');
});

test('StateManager - no change does not emit event', () => {
    const sm = new StateManager({ count: 0 });
    let eventFired = false;
    sm.subscribe(() => { eventFired = true; });
    sm.setState({ count: 0 }); // Same value
    assertFalse(eventFired, 'Event should not fire for no change');
});

test('StateManager - subscription receives updates', (done) => {
    const sm = new StateManager({ count: 0 });
    sm.subscribe((detail) => {
        assertEqual(detail.state.count, 1, 'Should receive new state');
        assertEqual(detail.prevState.count, 0, 'Should receive prev state');
        done();
    });
    sm.setState({ count: 1 });
});

test('StateManager - unsubscribe works', () => {
    const sm = new StateManager({ count: 0 });
    let callCount = 0;
    const unsubscribe = sm.subscribe(() => { callCount++; });
    
    sm.setState({ count: 1 });
    assertEqual(callCount, 1, 'Should be called once');
    
    unsubscribe();
    sm.setState({ count: 2 });
    assertEqual(callCount, 1, 'Should not be called after unsubscribe');
});

test('StateManager - getState returns copy', () => {
    const sm = new StateManager({ obj: { nested: 1 } });
    const state1 = sm.getState();
    const state2 = sm.getState();
    
    assertFalse(state1 === state2, 'Should return different objects');
    assertEqual(state1, state2, 'Should have same values');
});

// Run tests
async function runTests() {
    console.log('\n🧪 Running StateManager Tests...\n');
    
    for (const { name, fn } of tests) {
        try {
            // Handle async tests
            if (fn.length > 0) {
                await new Promise((resolve, reject) => {
                    const done = () => resolve();
                    try {
                        fn(done);
                    } catch (error) {
                        reject(error);
                    }
                });
            } else {
                fn();
            }
            
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

// Auto-run if in Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    runTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runTests };
