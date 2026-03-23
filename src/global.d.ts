/**
 * Augment the global Window interface with custom VLM runtime properties.
 */
interface Window {
    /** Signals that a VLM inference pass is currently running. */
    __VLM_INFERENCE_ACTIVE__?: boolean;
}
