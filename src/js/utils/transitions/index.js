// @ts-check

import { permissionsTransitions } from './permissions.js';
import { loadingTransitions } from './loading.js';
import { runtimeTransitions } from './runtime.js';
import { errorTransitions } from './errors.js';

/**
 * StateTransition type definitions are maintained in state-machine.js
 * @typedef {import('../state-machine.js').StateTransition} StateTransition
 */

/**
 * Unified transition map combining all domains
 * - Maintains insertion order (permission → loading → runtime → error)
 * - Reduces merge conflicts by separating concerns
 * - Simplifies debugging and reduces cognitive load
 * 
 * Domains:
 * - Permissions: Camera access flows (~2 transitions)
 * - Loading: Model initialization and warmup (~7 transitions)
 * - Runtime: Live inference, pause/resume, stream recovery (~5 transitions)
 * - Errors: Error handling and recovery (~3 transitions)
 */
export const transitionMap = [
    ...permissionsTransitions,
    ...loadingTransitions,
    ...runtimeTransitions,
    ...errorTransitions
];

// Named exports for domain-specific access (if needed for audit/debugging)
export { permissionsTransitions };
export { loadingTransitions };
export { runtimeTransitions };
export { errorTransitions };

// Default export for backward compatibility
export default transitionMap;
