# State Machine Modularization

## Overview
The state machine transition table has been normalized and modularized by domain to reduce cognitive load, minimize merge conflicts, and improve auditability.

## Architecture

### Directory Structure
```
src/js/utils/
├── state-machine.js          # Main StateMachine class (unchanged behavior)
└── transitions/
    ├── index.js              # Unified transition map (all domains combined)
    ├── permissions.js        # Permission grant/deny flows
    ├── loading.js            # Welcome, model loading, warmup phases
    ├── runtime.js            # Live inference, pause/resume, stream recovery
    └── errors.js             # Error handling and recovery
```

### Domain Breakdown

#### **Permissions** (~2 transitions)
- `PERMISSION_GRANTED`: Successful camera access
- `PERMISSION_DENIED`: Camera access blocked

#### **Loading** (~7 transitions)
- `START`: Begin with WebGPU enabled
- `START_FALLBACK`: Begin without WebGPU (image upload fallback)
- `WGPU_READY`: WebGPU availability confirmed
- `MODEL_LOADED`: AI model initialized
- `WARMUP_COMPLETE`: Model warmup finished (2 variants: from loading→runtime and late from runtime→runtime)
- `MODEL_FAILED`: Model initialization failed

#### **Runtime** (~5 transitions)
- `PAUSE`: Pause inference
- `RESUME`: Resume inference
- `STREAM_ENDED`: Camera stream lost during runtime
- `STREAM_RECOVERED`: Stream reconnected after loss
- `RETRY_STREAM`: User initiates reconnection after stream loss

#### **Errors** (~3 transitions)
- `ERROR`: Generic component error (from any state)
- `FATAL_ERROR`: Catastrophic error (from any state)
- `RETRY`: Recover from error state

## Implementation Details

### Unified Transition Map
The `transitions/index.js` exports a single `transitionMap` array that combines all domain transitions in order:
```javascript
export const transitionMap = [
    ...permissionsTransitions,
    ...loadingTransitions,
    ...runtimeTransitions,
    ...errorTransitions
];
```

### Context Binding
Each transition domain uses JavaScript `function` declarations with explicit `this` references:
```javascript
{
    event: 'START',
    from: 'welcome',
    to: 'permission',
    guard: function() {
        return this.state.hasWebGPU;
    },
    action: function() {
        // this refers to the StateMachine instance
    }
}
```

The `StateMachine` class binds guards and actions at initialization:
```javascript
defineTransitions() {
    return transitionMap.map(transition => {
        const wrapped = { ...transition };
        
        if (transition.guard) {
            wrapped.guard = (data) => transition.guard.call(this, data);
        }
        if (transition.action) {
            wrapped.action = (data) => transition.action.call(this, data);
        }
        
        return wrapped;
    });
}
```

## Benefits

### Reduced Merge Conflicts
- Each domain in separate file
- Linear append when adding transitions
- No large transition array to merge

### Improved Auditability
- Domain-specific files easy to review
- Clear separation of concerns
- Easier to trace state transitions by domain

### Simplified Testing
- Can test domains independently
- Easier to understand transition flows
- Better IDE support with separate modules

## Backward Compatibility

✅ **Fully compatible** - No breaking changes
- All public `StateMachine` methods unchanged
- All transitions function identically
- All tests pass without modification

## Usage

No changes needed for existing code using `StateMachine`:
```javascript
import StateMachine from './src/js/utils/state-machine.js';

const sm = new StateMachine();
sm.dispatch('PERMISSION_GRANTED', { stream });
```

## Future Extensions

When adding new transitions:

1. **Identify the domain** (permissions, loading, runtime, errors, or new domain)
2. **Add transition object** to the appropriate file in `src/js/utils/transitions/`
3. **Export from domain file** as part of the domain array
4. **Domain array auto-combined** in `transitions/index.js`

Example: Adding a new "notifications" domain
```javascript
// src/js/utils/transitions/notifications.js
export const notificationsTransitions = [
    { event: 'SHOW_NOTIFICATION', from: '*', to: '*', action: function(data) { ... } }
];

// Update src/js/utils/transitions/index.js
export const transitionMap = [
    ...permissionsTransitions,
    ...loadingTransitions,
    ...runtimeTransitions,
    ...errorTransitions,
    ...notificationsTransitions  // New domain
];
```

## Testing

All existing tests pass:
```bash
node tests/state-machine.test.js
# 📊 Results: 23 passed, 0 failed
```

Run with:
```bash
npm test  # or
node tests/state-machine.test.js
```
