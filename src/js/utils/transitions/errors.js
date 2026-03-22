// @ts-check

/**
 * Error domain transitions
 * Handles error states and recovery flows
 * 
 * Actions are bound to StateMachine context, so 'this' refers to the StateMachine instance
 */

/** @type {import('./index').StateTransition[]} */
export const errorTransitions = [
    // Generic component error - can occur from any state
    {
        event: 'ERROR',
        from: '*',
        to: 'error',
        action: function(data) {
            this.state.error = {
                code: data?.code || 'UNKNOWN_COMPONENT_ERROR',
                message: data?.message || 'Component failed unexpectedly',
                technical: data?.technical,
                recoverAction: {
                    label: 'Reload Application',
                    handler: () => window.location.reload()
                }
            };
        }
    },

    // Fatal error - can occur from any state
    {
        event: 'FATAL_ERROR',
        from: '*',
        to: 'error',
        action: function(data) {
            this.state.runtimeState = 'failed';
            this.state.error = {
                code: data?.code || 'FATAL_ERROR',
                message: data?.message || 'A catastrophic error occurred',
                technical: data?.technical,
                recoverAction: data?.recoverAction || {
                    label: 'Reload Application',
                    handler: () => window.location.reload()
                }
            };
        }
    },

    // Recover from error state
    {
        event: 'RETRY',
        from: 'error',
        to: 'permission',
        action: function() {
            this.state.error = null;
            this.state.runtimeState = 'idle';
        }
    }
];
