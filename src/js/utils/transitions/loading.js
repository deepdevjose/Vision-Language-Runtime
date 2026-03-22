// @ts-check

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
        from: 'welcome',
        to: 'permission',
        /** @this {import('../state-machine.js').default} */
        guard: function() {
            return this.state.hasWebGPU;
        }
    },

    // Welcome flow - fallback path without WebGPU
    {
        event: 'START_FALLBACK',
        from: 'welcome',
        to: 'image-upload',
        /** @this {import('../state-machine.js').default} */
        guard: function() {
            return !this.state.hasWebGPU;
        }
    },

    // WebGPU initialization complete
    {
        event: 'WGPU_READY',
        from: 'loading',
        to: 'loading',
        /** @this {import('../state-machine.js').default} */
        action: function() {
            this.state.loadingPhase = 'loading-model';
        }
    },

    // Model loading complete
    {
        event: 'MODEL_LOADED',
        from: 'loading',
        to: 'loading',
        /** @this {import('../state-machine.js').default} */
        action: function() {
            this.state.loadingPhase = 'warming-up';
            this.state.runtimeState = 'warming';
        }
    },

    // Warmup complete - transition to runtime view
    {
        event: 'WARMUP_COMPLETE',
        from: 'loading',
        to: 'runtime',
        /** @this {import('../state-machine.js').default} */
        guard: function() {
            return this.state.isVideoReady;
        },
        /** @this {import('../state-machine.js').default} */
        action: function() {
            this.state.loadingPhase = 'complete';
            this.state.runtimeState = 'running';
        }
    },

    // Late warmup complete - already in runtime (video readiness triggered transition first)
    {
        event: 'WARMUP_COMPLETE',
        from: 'runtime',
        to: 'runtime'
        // No action needed — already running
    },

    // Model loading failed
    {
        event: 'MODEL_FAILED',
        from: 'loading',
        to: 'error',
        /** @this {import('../state-machine.js').default} */
        action: function(data) {
            this.state.runtimeState = 'failed';
            this.state.error = {
                code: 'MODEL_LOAD_FAILED',
                message: 'Failed to load AI model',
                technical: data.error,
                recoverAction: {
                    label: 'Reload Page',
                    handler: () => window.location.reload()
                }
            };
        }
    }
];
