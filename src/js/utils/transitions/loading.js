// @ts-check

import { VIEW_STATES, RUNTIME_STATES, LOADING_PHASES } from '../../types.js';

/**
 * Loading domain transitions
 * Handles welcome screen, model loading, and warmup phases
 *
 * Functions are bound to StateMachine context at initialization,
 * so 'this' refers to the StateMachine instance.
 * @see state-machine.js defineTransitions() for binding logic
 */

/**
 * @typedef {import('../state-machine.js').StateTransition} StateTransition
 */

/** @type {StateTransition[]} */
export const loadingTransitions = [
    // Welcome flow - normal path with WebGPU
    {
        event: 'START',
        from: VIEW_STATES.WELCOME,
        to: VIEW_STATES.PERMISSION,
        /** @this {import('../state-machine.js').default} */
        guard: function () {
            return this.state.hasWebGPU;
        },
    },

    // Welcome flow - fallback path without WebGPU
    {
        event: 'START_FALLBACK',
        from: VIEW_STATES.WELCOME,
        to: VIEW_STATES.IMAGE_UPLOAD,
        /** @this {import('../state-machine.js').default} */
        guard: function () {
            return !this.state.hasWebGPU;
        },
    },

    // WebGPU initialization complete
    {
        event: 'WGPU_READY',
        from: VIEW_STATES.LOADING,
        to: VIEW_STATES.LOADING,
        /** @this {import('../state-machine.js').default} */
        action: function () {
            this.state.loadingPhase = LOADING_PHASES.LOADING_MODEL;
        },
    },

    // Model loading complete
    {
        event: 'MODEL_LOADED',
        from: VIEW_STATES.LOADING,
        to: VIEW_STATES.LOADING,
        /** @this {import('../state-machine.js').default} */
        action: function () {
            this.state.loadingPhase = LOADING_PHASES.WARMING_UP;
            this.state.runtimeState = RUNTIME_STATES.WARMING;
        },
    },

    // Warmup complete - transition to runtime view
    {
        event: 'WARMUP_COMPLETE',
        from: VIEW_STATES.LOADING,
        to: VIEW_STATES.RUNTIME,
        /** @this {import('../state-machine.js').default} */
        guard: function () {
            return this.state.isVideoReady;
        },
        /** @this {import('../state-machine.js').default} */
        action: function () {
            this.state.loadingPhase = LOADING_PHASES.COMPLETE;
            this.state.runtimeState = RUNTIME_STATES.RUNNING;
        },
    },

    // Late warmup complete - already in runtime (video readiness triggered transition first)
    {
        event: 'WARMUP_COMPLETE',
        from: VIEW_STATES.RUNTIME,
        to: VIEW_STATES.RUNTIME,
        // No action needed — already running
    },

    // Model loading failed
    {
        event: 'MODEL_FAILED',
        from: VIEW_STATES.LOADING,
        to: VIEW_STATES.ERROR,
        /** @this {import('../state-machine.js').default} */
        action: function (data) {
            this.state.runtimeState = RUNTIME_STATES.FAILED;
            this.state.error = {
                code: 'MODEL_LOAD_FAILED',
                message: 'Failed to load AI model',
                technical: data.error,
                recoverAction: {
                    label: 'Reload Page',
                    handler: () => window.location.reload(),
                },
            };
        },
    },
];
