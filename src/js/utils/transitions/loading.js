// @ts-check

/**
 * Loading domain transitions
 * Handles welcome screen, model loading, and warmup phases
 * 
 * Actions and guards are bound to StateMachine context, so 'this' refers to the StateMachine instance
 */

/** @type {import('./index').StateTransition[]} */
export const loadingTransitions = [
    // Welcome flow - normal path with WebGPU
    {
        event: 'START',
        from: 'welcome',
        to: 'permission',
        guard: function() {
            return this.state.hasWebGPU;
        }
    },

    // Welcome flow - fallback path without WebGPU
    {
        event: 'START_FALLBACK',
        from: 'welcome',
        to: 'image-upload',
        guard: function() {
            return !this.state.hasWebGPU;
        }
    },

    // WebGPU initialization complete
    {
        event: 'WGPU_READY',
        from: 'loading',
        to: 'loading',
        action: function() {
            this.state.loadingPhase = 'loading-model';
        }
    },

    // Model loading complete
    {
        event: 'MODEL_LOADED',
        from: 'loading',
        to: 'loading',
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
        guard: function() {
            return this.state.isVideoReady;
        },
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
