// @ts-check

/**
 * Permission domain transitions
 * Handles camera permission flows and related state changes
 * 
 * Actions are bound to StateMachine context, so 'this' refers to the StateMachine instance
 */

/** @type {import('./index').StateTransition[]} */
export const permissionsTransitions = [
    // Permission granted - successful camera access
    {
        event: 'PERMISSION_GRANTED',
        from: 'permission',
        to: 'loading',
        guard: (data) => !!data.stream,
        action: function(data) {
            this.state.webcamStream = data.stream;
            this.state.loadingPhase = 'loading-wgpu';
        }
    },

    // Permission denied - camera access blocked
    {
        event: 'PERMISSION_DENIED',
        from: 'permission',
        to: 'error',
        action: function(data) {
            this.state.error = {
                code: 'CAMERA_DENIED',
                message: data.message || 'Camera access denied',
                technical: data.technical,
                recoverAction: {
                    label: 'Retry',
                    handler: () => this.dispatch('RETRY')
                }
            };
        }
    }
];
