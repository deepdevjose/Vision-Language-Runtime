/**
 * ASCII Background Component
 * Renders live camera feed as ASCII art (ultra-subtle, Apple style)
 * Uses requestAnimationFrame with frame-rate throttling for smooth, efficient rendering.
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

    let rafId = null;
    let isRunning = false;
    let lastFrameTime = 0;

    // Configuration
    const config = {
        cols: 130,              // ASCII columns (balance detail vs performance)
        fps: 10,                // Target FPS (throttled via rAF)
        aspectCorrection: 0.55  // Characters aren't square
    };
    
    // Persistent buffer array to reduce GC allocations map -> join
    let outputBuffer = [];

    const frameInterval = 1000 / config.fps;

    function render(timestamp) {
        if (!isRunning) return;

        // Throttle to target FPS
        const elapsed = timestamp - lastFrameTime;
        if (elapsed < frameInterval) {
            rafId = requestAnimationFrame(render);
            return;
        }
        lastFrameTime = timestamp - (elapsed % frameInterval);

        if (!videoElement || videoElement.readyState < 2) {
            rafId = requestAnimationFrame(render);
            return;
        }

        try {
            // Calculate rows based on video aspect ratio
            const aspect = videoElement.videoHeight / videoElement.videoWidth;
            const rows = Math.floor(config.cols * aspect * config.aspectCorrection);

            // Resize canvas to ASCII resolution (very low res for performance)
            if (canvas.width !== config.cols || canvas.height !== rows) {
                canvas.width = config.cols;
                canvas.height = rows;
                // Pre-allocate buffer length cleanly
                outputBuffer = new Array(rows);
            }

            // Draw downscaled video frame
            ctx.drawImage(videoElement, 0, 0, config.cols, rows);

            // Get pixel data
            const { data } = ctx.getImageData(0, 0, config.cols, rows);

            // Convert pixels to ASCII
            for (let y = 0; y < rows; y++) {
                let rowChars = "";
                const rowOffset = y * config.cols * 4;
                for (let x = 0; x < config.cols; x++) {
                    const i = rowOffset + x * 4;
                    const r = data[i];
                    const g = data[i + 1];
                    const b = data[i + 2];

                    // Calculate perceptual luminance (ITU-R BT.709)
                    const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

                    // Map luminance to character index
                    const charIndex = Math.min(
                        chars.length - 1,
                        Math.floor(luma * (chars.length - 1))
                    );

                    rowChars += chars[charIndex];
                }
                outputBuffer[y] = rowChars;
            }

            pre.textContent = outputBuffer.join("\n");
        } catch (err) {
            // Silently handle errors (e.g., video not ready)
            console.warn('ASCII render error:', err);
        }

        rafId = requestAnimationFrame(render);
    }

    // Public methods
    const component = {
        element: pre,

        start() {
            if (isRunning) return;
            isRunning = true;
            lastFrameTime = 0;

            rafId = requestAnimationFrame(render);
        },

        stop() {
            if (!isRunning) return;
            isRunning = false;

            if (rafId !== null) {
                cancelAnimationFrame(rafId);
                rafId = null;
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
