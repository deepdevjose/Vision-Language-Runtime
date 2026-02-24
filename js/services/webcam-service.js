/**
 * Webcam service for managing camera stream
 * Mobile-optimized with fallback constraints
 */

let currentStream = null;
let onStreamEndedCallback = null;

/**
 * Set callback for when camera stream ends (disconnection, permission revoked, etc)
 */
export function onStreamEnded(callback) {
    onStreamEndedCallback = callback;
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
            track.addEventListener('ended', () => {
                console.warn('Camera track ended (disconnected or permission revoked)');
                if (onStreamEndedCallback) {
                    onStreamEndedCallback('Camera disconnected or access was revoked');
                }
            });
        });

        currentStream = stream;
        
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
        
        // Enhanced error messages for mobile debugging
        let errorMessage = 'Failed to access camera: ';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied. Please grant permission in your browser settings and reload the page.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found. Please ensure your device has a camera and try again.';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is already in use by another application. Please close other apps using the camera.';
        } else if (error.name === 'OverconstrainedError') {
            errorMessage = 'Camera constraints not supported. Your device camera may not meet the requirements.';
        } else if (error.name === 'SecurityError') {
            errorMessage = 'Camera access blocked due to security policy. Make sure you are using HTTPS or localhost.';
        } else {
            errorMessage += error.message;
        }
        
        throw new Error(errorMessage);
    }
}

export function getStream() {
    return currentStream;
}

export function stopStream() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}
