/**
 * Webcam service for managing camera stream
 * Mobile-optimized with fallback constraints
 */

let currentStream = null;
let onStreamEndedCallback = null;
let autoRecoveryEnabled = true;
let recoveryAttempts = 0;
const MAX_RECOVERY_ATTEMPTS = 3;

/**
 * Get user-friendly error message based on error type and browser
 */
function getCameraErrorMessage(error) {
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isFirefox = /firefox/i.test(navigator.userAgent);
    const isSecureContext = window.isSecureContext;
    
    // Error type mapping
    const errorName = error.name || error.message || 'Unknown';
    
    if (errorName === 'NotAllowedError' || errorName.includes('Permission denied')) {
        if (isiOS || isSafari) {
            return {
                title: '🚫 Camera Access Denied',
                message: 'Safari/iOS detected. To enable camera:',
                steps: [
                    '1. Go to Settings → Safari → Camera',
                    '2. Change to "Ask" or "Allow"',
                    '3. Reload this page',
                    '4. Tap "Allow" when prompted'
                ],
                technical: 'NotAllowedError - User denied permission'
            };
        } else {
            return {
                title: '🚫 Camera Access Denied',
                message: 'Please allow camera access in your browser settings:',
                steps: [
                    '1. Click the camera icon in the address bar',
                    '2. Select "Allow"',
                    '3. Refresh this page'
                ],
                technical: 'NotAllowedError - User denied permission'
            };
        }
    }
    
    if (errorName === 'NotFoundError' || errorName.includes('not found')) {
        return {
            title: '📷 No Camera Detected',
            message: 'No camera was found on your device.',
            steps: [
                '• Check if your camera is connected',
                '• Try plugging in an external webcam',
                '• Restart your browser'
            ],
            technical: 'NotFoundError - No video input devices detected'
        };
    }
    
    if (errorName === 'NotReadableError' || errorName.includes('not readable')) {
        return {
            title: '⚠️ Camera In Use',
            message: 'Camera is already being used by another app.',
            steps: [
                '• Close other apps using the camera (Zoom, Skype, etc.)',
                '• Close other browser tabs with camera access',
                '• Restart your browser if the issue persists'
            ],
            technical: 'NotReadableError - Camera hardware in use'
        };
    }
    
    if (errorName === 'OverconstrainedError' || errorName.includes('constraint')) {
        if (isiOS) {
            return {
                title: '📱 Camera Constraints Not Supported',
                message: 'iOS detected - trying basic camera mode.',
                steps: [
                    '• Your device may not support the requested camera resolution',
                    '• Try switching to the other camera (front/back)',
                    '• Update iOS to the latest version'
                ],
                technical: 'OverconstrainedError - Requested constraints not satisfiable on iOS'
            };
        } else {
            return {
                title: '⚙️ Camera Settings Not Supported',
                message: 'Your camera doesn\'t support the requested settings.',
                steps: [
                    '• Try a different camera if available',
                    '• Update your browser to the latest version',
                    '• Check camera driver updates'
                ],
                technical: 'OverconstrainedError - Constraints not satisfiable'
            };
        }
    }
    
    if (errorName === 'SecurityError' || !isSecureContext) {
        return {
            title: '🔒 Insecure Connection',
            message: 'Camera access requires HTTPS or localhost.',
            steps: [
                '• Use HTTPS (https://...) instead of HTTP',
                '• Or use on localhost for testing',
                isiOS ? '• iOS requires HTTPS for all camera access' : '• Mobile browsers require HTTPS'
            ],
            technical: 'SecurityError - Camera requires secure context (HTTPS)'
        };
    }
    
    if (errorName === 'AbortError') {
        return {
            title: '⏸️ Camera Access Interrupted',
            message: 'Camera access was interrupted.',
            steps: [
                '• Another app may have taken control of the camera',
                '• Try refreshing the page',
                '• Check if camera permissions were revoked'
            ],
            technical: 'AbortError - Operation aborted'
        };
    }
    
    // Generic error
    return {
        title: '❌ Camera Error',
        message: 'An unexpected error occurred accessing the camera.',
        steps: [
            '• Refresh the page and try again',
            '• Check browser console for details',
            '• Try a different browser',
            isFirefox ? '• Firefox may require camera permissions in about:preferences' : ''
        ].filter(Boolean),
        technical: `${errorName}: ${error.message || 'No additional details'}`
    };
}

/**
 * Set callback for when camera stream ends (disconnection, permission revoked, etc)
 */
export function onStreamEnded(callback) {
    onStreamEndedCallback = callback;
}

/**
 * Enable or disable auto-recovery
 */
export function setAutoRecovery(enabled) {
    autoRecoveryEnabled = enabled;
}

/**
 * Attempt to recover lost camera stream with exponential backoff
 */
