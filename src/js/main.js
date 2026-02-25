/**
 * VLM Runtime - Main Entry
 * 
 * State machine architecture with formal transitions.
 * Separates view state from runtime state.
 */

import StateMachine from './utils/state-machine.js';
import { clearChildren, createElement } from './utils/dom-helpers.js';
import { createWebcamPermissionDialog } from './components/webcam-permission-dialog.js';
import { createWelcomeScreen } from './components/welcome-screen.js';
import { createLoadingScreen } from './components/loading-screen.js';
import { createCaptioningView } from './components/captioning-view.js';
import { createImageUpload, fileToCanvas } from './components/image-upload.js';
import { createErrorScreen } from './components/error-screen.js';
import { createAsciiBackground } from './components/ascii-background.js';
import { createDiagnosticsPanel } from './components/diagnostics-panel.js';
import { getStream, onStreamEnded, getCameraErrorMessage } from './services/webcam-service.js';
import webgpuDetector from './utils/webgpu-detector.js';
import logger from './utils/logger.js';

// =============================
// Early GPU Detection
// =============================

/**
 * Detect WebGPU and FP16 support early
 * This runs before anything else to verify GPU capabilities
 */
let hasWebGPU = false;
(async () => {
    try {
        const gpuInfo = await webgpuDetector.detect();
        hasWebGPU = gpuInfo.supported;
        if (gpuInfo.fp16Available) {
            console.log('🚀 FP16 enabled - expect 2× faster inference!');
        }
        if (!hasWebGPU) {
            console.warn('⚠️ WebGPU not available - will use image upload fallback mode');
        }
    } catch (error) {
        console.error('GPU detection failed:', error);
        hasWebGPU = false;
    }
})();

// =============================
// Global State Machine
// =============================

const stateMachine = new StateMachine({
    viewState: 'permission',
    runtimeState: 'idle',
    loadingPhase: 'loading-wgpu',
    webcamStream: null,
    isVideoReady: false,
    hasWebGPU: true,
    error: null
});

// =============================
// Recovery Action Handlers
// =============================

/**
 * Handle RETRY event from error screen
 * Resets state machine to permission flow
 */
stateMachine.addEventListener('transition', (event) => {
    const { from, to, eventName } = event.detail;
    
    if (eventName === 'RETRY') {
        logger.info('User triggered retry - returning to permission flow');
        // Cleanup any existing streams
        if (stateMachine.state.webcamStream) {
            stateMachine.state.webcamStream.getTracks().forEach(track => track.stop());
        }
        // Reset video element
        if (videoElement) {
            videoElement.srcObject = null;
        }
    }
});

const root = document.getElementById('root');

// Persistent refs to avoid recreation
let videoElement = null;
let currentComponent = null;
let currentStream = null;  // Prevents unnecessary srcObject reassignments
let asciiBackground = null;

// =============================
// Video Element Setup
// =============================

/**
 * Creates singleton video element with aggressive anti-pause protection.
 * The browser loves pausing video during canvas operations - we don't let it.
 */
function createVideoElement() {
    if (!videoElement) {
        videoElement = createElement('video', {
            className: 'video-background',
            attributes: {
                autoplay: '',
                muted: '',
                playsinline: ''
            }
        });

        // Nuclear option: instantly resume on any pause attempt
        // (canvas.drawImage sometimes triggers pause events - idk why, but this fixes it)
        // it works. don't touch.
        videoElement.addEventListener('pause', () => {
            if (videoElement.srcObject) {
                videoElement.play().catch(err => console.error('Failed to resume video:', err));
            }
        });

        videoElement.addEventListener('canplay', () => {
            stateMachine.setState({ isVideoReady: true });
            videoElement.play().catch(err => console.error('Failed to play video:', err));
        }, { once: true });
    }

    return videoElement;
}

/**
 * Progressive blur states for smooth visual transitions.
 * Gives that Apple-ish depth of field effect between screens.
 */
