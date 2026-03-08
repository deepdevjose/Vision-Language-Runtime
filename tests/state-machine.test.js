/**
 * Unit Tests for StateMachine
 * Validates transition guards, state sync, and recovery flows
 * added after meta-audit fix #1 (state machine unification).
 *
 * Run with: node tests/state-machine.test.js
 */

import StateMachine from '../src/js/utils/state-machine.js';

// ── Minimal test harness (matches existing convention) ──────────
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
    tests.push({ name, fn });
}

function assertEqual(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual:   ${JSON.stringify(actual)}`);
    }
}

function assertTrue(value, message) {
    if (!value) throw new Error(message || 'Expected true');
}

function assertFalse(value, message) {
    if (value) throw new Error(message || 'Expected false');
}

// ── Helper: create SM with sensible defaults ────────────────────
function createSM(overrides = {}) {
    return new StateMachine({
        viewState: 'welcome',
        runtimeState: 'idle',
        loadingPhase: 'loading-wgpu',
        webcamStream: null,
        isVideoReady: false,
        hasWebGPU: false,
        error: null,
        ...overrides
    });
}

// ================================================================
// Tests
// ================================================================

// ── Initial state ───────────────────────────────────────────────

test('hasWebGPU defaults to false', () => {
    const sm = createSM();
    assertFalse(sm.getState().hasWebGPU, 'hasWebGPU should default to false');
});

test('getState returns a copy', () => {
    const sm = createSM();
    const a = sm.getState();
    const b = sm.getState();
    assertFalse(a === b, 'Should return different objects');
    assertEqual(a, b, 'Copies should be equal by value');
});

// ── setState propagates hasWebGPU ───────────────────────────────

test('setState updates hasWebGPU and emits statechange', (done) => {
    const sm = createSM();
    sm.addEventListener('statechange', (event) => {
        assertTrue(event.detail.state.hasWebGPU, 'State should reflect true after setState');
        assertFalse(event.detail.prevState.hasWebGPU, 'PrevState should be false');
        done();
    });
    sm.setState({ hasWebGPU: true });
});

// ── START guard ─────────────────────────────────────────────────

test('START succeeds when hasWebGPU=true', () => {
    const sm = createSM({ hasWebGPU: true });
    const ok = sm.dispatch('START');
    assertTrue(ok, 'START should succeed');
    assertEqual(sm.getState().viewState, 'permission', 'Should transition to permission');
});

test('START fails when hasWebGPU=false', () => {
    const sm = createSM({ hasWebGPU: false });
    const ok = sm.dispatch('START');
    assertFalse(ok, 'START should fail guard');
    assertEqual(sm.getState().viewState, 'welcome', 'Should stay on welcome');
});

// ── START_FALLBACK guard ────────────────────────────────────────

test('START_FALLBACK succeeds when hasWebGPU=false', () => {
    const sm = createSM({ hasWebGPU: false });
    const ok = sm.dispatch('START_FALLBACK');
    assertTrue(ok, 'START_FALLBACK should succeed');
    assertEqual(sm.getState().viewState, 'image-upload', 'Should transition to image-upload');
});

test('START_FALLBACK fails when hasWebGPU=true', () => {
    const sm = createSM({ hasWebGPU: true });
    const ok = sm.dispatch('START_FALLBACK');
    assertFalse(ok, 'START_FALLBACK should fail guard');
    assertEqual(sm.getState().viewState, 'welcome', 'Should stay on welcome');
});

// ── PERMISSION flow ─────────────────────────────────────────────

test('PERMISSION_GRANTED transitions loading and stores stream', () => {
    const fakeStream = { getTracks: () => [] };
    const sm = createSM({ viewState: 'permission', hasWebGPU: true });
    const ok = sm.dispatch('PERMISSION_GRANTED', { stream: fakeStream });
    assertTrue(ok, 'PERMISSION_GRANTED should succeed');
    assertEqual(sm.getState().viewState, 'loading', 'Should transition to loading');
    assertEqual(sm.getState().webcamStream, fakeStream, 'Stream should be stored');
});

test('PERMISSION_GRANTED fails without stream', () => {
    const sm = createSM({ viewState: 'permission', hasWebGPU: true });
    const ok = sm.dispatch('PERMISSION_GRANTED', {});
    assertFalse(ok, 'Should fail guard when no stream provided');
});

test('PERMISSION_DENIED transitions to error with recoverAction', () => {
    const sm = createSM({ viewState: 'permission' });
    const ok = sm.dispatch('PERMISSION_DENIED', {
        message: 'Camera access denied',
        technical: 'NotAllowedError'
    });
    assertTrue(ok, 'PERMISSION_DENIED should succeed');
    assertEqual(sm.getState().viewState, 'error', 'Should transition to error');
    assertEqual(sm.getState().error.code, 'CAMERA_DENIED', 'Error code should be CAMERA_DENIED');
    assertTrue(typeof sm.getState().error.recoverAction.handler === 'function', 'Should have recover handler');
});

// ── RETRY from error ────────────────────────────────────────────

test('RETRY from error transitions back to permission', () => {
    const sm = createSM({ viewState: 'error', runtimeState: 'failed', error: { code: 'TEST' } });
    const ok = sm.dispatch('RETRY');
    assertTrue(ok, 'RETRY should succeed');
    assertEqual(sm.getState().viewState, 'permission', 'Should return to permission');
    assertEqual(sm.getState().error, null, 'Error should be cleared');
    assertEqual(sm.getState().runtimeState, 'idle', 'runtimeState should reset to idle');
});

// ── STREAM_ENDED + RETRY_STREAM ─────────────────────────────────

test('STREAM_ENDED sets runtime to recovering with reconnect action', () => {
    const sm = createSM({ viewState: 'runtime', runtimeState: 'running' });
    const ok = sm.dispatch('STREAM_ENDED', { reason: 'Camera unplugged' });
    assertTrue(ok, 'STREAM_ENDED should succeed');
    assertEqual(sm.getState().viewState, 'runtime', 'Should stay on runtime');
    assertEqual(sm.getState().runtimeState, 'recovering', 'runtimeState should be recovering');
    assertEqual(sm.getState().error.code, 'STREAM_LOST', 'Error code should be STREAM_LOST');
    assertEqual(sm.getState().error.recoverAction.label, 'Reconnect', 'Recover button should say Reconnect');
});

test('RETRY_STREAM from recovering transitions to permission', () => {
    const stopped = [];
    const fakeStream = {
        getTracks: () => [{ stop: () => stopped.push('stopped') }]
    };
    const sm = createSM({
        viewState: 'runtime',
        runtimeState: 'recovering',
        webcamStream: fakeStream,
        isVideoReady: true,
        error: { code: 'STREAM_LOST' }
    });
    const ok = sm.dispatch('RETRY_STREAM');
    assertTrue(ok, 'RETRY_STREAM should succeed');
    assertEqual(sm.getState().viewState, 'permission', 'Should transition to permission');
    assertEqual(sm.getState().runtimeState, 'idle', 'runtimeState should reset');
    assertEqual(sm.getState().error, null, 'Error should be cleared');
    assertEqual(sm.getState().webcamStream, null, 'Stream should be nulled');
    assertFalse(sm.getState().isVideoReady, 'isVideoReady should be false');
    assertEqual(stopped.length, 1, 'Old stream track should be stopped');
});

test('RETRY_STREAM fails when not in recovering state', () => {
    const sm = createSM({ viewState: 'runtime', runtimeState: 'running' });
    const ok = sm.dispatch('RETRY_STREAM');
    assertFalse(ok, 'RETRY_STREAM should fail guard when not recovering');
    assertEqual(sm.getState().viewState, 'runtime', 'Should stay on runtime');
});

// ── STREAM_RECOVERED ────────────────────────────────────────────

test('STREAM_RECOVERED restores running state with new stream', () => {
    const newStream = { getTracks: () => [] };
    const sm = createSM({
        viewState: 'runtime',
        runtimeState: 'recovering',
        error: { code: 'STREAM_LOST' }
    });
    const ok = sm.dispatch('STREAM_RECOVERED', { stream: newStream });
    assertTrue(ok, 'STREAM_RECOVERED should succeed');
    assertEqual(sm.getState().runtimeState, 'running', 'Should be running again');
    assertEqual(sm.getState().webcamStream, newStream, 'New stream should be stored');
    assertEqual(sm.getState().error, null, 'Error should be cleared');
});

// ── No phantom 'transition' event ───────────────────────────────

test('StateMachine never emits "transition" event', () => {
    const sm = createSM({ hasWebGPU: true });
    let transitionFired = false;
    sm.addEventListener('transition', () => { transitionFired = true; });
    sm.dispatch('START');
    assertFalse(transitionFired, '"transition" event should never be emitted');
});

test('StateMachine emits "statechange" on dispatch', (done) => {
    const sm = createSM({ hasWebGPU: true });
    sm.addEventListener('statechange', (e) => {
        assertEqual(e.detail.event, 'START', 'Event name should be START');
        done();
    });
    sm.dispatch('START');
});

// ── FATAL_ERROR from any state ──────────────────────────────────

test('FATAL_ERROR transitions to error from any state', () => {
    const sm = createSM({ viewState: 'loading' });
    const ok = sm.dispatch('FATAL_ERROR', {
        code: 'UNKNOWN',
        message: 'Something broke'
    });
    assertTrue(ok, 'FATAL_ERROR should succeed');
    assertEqual(sm.getState().viewState, 'error', 'Should be on error screen');
    assertEqual(sm.getState().error.code, 'UNKNOWN', 'Error code should match');
});

// ── getAvailableEvents ──────────────────────────────────────────

test('getAvailableEvents returns correct events for welcome', () => {
    const sm = createSM({ viewState: 'welcome' });
    const events = sm.getAvailableEvents();
    assertTrue(events.includes('START'), 'Should include START');
    assertTrue(events.includes('START_FALLBACK'), 'Should include START_FALLBACK');
    assertTrue(events.includes('FATAL_ERROR'), 'Should include FATAL_ERROR (wildcard)');
});

// ── WARMUP_COMPLETE / loading flow ──────────────────────────────

test('WARMUP_COMPLETE from loading transitions to runtime when video ready', () => {
    const sm = createSM({
        viewState: 'loading',
        runtimeState: 'warming',
        loadingPhase: 'warming-up',
        isVideoReady: true
    });
    const ok = sm.dispatch('WARMUP_COMPLETE');
    assertTrue(ok, 'WARMUP_COMPLETE should succeed');
    assertEqual(sm.getState().viewState, 'runtime', 'Should transition to runtime');
    assertEqual(sm.getState().runtimeState, 'running', 'runtimeState should be running');
    assertEqual(sm.getState().loadingPhase, 'complete', 'loadingPhase should be complete');
});

test('WARMUP_COMPLETE from loading fails guard when video not ready', () => {
    const sm = createSM({
        viewState: 'loading',
        runtimeState: 'warming',
        isVideoReady: false
    });
    const ok = sm.dispatch('WARMUP_COMPLETE');
    assertFalse(ok, 'WARMUP_COMPLETE should fail guard');
    assertEqual(sm.getState().viewState, 'loading', 'Should stay on loading');
});

test('Late WARMUP_COMPLETE from runtime is absorbed (no-op)', () => {
    const sm = createSM({
        viewState: 'runtime',
        runtimeState: 'running'
    });
    const ok = sm.dispatch('WARMUP_COMPLETE');
    assertTrue(ok, 'Late WARMUP_COMPLETE should be accepted');
    assertEqual(sm.getState().viewState, 'runtime', 'Should stay on runtime');
    assertEqual(sm.getState().runtimeState, 'running', 'runtimeState should remain running');
});

test('Full loading sequence: WGPU_READY → MODEL_LOADED → WARMUP_COMPLETE', () => {
    const fakeStream = { getTracks: () => [] };
    const sm = createSM({ viewState: 'permission', hasWebGPU: true });

    // permission → loading
    sm.dispatch('PERMISSION_GRANTED', { stream: fakeStream });
    assertEqual(sm.getState().viewState, 'loading', 'Step 1: loading');

    // WGPU_READY
    sm.dispatch('WGPU_READY');
    assertEqual(sm.getState().loadingPhase, 'loading-model', 'Step 2: loading-model phase');

    // MODEL_LOADED
    sm.dispatch('MODEL_LOADED');
    assertEqual(sm.getState().loadingPhase, 'warming-up', 'Step 3: warming-up phase');
    assertEqual(sm.getState().runtimeState, 'warming', 'Step 3: runtimeState warming');

    // Simulate video becoming ready
    sm.setState({ isVideoReady: true });

    // WARMUP_COMPLETE
    sm.dispatch('WARMUP_COMPLETE');
    assertEqual(sm.getState().viewState, 'runtime', 'Step 4: runtime');
    assertEqual(sm.getState().runtimeState, 'running', 'Step 4: running');
    assertEqual(sm.getState().loadingPhase, 'complete', 'Step 4: complete');
});

// ================================================================
// Runner
// ================================================================

async function runTests() {
    console.log('\n🧪 Running StateMachine Tests...\n');

    for (const { name, fn } of tests) {
        try {
            if (fn.length > 0) {
                await new Promise((resolve, reject) => {
                    try { fn(resolve); } catch (e) { reject(e); }
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

// Auto-run in Node.js
if (typeof process !== 'undefined') {
    runTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runTests };