async function attemptAutoRecovery(preferFrontCamera = true) {
    if (!autoRecoveryEnabled || recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
        console.error('❌ Auto-recovery disabled or max attempts reached');
        return false;
    }
    
    recoveryAttempts++;
    const backoffDelay = Math.min(1000 * Math.pow(2, recoveryAttempts - 1), 8000); // 1s, 2s, 4s, 8s max
    
    console.log(`🔄 Attempting camera recovery (${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS}) in ${backoffDelay}ms...`);
    
    await new Promise(resolve => setTimeout(resolve, backoffDelay));
    
    try {
        const stream = await requestWebcamPermission(preferFrontCamera);
        console.log('✅ Camera stream recovered successfully');
        recoveryAttempts = 0; // Reset on success
        return true;
    } catch (error) {
        console.error(`❌ Recovery attempt ${recoveryAttempts} failed:`, error);
        if (recoveryAttempts < MAX_RECOVERY_ATTEMPTS) {
            return attemptAutoRecovery(preferFrontCamera);
        }
        return false;
    }
}

/**
 * Detect if running on mobile device
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints && navigator.maxTouchPoints > 2);
}

/**
 * Get optimal camera constraints based on device type
 */
function getCameraConstraints(preferFrontCamera = true) {
    const isMobile = isMobileDevice();
    
    if (isMobile) {
        // Mobile-specific constraints with fallbacks
        return {
            video: {
                facingMode: preferFrontCamera ? 'user' : 'environment',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
            },
            audio: false
        };
    } else {
        // Desktop constraints
        return {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            },
            audio: false
        };
    }
}

export async function requestWebcamPermission(preferFrontCamera = true) {
    try {
        // IMPORTANT: Camera access requires secure context (HTTPS or localhost)
        // Mobile browsers are especially strict about this - HTTP won't work
        // For testing on mobile: use ngrok, localtunnel, or self-signed cert
        
        // First attempt: optimal constraints
        let constraints = getCameraConstraints(preferFrontCamera);
        let stream;
        
        try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (primaryError) {
            console.warn('Primary camera request failed, trying fallback...', primaryError);
            
            // Fallback 1: Try with minimal constraints
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: preferFrontCamera ? 'user' : 'environment'
                    },
                    audio: false
                });
            } catch (fallbackError) {
                console.warn('Fallback with facingMode failed, trying basic...', fallbackError);
                
                // Fallback 2: Most basic constraints (works on almost any device)
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
        }

        // Monitor all tracks for disconnection/errors
        // (because users love unplugging cameras mid-session, apparently)
        stream.getTracks().forEach(track => {
            track.addEventListener('ended', async () => {
                console.warn('⚠️ Camera track ended (disconnected or permission revoked)');
                
                // Attempt auto-recovery
                const recovered = await attemptAutoRecovery(preferFrontCamera);
                
                if (!recovered && onStreamEndedCallback) {
                    onStreamEndedCallback('Camera disconnected and auto-recovery failed');
                } else if (recovered && onStreamEndedCallback) {
                    onStreamEndedCallback('Camera reconnected');
                }
            });
        });

        currentStream = stream;
        recoveryAttempts = 0; // Reset recovery counter on successful connection
        
        // Log camera info for debugging (especially useful on mobile)
        if (stream.getVideoTracks().length > 0) {
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('Camera initialized:', {
                facingMode: settings.facingMode || 'unknown',
                resolution: `${settings.width}x${settings.height}`,
                deviceId: settings.deviceId
            });
        }
        
        return stream;
    } catch (error) {
        console.error('Error requesting webcam permission:', error);
        
        // Get enhanced error message
        const errorInfo = getCameraErrorMessage(error);
        
        // Log detailed error info
        console.error('📋 Camera Error Details:', {
            title: errorInfo.title,
            message: errorInfo.message,
            steps: errorInfo.steps,
            technical: errorInfo.technical
        });
        
        // Throw enriched error with all details
        const enrichedError = new Error(errorInfo.message);
        enrichedError.errorInfo = errorInfo;
        throw enrichedError;
    }
}

export function getStream() {
    return currentStream;
}

export async function enumerateCameras() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        return videoDevices.map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.substring(0, 8)}`,
            groupId: device.groupId
        }));
    } catch (error) {
        console.error('Error enumerating cameras:', error);
        return [];
    }
}

export async function switchCamera(deviceId) {
    try {
        // Stop current stream
        stopStream();
        
        // Request new stream with specific deviceId
        const constraints = {
            video: {
                deviceId: { exact: deviceId },
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
            },
            audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        // Monitor track for disconnection
        stream.getTracks().forEach(track => {
            track.addEventListener('ended', () => {
                console.warn('Camera track ended (disconnected or permission revoked)');
                if (onStreamEndedCallback) {
                    onStreamEndedCallback('Camera disconnected or access was revoked');
                }
            });
        });
        
        currentStream = stream;
        
        // Log new camera info
        if (stream.getVideoTracks().length > 0) {
            const videoTrack = stream.getVideoTracks()[0];
            const settings = videoTrack.getSettings();
            console.log('Switched to camera:', {
                deviceId: settings.deviceId,
                resolution: `${settings.width}x${settings.height}`
            });
        }
        
        return stream;
    } catch (error) {
        console.error('Error switching camera:', error);
        throw new Error('Failed to switch camera: ' + error.message);
    }
}

export function stopStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

/**
 * Export camera error message generator for use in UI components
 */
export { getCameraErrorMessage };