function getVideoBlur(viewState) {
    const blurStates = {
        'permission': 'blur(20px) brightness(0.2) saturate(0.5)',
        'welcome': 'blur(12px) brightness(0.3) saturate(0.7)',
        'loading': 'blur(8px) brightness(0.4) saturate(0.8)',
        'runtime': 'none',
        'error': 'blur(16px) brightness(0.2) saturate(0.5)',
        'image-upload': 'blur(10px) brightness(0.3) saturate(0.6)'
    };

    return blurStates[viewState] || blurStates['permission'];
}

// =============================
// Render Pipeline
// =============================

/**
 * Main render function - handles full app lifecycle.
 * Cleans up old components before mounting new ones (prevents memory leaks).
 */
function render(state) {
    const { viewState, runtimeState, webcamStream, isVideoReady, error } = state;

    // Cleanup previous component lifecycle
    if (currentComponent && currentComponent.cleanup) {
        currentComponent.cleanup();
    }
    
    // ASCII background needs manual cleanup (canvas contexts don't GC immediately)
    if (asciiBackground) {
        asciiBackground.cleanup();
        asciiBackground = null;
    }
    
    clearChildren(root);

    // Background layer always present
    const bgLayer = createElement('div', {
        className: 'absolute inset-0 bg-gray-900'
    });
    root.appendChild(bgLayer);

    // Video setup with optimization guards
    if (webcamStream) {
        const video = createVideoElement();
        
        // Only reassign srcObject if stream actually changed (avoids flicker)
        if (video.srcObject !== webcamStream) {
            video.srcObject = webcamStream;
            currentStream = webcamStream;
            video.play().catch(err => console.error('Failed to auto-play video:', err));
        }
        
        video.style.filter = getVideoBlur(viewState);
        video.style.opacity = isVideoReady ? '1' : '0';
        
        // Extra safety check for runtime state (inference needs live video)
        // triple-checking because browsers are weird with autoplay policies
        if (viewState === 'runtime' && isVideoReady && video.paused) {
            video.play().catch(err => console.error('Failed to ensure video playback:', err));
        }
        
        root.appendChild(video);
    }

    // Dark overlay for non-runtime screens (adds depth)
    if (viewState !== 'runtime') {
        const overlay = createElement('div', {
            className: 'absolute inset-0 bg-overlay'
        });
        root.appendChild(overlay);
    }

    // =============================
    // State Machine Rendering
    // =============================

    switch (viewState) {
        case 'permission':
            currentComponent = createWebcamPermissionDialog(
                (stream) => {
                    // Success - grant permission
                    stateMachine.dispatch('PERMISSION_GRANTED', { stream });
                },
                (error) => {
                    // Error - permission denied
                    const errorInfo = getCameraErrorMessage(error);
                    stateMachine.dispatch('PERMISSION_DENIED', {
                        message: errorInfo.message,
                        technical: errorInfo.technical
                    });
                }
            );
            root.appendChild(currentComponent);
            break;

        case 'welcome':
            currentComponent = createWelcomeScreen(() => {
                // Check if WebGPU is available
                if (hasWebGPU) {
                    stateMachine.dispatch('START');
                } else {
                    logger.warn('WebGPU not available - using image upload mode');
                    stateMachine.dispatch('START_FALLBACK');
                }
            });
            root.appendChild(currentComponent);
            break;

        case 'loading':
            currentComponent = createLoadingScreen(
                // onPhaseChange
                (event, data) => {
                    stateMachine.dispatch(event, data);
                },
                // onComplete
                () => {
                    stateMachine.dispatch('WARMUP_COMPLETE');
                },
                // onError
                (error) => {
                    stateMachine.dispatch('MODEL_FAILED', { error: error.message });
                }
            );
            root.appendChild(currentComponent);
            break;

        case 'runtime':
            // ASCII art background (6% opacity, totally optional but looks sick)
            if (videoElement && isVideoReady) {
                asciiBackground = createAsciiBackground(videoElement);
                root.insertBefore(asciiBackground.element, root.firstChild);
                
                // 500ms delay - tested other values, this one just feels right
                setTimeout(() => {
                    asciiBackground.element.classList.add('active');
                    asciiBackground.start();
                }, 500);
            }
            
            currentComponent = createCaptioningView(videoElement);
            root.appendChild(currentComponent);
            break;

        case 'error':
            currentComponent = createErrorScreen(error);
            root.appendChild(currentComponent);
            break;

        case 'image-upload':
            // Fallback mode for devices without WebGPU
            currentComponent = createImageUpload(async (file) => {
                try {
                    logger.info('Processing uploaded image', { file: file.name });
                    
                    // Convert file to canvas
                    const canvas = await fileToCanvas(file);
                    
                    // TODO: Run inference on the uploaded image
                    // This would require modifying vision-language-service to accept canvas
                    // For now, just show a message
                    
                    const resultOverlay = createElement('div', {
                        className: 'fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]'
                    });
                    
                    const resultContent = createElement('div', {
                        className: 'glass-container p-8 max-w-2xl mx-4'
                    });
                    
                    const resultTitle = createElement('h3', {
                        className: 'text-2xl font-light mb-4',
                        textContent: '❌ Not Supported Yet'
                    });
                    
                    const resultText = createElement('p', {
                        className: 'text-sm opacity-80 mb-6',
                        textContent: 'Image upload analysis requires WebGPU support, which is not available on your device. This feature is planned for a future update using CPU/WASM inference.'
                    });
                    
                    const closeButton = createElement('button', {
                        className: 'glass-button px-6 py-3',
                        textContent: 'Close'
                    });
                    
                    closeButton.addEventListener('click', () => {
                        resultOverlay.remove();
                    });
                    
                    resultContent.appendChild(resultTitle);
                    resultContent.appendChild(resultText);
                    resultContent.appendChild(closeButton);
                    resultOverlay.appendChild(resultContent);
                    document.body.appendChild(resultOverlay);
                    
                    logger.warn('Image upload not fully supported without WebGPU');
                    
                } catch (error) {
                    logger.error('Failed to process uploaded image', { error: error.message });
                    alert('Failed to process image: ' + error.message);
                }
            });
            root.appendChild(currentComponent);
            break;
    }
}

