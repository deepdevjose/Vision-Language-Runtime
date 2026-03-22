// @ts-check

/**
 * Runtime domain transitions
 * Handles live inference execution, pause/resume, and stream recovery
 * 
 * Actions and guards are bound to StateMachine context, so 'this' refers to the StateMachine instance
 */

/** @type {import('./index').StateTransition[]} */
export const runtimeTransitions = [
    // Pause inference
    {
        event: 'PAUSE',
        from: 'runtime',
        to: 'runtime',
        action: function() {
            this.state.runtimeState = 'paused';
        }
    },

    // Resume inference
    {
        event: 'RESUME',
        from: 'runtime',
        to: 'runtime',
        action: function() {
            this.state.runtimeState = 'running';
        }
    },

    // Camera stream lost during runtime
    {
        event: 'STREAM_ENDED',
        from: 'runtime',
        to: 'runtime',
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
        guard: function() {
            return this.state.runtimeState === 'recovering';
        },
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
        guard: function() {
            return this.state.runtimeState === 'recovering';
        },
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
