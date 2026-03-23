/**
 * Augment the global Window interface with custom VLM runtime properties.
 */
interface Window {
    /** Signals that a VLM inference pass is currently running. */
    __VLM_INFERENCE_ACTIVE__?: boolean;
    
    /** Metadata for GPU recovery attempts (attempts and last attempt timestamp). */
    __VLM_GPU_RECOVERY_META__?: {
        attempts: number;
        lastAttemptAt: number;
    };
    
    /** Signals that a GPU recovery operation is currently in progress. */
    __VLM_GPU_RECOVERY_IN_PROGRESS__?: boolean;
}
