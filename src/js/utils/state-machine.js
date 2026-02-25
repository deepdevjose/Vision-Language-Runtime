// @ts-check

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
 * @property {Function} [guard] - Guard function (returns boolean)
 * @property {Function} [action] - Side effect to execute
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
     * @returns {StateTransition[]}
     */
    defineTransitions() {
        return [
            // Permission flow
            {
                event: 'PERMISSION_GRANTED',
                from: 'permission',
                to: 'welcome',
                guard: (data) => !!data.stream,
                action: (data) => {
                    this.state.webcamStream = data.stream;
                }
            },
            {
                event: 'PERMISSION_DENIED',
                from: 'permission',
                to: 'error',
                action: (data) => {
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
            },

            // Welcome flow
            {
                event: 'START',
                from: 'welcome',
                to: 'loading',
                guard: () => this.state.hasWebGPU && !!this.state.webcamStream,
                action: () => {
                    this.state.loadingPhase = 'loading-wgpu';
                }
            },
            {
                event: 'START_FALLBACK',
                from: 'welcome',
                to: 'image-upload',
                guard: () => !this.state.hasWebGPU
            },

            // Loading phases
            {
                event: 'WGPU_READY',
                from: 'loading',
                to: 'loading',
                action: () => {
                    this.state.loadingPhase = 'loading-model';
                }
            },
            {
                event: 'MODEL_LOADED',
                from: 'loading',
                to: 'loading',
                action: () => {
                    this.state.loadingPhase = 'warming-up';
                    this.state.runtimeState = 'warming';
                }
            },
            {
                event: 'WARMUP_COMPLETE',
                from: 'loading',
                to: 'runtime',
                guard: () => this.state.isVideoReady,
                action: () => {
                    this.state.loadingPhase = 'complete';
                    this.state.runtimeState = 'running';
                }
            },

            // Runtime flow
            {
                event: 'PAUSE',
                from: 'runtime',
                to: 'runtime',
                action: () => {
                    this.state.runtimeState = 'paused';
                }
            },
            {
                event: 'RESUME',
                from: 'runtime',
                to: 'runtime',
                action: () => {
                    this.state.runtimeState = 'running';
                }
            },
            {
                event: 'STREAM_ENDED',
                from: 'runtime',
                to: 'runtime',
                action: (data) => {
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
            {
                event: 'STREAM_RECOVERED',
                from: 'runtime',
                to: 'runtime',
                guard: () => this.state.runtimeState === 'recovering',
                action: (data) => {
                    this.state.webcamStream = data.stream;
                    this.state.runtimeState = 'running';
                    this.state.error = null;
                }
            },

            // Error states
            {
                event: 'MODEL_FAILED',
                from: 'loading',
                to: 'error',
                action: (data) => {
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
            },
            {
                event: 'FATAL_ERROR',
                from: '*', // Any state
                to: 'error',
                action: (data) => {
                    this.state.runtimeState = 'failed';
                    this.state.error = {
                        code: data.code || 'UNKNOWN_ERROR',
                        message: data.message || 'An unexpected error occurred',
                        technical: data.technical,
                        recoverAction: data.recoverAction || {
                            label: 'Reload Page',
                            handler: () => window.location.reload()
                        }
                    };
                }
            },

            // Recovery
            {
                event: 'RETRY',
                from: 'error',
                to: 'permission',
                action: () => {
                    this.state.error = null;
                    this.state.runtimeState = 'idle';
                }
            }
        ];
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
