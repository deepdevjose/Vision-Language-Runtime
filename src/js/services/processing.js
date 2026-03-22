/**
 * Processing Module
 * Handles image pre-processing, post-processing, and prompt preparation
 */

// @ts-ignore
import { RawImage } from '@huggingface/transformers';
import { MODEL_CONFIG, QOS_PROFILES } from '../utils/constants.js';

export class ImageProcessor {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.cachedRawImage = null;
    }

    /**
     * Initialize canvas for image processing
     */
    initializeCanvas() {
        if (!this.canvas) {
            this.canvas = document.createElement('canvas');
            this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        }
    }

    /**
     * Capture and downscale video frame to canvas
     * @param {HTMLVideoElement|HTMLCanvasElement} video - Video or canvas element
     * @param {string} performanceTier - Current hardware performance tier
     * @returns {HTMLCanvasElement} Canvas with processed frame
     */
    captureFrame(video, performanceTier) {
        this.initializeCanvas();

        const videoWidth = video.videoWidth || video.width || 320;
        const videoHeight = video.videoHeight || video.height || 240;
        
        const currentProfile = QOS_PROFILES[performanceTier] || QOS_PROFILES.high;
        const maxSize = currentProfile.MAX_INFERENCE_SIZE;

        let canvasWidth, canvasHeight;
        
        // Maintain aspect ratio while constraining to max size
        if (videoWidth > videoHeight) {
            if (videoWidth > maxSize) {
                canvasWidth = maxSize;
                canvasHeight = Math.round((videoHeight / videoWidth) * maxSize);
            } else {
                canvasWidth = videoWidth;
                canvasHeight = videoHeight;
            }
        } else {
            if (videoHeight > maxSize) {
                canvasHeight = maxSize;
                canvasWidth = Math.round((videoWidth / videoHeight) * maxSize);
            } else {
                canvasWidth = videoWidth;
                canvasHeight = videoHeight;
            }
        }

        // Resize canvas only if needed
        if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
            this.canvas.width = canvasWidth;
            this.canvas.height = canvasHeight;
            this.cachedRawImage = null; // Invalidate cache on resize
            if (MODEL_CONFIG.DEBUG) {
                console.log(`📐 Canvas resized to ${canvasWidth}x${canvasHeight} (from ${videoWidth}x${videoHeight})`);
            }
        }

        if (!this.ctx) {
            throw new Error('Could not get canvas context');
        }

        // Draw current video frame to canvas (downscaled)
        this.ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
        
        if (MODEL_CONFIG.DEBUG) console.log('📸 Captured frame:', canvasWidth, 'x', canvasHeight);

        return this.canvas;
    }

    /**
     * Extract image data and create optimized RawImage object
     * @param {HTMLCanvasElement} canvas - Canvas with image data
     * @returns {RawImage} Optimized raw image object
     */
    getRawImage(canvas) {
        if (!this.ctx) {
            throw new Error('Canvas context not initialized');
        }
        
        const frame = this.ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Reuse RawImage buffer to minimize GC pressure
        const expectedSize = frame.width * frame.height * 4;
        const canReuseRawImage = !!this.cachedRawImage
            && this.cachedRawImage.width === frame.width
            && this.cachedRawImage.height === frame.height
            && this.cachedRawImage.data?.length === expectedSize;

        if (!canReuseRawImage) {
            this.cachedRawImage = new RawImage(frame.data, frame.width, frame.height, 4);
        } else {
            // Update the underlying array instead of instantiating a new object
            this.cachedRawImage.data.set(frame.data);
        }

        return this.cachedRawImage;
    }

    /**
     * Prepare chat messages with system prompt and user instruction
     * @param {string} instruction - User instruction/prompt
     * @param {string} performanceTier - Hardware performance tier for profile selection
     * @param {string} qrContext - Optional QR code context to append
     * @returns {Array} Formatted messages array
     */
    prepareChatMessages(instruction, performanceTier, qrContext = '') {
        const currentProfile = QOS_PROFILES[performanceTier] || QOS_PROFILES.high;
        let systemPrompt = currentProfile.SYSTEM_PROMPT;

        // Append QR context if found
        if (qrContext) {
            systemPrompt += qrContext;
        }

        return [
            {
                role: 'system',
                content: systemPrompt
            },
            { role: 'user', content: `<image>${instruction}` }
        ];
    }

    /**
     * Prepare the final prompt string from messages
     * @param {Function} applyTemplate - Processor's apply_chat_template function
     * @param {Array} messages - Chat messages
     * @returns {string} Formatted prompt string
     */
    preparePrompt(applyTemplate, messages) {
        const prompt = applyTemplate(messages, {
            add_generation_prompt: true
        });

        if (MODEL_CONFIG.DEBUG) console.log('📝 Processing inputs...');
        return prompt;
    }

    /**
     * Clear cached resources
     */
    clear() {
        this.cachedRawImage = null;
        if (this.canvas) {
            this.canvas.width = 0;
            this.canvas.height = 0;
        }
    }

    /**
     * Get canvas dimensions
     * @returns {Object} Canvas width and height
     */
    getCanvasDimensions() {
        if (!this.canvas) {
            return { width: 0, height: 0 };
        }
        return {
            width: this.canvas.width,
            height: this.canvas.height
        };
    }
}

export default new ImageProcessor();
