// @ts-check

/**
 * @file Type definitions for Vision-Language Runtime
 * JSDoc types for better IDE support and documentation
 *
 * ViewState values must match state-machine.js ViewState enum:
 *   'welcome' | 'permission' | 'loading' | 'runtime' | 'error' | 'image-upload'
 */

/**
 * @typedef {Object} WebGPUInfo
 * @property {boolean} supported - WebGPU is supported
 * @property {boolean} fp16Available - FP16 precision available
 * @property {string} [adapter] - GPU adapter info
 * @property {Object} [limits] - GPU limits
 */

/**
 * @typedef {Object} PerformanceEstimate
 * @property {'low' | 'medium' | 'high'} tier - Performance tier
 * @property {string} expectedLatency - Expected latency description
 * @property {string[]} recommendations - Performance recommendations
 */

/**
 * @typedef {Object} ModelState
 * @property {boolean} isLoaded - Model is loaded
 * @property {boolean} isLoading - Model is loading
 * @property {boolean} warmedUp - Model warmup completed
 * @property {number} avgInferenceTime - Average inference time in ms
 */

/**
 * @typedef {Object} InferenceOptions
 * @property {HTMLVideoElement | HTMLCanvasElement} source - Image source
 * @property {string} instruction - User prompt/instruction
 * @property {(text: string) => void} [onTextUpdate] - Streaming callback
 */

/**
 * @typedef {Object} CameraInfo
 * @property {string} deviceId - Device ID
 * @property {string} label - Camera label/name
 * @property {string} groupId - Device group ID
 */

/**
 * @typedef {Object} CaptionHistoryEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} prompt - User prompt
 * @property {string} caption - Generated caption
 * @property {boolean} frozen - Was frame frozen
 */

/**
 * @typedef {'info' | 'warn' | 'error' | 'debug'} LogLevel
 */

/**
 * @typedef {Object} LogEntry
 * @property {LogLevel} level - Log level
 * @property {string} message - Log message
 * @property {string} timestamp - ISO timestamp
 * @property {Object} [context] - Additional context
 */

/**
 * @typedef {Object} DiagnosticsData
 * @property {WebGPUInfo} gpu - GPU information
 * @property {ModelState} model - Model state
 * @property {number} avgInferenceTime - Average inference time
 * @property {number} tokensPerSecond - Estimated tokens/s
 * @property {number} estimatedMemoryMB - Estimated memory usage
 */

/**
 * Constants for ViewState values
 * Must be synchronized with state-machine.js ViewState typedef
 */
export const VIEW_STATES = {
    WELCOME: 'welcome',
    PERMISSION: 'permission',
    LOADING: 'loading',
    RUNTIME: 'runtime',
    ERROR: 'error',
    IMAGE_UPLOAD: 'image-upload',
};

/**
 * Constants for RuntimeState values
 */
export const RUNTIME_STATES = {
    IDLE: 'idle',
    WARMING: 'warming',
    RUNNING: 'running',
    PAUSED: 'paused',
    RECOVERING: 'recovering',
    FAILED: 'failed',
};

/**
 * Constants for LoadingPhase values
 */
export const LOADING_PHASES = {
    LOADING_MODEL: 'loading-model',
    LOADING_WGPU: 'loading-wgpu',
    WARMING_UP: 'warming-up',
    COMPLETE: 'complete',
};

/**
 * ViewState values synchronized with state-machine.js
 * @typedef {'welcome' | 'permission' | 'loading' | 'runtime' | 'error' | 'image-upload'} ViewState
 */

/**
 * @typedef {'idle' | 'warming' | 'running' | 'paused' | 'recovering' | 'failed'} RuntimeState
 */

/**
 * @typedef {'loading-model' | 'loading-wgpu' | 'warming-up' | 'complete'} LoadingPhase
 */

/**
 * @typedef {Object} AppState
 * @property {ViewState} viewState - Current view (matches state-machine.js)
 * @property {RuntimeState} runtimeState - Current runtime execution state
 * @property {LoadingPhase} loadingPhase - Loading screen phase
 * @property {string} currentPrompt - Current prompt text
 * @property {string} lastCaption - Last generated caption
 * @property {boolean} hasWebGPU - WebGPU detection result
 * @property {boolean} isVideoReady - Camera video ready
 * @property {ModelState} modelState - Model state
 * @property {WebGPUInfo} gpuInfo - GPU information
 * @property {CaptionHistoryEntry[]} history - Caption history
 * @property {string|null} error - Current error message
 */

// UI State (separate from domain)
/**
 * @typedef {Object} UIState
 * @property {boolean} isPromptFocused - Prompt input focused
 * @property {boolean} isCaptionExpanded - Caption panel expanded
 * @property {boolean} isDragging - Is dragging a component
 * @property {boolean} isHistoryVisible - History panel visible
 * @property {boolean} isDiagnosticsVisible - Diagnostics panel visible
 */

export default {};
