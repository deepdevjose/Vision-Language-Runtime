// @ts-check

import { VIEW_STATES, LOADING_PHASES } from '../../types.js';

/**
 * Permission domain transitions
 * Handles camera permission flows and related state changes
 *
 * Each function is bound to StateMachine context at initialization,
 * so 'this' refers to the StateMachine instance.
 * @see state-machine.js defineTransitions() for binding logic
 */

/**
 * @typedef {import('../state-machine.js').StateTransition} StateTransition
 */

/** @type {StateTransition[]} */
export const permissionsTransitions = [
    // Permission granted - successful camera access
    {
        event: 'PERMISSION_GRANTED',
        from: VIEW_STATES.PERMISSION,
        to: VIEW_STATES.LOADING,
        guard: (data) => !!data.stream,
        /** @this {import('../state-machine.js').default} */
        action: function (data) {
            this.state.webcamStream = data.stream;
            this.state.loadingPhase = LOADING_PHASES.LOADING_WGPU;
        },
    },

    // Permission denied - camera access blocked
    {
        event: 'PERMISSION_DENIED',
        from: VIEW_STATES.PERMISSION,
        to: VIEW_STATES.ERROR,
        /** @this {import('../state-machine.js').default} */
        action: function (data) {
            this.state.error = {
                code: 'CAMERA_DENIED',
                message: data.message || 'Camera access denied',
                technical: data.technical,
                recoverAction: {
                    label: 'Retry',
                    handler: () => this.dispatch('RETRY'),
                },
            };
        },
    },
];
