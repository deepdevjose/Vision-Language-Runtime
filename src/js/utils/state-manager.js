// @ts-check

/**
 * @typedef {Object} StateChangeDetail
 * @property {Object} state - Current state
 * @property {Object} prevState - Previous state
 * @property {Object} updates - Updates applied
 */

/**
 * @typedef {(detail: StateChangeDetail) => void} StateChangeCallback
 */

/**
 * Simple state manager with event emitting
 * Provides reactive state management with type safety
 */
class StateManager extends EventTarget {
    /**
     * @param {Object} [initialState={}] - Initial state object
     */
    constructor(initialState = {}) {
        super();
        /** @type {Object} */
        this.state = { ...initialState };
    }

    /**
     * Update state with new values
     * @param {Object} updates - Partial state updates
     * @returns {Object} New state
     */
    setState(updates) {
        const prevState = { ...this.state };
        const newState = { ...this.state, ...updates };

        // Check if anything actually changed (shallow comparison)
        const hasChanges = Object.keys(updates).some(
            key => this.state[key] !== updates[key]
        );

        if (!hasChanges) {
            // No changes, skip event emission
            return this.state;
        }

        this.state = newState;

        // Emit change event
        this.dispatchEvent(new CustomEvent('statechange', {
            detail: { state: this.state, prevState, updates }
        }));

        return this.state;
    }

    /**
     * Get current state (returns copy)
     * @returns {Object} Current state
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Subscribe to state changes
     * @param {StateChangeCallback} callback - Callback function
     * @returns {() => void} Unsubscribe function
     */
    subscribe(callback) {
        const listener = (event) => callback(event.detail);
        this.addEventListener('statechange', listener);

        // Return unsubscribe function
        return () => this.removeEventListener('statechange', listener);
    }
}

export default StateManager;
