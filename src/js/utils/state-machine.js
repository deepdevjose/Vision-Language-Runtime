// @ts-check

import { transitionMap } from './transitions/index.js';

/**
 * @typedef {'permission' | 'welcome' | 'loading' | 'runtime' | 'error' | 'image-upload'} ViewState
 * @typedef {'idle' | 'warming' | 'running' | 'paused' | 'recovering' | 'failed'} RuntimeState
 * @typedef {'loading-model' | 'loading-wgpu' | 'warming-up' | 'complete'} LoadingPhase
 */

/**
 * @typedef {Object} AppState
 * @property {ViewState} viewState - Current view/screen
 * @property {RuntimeState} runtimeState - Current runtime execution state
 * @property {LoadingPhase} loadingPhase - Loading screen phase
 * @property {MediaStream|null} webcamStream - Active camera stream
 * @property {boolean} isVideoReady - Video element ready to play
 * @property {boolean} hasWebGPU - WebGPU availability
 * @property {ErrorState|null} error - Current error state
 */

/**
 * @typedef {Object} ErrorState
 * @property {string} code - Error code (e.g., 'CAMERA_DENIED', 'MODEL_LOAD_FAILED')
 * @property {string} message - User-friendly error message
 * @property {string} [technical] - Technical error details
 * @property {RecoverAction|null} recoverAction - Action to recover from error
 */

/**
 * @typedef {Object} RecoverAction
 * @property {string} label - Button label (e.g., 'Retry', 'Reload Page')
 * @property {Function} handler - Function to execute on click
 */

/**
 * @typedef {Object} StateTransition
 * @property {string} event - Event name
 * @property {ViewState | '*'} from - Source state (or '*' for any state)
 * @property {ViewState} to - Target state
 * @property {(data?: any) => boolean} [guard] - Guard function (returns boolean)
 * @property {(data?: any) => void} [action] - Side effect to execute
 */

/**
 * @typedef {Object} ErrorPayload
 * @property {string} [code] - Internal error code mapping
 * @property {string} message - Human readable reason
 * @property {any} [technical] - Raw error object
 * @property {RecoverAction} [recoverAction] - Predefined recovery path
 */

/**
 * State Machine Manager
 * Manages app view state and runtime state separately with formal transitions
 */
class StateMachine extends EventTarget {
    /**
     * @param {Partial<AppState>} [initialState={}]
     */
    constructor(initialState = {}) {
        super();

        /** @type {AppState} */
        this.state = {
            viewState: 'permission',
            runtimeState: 'idle',
            loadingPhase: 'loading-model',
            webcamStream: null,
            isVideoReady: false,
            hasWebGPU: true,
            error: null,
            ...initialState
        };

        /** @type {StateTransition[]} */
        this.transitions = this.defineTransitions();
    }

    /**
     * Define all valid state transitions
     * Imports modularized transitions from domain-specific modules:
     * - Permissions: Camera access flows
     * - Loading: Model initialization and warmup
     * - Runtime: Live inference, pause/resume, stream recovery
     * - Errors: Error handling and recovery
     * 
     * Each guard and action is bound to this StateMachine instance for proper state access
     * 
     * @returns {StateTransition[]}
     */
    defineTransitions() {
        // Bind all transition guards and actions to this instance's context
        return transitionMap.map(transition => {
            const wrapped = { ...transition };

            // Wrap guard to bind 'this' context if present
            if (transition.guard) {
                wrapped.guard = (data) => transition.guard.call(this, data);
            }

            // Wrap action to bind 'this' context if present
            if (transition.action) {
                wrapped.action = (data) => transition.action.call(this, data);
            }

            return wrapped;
        });
    }

    /**
     * Dispatch an event to trigger state transition
     * @param {string} event - Event name
     * @param {Object} [data] - Event data
     * @returns {boolean} Whether transition was successful
     */
    dispatch(event, data = {}) {
        const currentState = this.state.viewState;

        // Find matching transition
        const transition = this.transitions.find(t =>
            t.event === event && (t.from === currentState || t.from === '*')
        );

        if (!transition) {
            console.warn(`No transition for event "${event}" from state "${currentState}"`);
            return false;
        }

        // Check guard
        if (transition.guard && !transition.guard(data)) {
            console.warn(`Transition guard failed for "${event}" from "${currentState}"`);
            return false;
        }

        const prevState = { ...this.state };

        // Execute action (side effects)
        if (transition.action) {
            transition.action(data);
        }

        // Update view state
        if (transition.to !== currentState) {
            this.state.viewState = transition.to;
        }

        // Emit change event
        this.dispatchEvent(new CustomEvent('statechange', {
            detail: {
                state: this.state,
                prevState,
                event,
                data
            }
        }));

        console.log(`[StateMachine] ${event}: ${prevState.viewState} → ${this.state.viewState}`,
            { runtimeState: this.state.runtimeState, loadingPhase: this.state.loadingPhase });

        return true;
    }

    /**
     * Update state directly (for non-transition updates)
     * @param {Partial<AppState>} updates
     */
    setState(updates) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...updates };

        this.dispatchEvent(new CustomEvent('statechange', {
            detail: { state: this.state, prevState, updates }
        }));
    }

    /**
     * Get current state (returns copy)
     * @returns {AppState}
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     * @param {Function} callback
     * @returns {Function} Unsubscribe function
     */
    subscribe(callback) {
        const listener = (event) => callback(event.detail);
        this.addEventListener('statechange', listener);
        return () => this.removeEventListener('statechange', listener);
    }

    /**
     * Check if current state can transition to target
     * @param {ViewState} targetState
     * @returns {boolean}
     */
    canTransitionTo(targetState) {
        return this.transitions.some(t =>
            t.from === this.state.viewState && t.to === targetState
        );
    }

    /**
     * Get available events from current state
     * @returns {string[]}
     */
    getAvailableEvents() {
        return this.transitions
            .filter(t => t.from === this.state.viewState || t.from === '*')
            .map(t => t.event);
    }
}

export default StateMachine;
