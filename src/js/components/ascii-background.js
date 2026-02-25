/**
 * ASCII Background Component
 * Renders live camera feed as ASCII art (ultra-subtle, Apple style)
 */

export function createAsciiBackground(videoElement) {
    // Create canvas for processing (hidden)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    // Create pre element for ASCII output
    const pre = document.createElement('pre');
    pre.className = 'ascii-background';
    
    // ASCII character ramp (light to dark)
    // Using minimal set for cleaner look
    const chars = " .·:-=+*#@";
    
    let animationInterval = null;
    let isRunning = false;

    // Configuration
    const config = {
        cols: 130,              // ASCII columns (balance detail vs performance)
        fps: 10,                // Low FPS to save CPU (tried 30fps, CPU said no)
        aspectCorrection: 0.55  // Characters aren't square
    };

    function render() {
        if (!videoElement || videoElement.readyState < 2) {
            return;
        }

        try {
            // Calculate rows based on video aspect ratio
            const aspect = videoElement.videoHeight / videoElement.videoWidth;
            const rows = Math.floor(config.cols * aspect * config.aspectCorrection);

            // Resize canvas to ASCII resolution (very low res for performance)
            canvas.width = config.cols;
            canvas.height = rows;

            // Draw downscaled video frame
            ctx.drawImage(videoElement, 0, 0, config.cols, rows);

            // Get pixel data
            const { data } = ctx.getImageData(0, 0, config.cols, rows);

            // Convert pixels to ASCII
            let output = "";
            for (let y = 0; y < rows; y++) {
                const rowOffset = y * config.cols * 4;
                for (let x = 0; x < config.cols; x++) {
                    const i = rowOffset + x * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Calculate perceptual luminance (ITU-R BT.709)
                    // yes this exact formula matters, yes I tested simpler versions, no they don't look as good
                    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

                    // Map luminance to character index
                    const charIndex = Math.min(
                        chars.length - 1, 
                        Math.floor(luma * (chars.length - 1))
                    );

                    output += chars[charIndex];
                }
                output += "\n";
            }

            pre.textContent = output;
        } catch (err) {
            // Silently handle errors (e.g., video not ready)
            console.warn('ASCII render error:', err);
        }
    }

    // Public methods
    const component = {
        element: pre,
        
        start() {
            if (isRunning) return;
            isRunning = true;
            
            // Render at configured FPS (100ms = 10 FPS)
            animationInterval = setInterval(render, 1000 / config.fps);
        },

        stop() {
            if (!isRunning) return;
            isRunning = false;
            
            if (animationInterval) {
                clearInterval(animationInterval);
                animationInterval = null;
            }
            
            // Clear ASCII output
            pre.textContent = "";
        },

        cleanup() {
            this.stop();
        }
    };

    return component;
}
