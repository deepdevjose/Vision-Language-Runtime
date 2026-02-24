/**
 * Simple state manager with event emitting
 */
class StateManager extends EventTarget {
    constructor(initialState = {}) {
        super();
        this.state = { ...initialState };
    }

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

    getState() {
        return { ...this.state };
    }

    subscribe(callback) {
        const listener = (event) => callback(event.detail);
        this.addEventListener('statechange', listener);

        // Return unsubscribe function
        return () => this.removeEventListener('statechange', listener);
    }
}

export default StateManager;