// =============================
// Bootstrap
// =============================

// Handle camera disconnection (device unplugged, permission revoked, etc)
// because apparently "always connected" is too much to ask
onStreamEnded((errorMessage) => {
    stateMachine.dispatch('STREAM_ENDED', { 
        reason: errorMessage || 'The camera was disconnected or access was revoked.'
    });
});

// Subscribe to state changes
stateMachine.addEventListener('statechange', (event) => {
    render(event.detail.state);
});

// Initial render
render(stateMachine.getState());

// =============================
// Diagnostics Panel Setup
// =============================

const diagnosticsPanel = createDiagnosticsPanel();
document.body.appendChild(diagnosticsPanel.element);

// Keyboard shortcut: Ctrl+Shift+D (or Cmd+Shift+D on Mac)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        diagnosticsPanel.toggle();
    }
});

// Log app initialization
logger.info('Vision-Language Runtime initialized', {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language
});

// Expose diagnostics panel globally for console access
window.__VLM_DIAGNOSTICS__ = diagnosticsPanel;
window.__VLM_LOGGER__ = logger;

console.log('%c🔍 Diagnostics Panel', 'color: #00a8ff; font-weight: bold');
console.log('%cPress Ctrl+Shift+D to open diagnostics', 'color: #888');
console.log('%cAccess via: window.__VLM_DIAGNOSTICS__', 'color: #888');
console.log('%cLogger: window.__VLM_LOGGER__', 'color: #888');
