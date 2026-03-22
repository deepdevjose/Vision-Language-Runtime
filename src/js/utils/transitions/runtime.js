// @ts-check

/**
 * Runtime domain transitions
 * Handles live inference execution, pause/resume, and stream recovery
 * 
 * Functions are bound to StateMachine context at initialization,
 * so 'this' refers to the StateMachine instance.
 * @see state-machine.js defineTransitions() for binding logic
 */

/**
 * @typedef {import('../state-machine.js').StateTransition} StateTransition
 */

/** @type {StateTransition[]} */
export const runtimeTransitions = [
    // Pause inference
    {
        event: 'PAUSE',
        from: 'runtime',
        to: 'runtime',
        /** @this {import('../state-machine.js').default} */
        action: function() {
            this.state.runtimeState = 'paused';
        }
    },

    // Resume inference
    {
        event: 'RESUME',
        from: 'runtime',
        to: 'runtime',
        /** @this {import('../state-machine.js').default} */
        action: function() {
            this.state.runtimeState = 'running';
        }
    },

    // Camera stream lost during runtime
    {
        event: 'STREAM_ENDED',
        from: 'runtime',
        to: 'runtime',
        /** @this {import('../state-machine.js').default} */
        action: function(data) {
            this.state.runtimeState = 'recovering';
            this.state.error = {
                code: 'STREAM_LOST',
                message: data.reason || 'Camera stream lost',
                recoverAction: {
                    label: 'Reconnect',
                    handler: () => this.dispatch('RETRY_STREAM')
                }
            };
        }
    },

    // Camera stream recovered
    {
        event: 'STREAM_RECOVERED',
        from: 'runtime',
        to: 'runtime',
        /** @this {import('../state-machine.js').default} */
        guard: function() {
            return this.state.runtimeState === 'recovering';
        },
        /** @this {import('../state-machine.js').default} */
        action: function(data) {
            this.state.webcamStream = data.stream;
            this.state.runtimeState = 'running';
            this.state.error = null;
        }
    },

    // Stream retry - user clicks "Reconnect" after camera loss
    {
        event: 'RETRY_STREAM',
        from: 'runtime',
        to: 'permission',
        /** @this {import('../state-machine.js').default} */
        guard: function() {
            return this.state.runtimeState === 'recovering';
        },
        /** @this {import('../state-machine.js').default} */
        action: function() {
            // Stop existing dead stream
            if (this.state.webcamStream) {
                this.state.webcamStream.getTracks().forEach(t => t.stop());
            }
            this.state.webcamStream = null;
            this.state.isVideoReady = false;
            this.state.error = null;
            this.state.runtimeState = 'idle';
        }
    }
];
