/**
 * VLM Runtime - Main Entry
 * 
 * State-driven architecture with lifecycle management.
 * No frameworks, just vanilla JS doing its thing.
 */

import StateManager from './utils/state-manager.js';
import { clearChildren, createElement } from './utils/dom-helpers.js';
import { createWebcamPermissionDialog } from './components/WebcamPermissionDialog.js';
import { createWelcomeScreen } from './components/WelcomeScreen.js';
import { createLoadingScreen } from './components/LoadingScreen.js';
import { createCaptioningView } from './components/CaptioningView.js';
import { createAsciiBackground } from './components/AsciiBackground.js';
import { getStream, onStreamEnded } from './services/webcam-service.js';
import webgpuDetector from './utils/webgpu-detector.js';

// =============================
// Early GPU Detection
// =============================

/**
 * Detect WebGPU and FP16 support early
 * This runs before anything else to verify GPU capabilities
 */
(async () => {
    try {
        const gpuInfo = await webgpuDetector.detect();
        if (gpuInfo.fp16Available) {
            console.log('🚀 FP16 enabled - expect 2× faster inference!');
        }
    } catch (error) {
        console.error('GPU detection failed:', error);
    }
})();

// =============================
// Global State
// =============================

const stateManager = new StateManager({
    appState: 'requesting-permission',
    webcamStream: null,
    isVideoReady: false
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
            stateManager.setState({ isVideoReady: true });
            videoElement.play().catch(err => console.error('Failed to play video:', err));
        }, { once: true });
    }

    return videoElement;
}

/**
 * Progressive blur states for smooth visual transitions.
 * Gives that Apple-ish depth of field effect between screens.
 */
function getVideoBlur(appState) {
    const blurStates = {
        'requesting-permission': 'blur(20px) brightness(0.2) saturate(0.5)',
        'welcome': 'blur(12px) brightness(0.3) saturate(0.7)',
        'loading': 'blur(8px) brightness(0.4) saturate(0.8)',
        'captioning': 'none'
    };

    return blurStates[appState] || blurStates['requesting-permission'];
}

// =============================
// Render Pipeline
// =============================

/**
 * Main render function - handles full app lifecycle.
 * Cleans up old components before mounting new ones (prevents memory leaks).
 */
function render(state) {
    const { appState, webcamStream, isVideoReady } = state;

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
        
        video.style.filter = getVideoBlur(appState);
        video.style.opacity = isVideoReady ? '1' : '0';
        
        // Extra safety check for captioning state (inference needs live video)
        // triple-checking because browsers are weird with autoplay policies
        if (appState === 'captioning' && isVideoReady && video.paused) {
            video.play().catch(err => console.error('Failed to ensure video playback:', err));
        }
        
        root.appendChild(video);
    }

    // Dark overlay for non-runtime screens (adds depth)
    if (appState !== 'captioning') {
        const overlay = createElement('div', {
            className: 'absolute inset-0 bg-overlay'
        });
        root.appendChild(overlay);
    }

    // =============================
    // State Machine Rendering
    // =============================

    switch (appState) {
        case 'requesting-permission':
            currentComponent = createWebcamPermissionDialog((stream) => {
                stateManager.setState({
                    webcamStream: stream,
                    appState: 'welcome'
                });
            });
            root.appendChild(currentComponent);
            break;

        case 'welcome':
            currentComponent = createWelcomeScreen(() => {
                stateManager.setState({ appState: 'loading' });
            });
            root.appendChild(currentComponent);
            break;

        case 'loading':
            currentComponent = createLoadingScreen(() => {
                stateManager.setState({ appState: 'captioning' });
            });
            root.appendChild(currentComponent);
            break;

        case 'captioning':
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
    }
}

// =============================
// Bootstrap
// =============================

// Handle camera disconnection (device unplugged, permission revoked, etc)
// because apparently "always connected" is too much to ask
onStreamEnded((errorMessage) => {
    // Show error overlay
    const errorOverlay = createElement('div', {
        className: 'fixed inset-0 flex items-center justify-center',
        style: {
            background: 'rgba(0, 0, 0, 0.95)',
            zIndex: '9999'
        }
    });

    const errorContent = createElement('div', {
        className: 'glass-container p-8',
        style: {
            maxWidth: '500px',
            textAlign: 'center'
        }
    });

    const errorIcon = createElement('div', {
        style: {
            fontSize: '48px',
            marginBottom: '16px'
        },
        text: '📷'
    });

    const errorTitle = createElement('h2', {
        style: {
            fontSize: '24px',
            fontWeight: '600',
            color: 'rgba(255, 255, 255, 0.98)',
            marginBottom: '12px'
        },
        text: 'Camera Connection Lost'
    });

    const errorText = createElement('p', {
        style: {
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.6)',
            marginBottom: '24px',
            lineHeight: '1.5'
        },
        text: errorMessage || 'The camera was disconnected or access was revoked. Please reconnect your camera and reload the page.'
    });

    const reloadButton = createElement('button', {
        className: 'glass-button',
        text: 'Reload Page',
        style: {
            padding: '12px 24px',
            background: 'rgba(255, 255, 255, 0.98)',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600'
        }
    });

    reloadButton.addEventListener('click', () => {
        window.location.reload();
    });

    errorContent.appendChild(errorIcon);
    errorContent.appendChild(errorTitle);
    errorContent.appendChild(errorText);
    errorContent.appendChild(reloadButton);
    errorOverlay.appendChild(errorContent);
    document.body.appendChild(errorOverlay);
});

stateManager.subscribe(({ state }) => {
    render(state);
});

render(stateManager.getState());
