// @ts-check
/**
 * VLM (Vision Language Model) Service
 * Main orchestrator that coordinates all VLM-related modules:
 * - core-inference: Model loading and inference execution
 * - processing: Image processing and pre/post-processing
 * - telemetry: Performance monitoring and QoS
 * - plugins/qr-service: QR code detection
 */

import coreInference from './core-inference.js';
import imageProcessor from './processing.js';
import telemetryService from './telemetry.js';
import qrService from './plugins/qr-service.js';

class VLMService {
    constructor() {
        this.coreInference = coreInference;
        this.imageProcessor = imageProcessor;
        this.telemetry = telemetryService;
        this.qrService = qrService;
    }

    /**
     * Load model and processor
     * Delegates to core inference module
     */
    async loadModel(onProgress) {
        return this.coreInference.loadModel(onProgress);
    }

    /**
     * Perform warmup (can be called separately if needed)
     * Delegates to core inference module
     */
    async performWarmup() {
        return this.coreInference.performWarmup();
    }

    /**
     * Get inference lock status (for external visibility)
     */
    get inferenceLock() {
        return this.coreInference.inferenceLock;
    }

    /**
     * Run inference on video frame
     * Coordinates all modules to process frame and generate caption
     */
    async runInference(video, instruction, onTextUpdate) {
        // Acquire inference lock (prevents concurrent inference calls)
        if (!this.coreInference.acquireInferenceLock()) {
            return '';
        }

        const startTime = performance.now();

        try {
            performance.mark('vlm:inference-start');

            // Initialize QR service on first run
            if (!this.qrService.initialized) {
                await this.qrService.initialize();
            }

            // Step 1: Capture and process frame
            const performanceTier = this.coreInference.getPerformanceTier();
            const canvas = this.imageProcessor.captureFrame(video, performanceTier);

            // Step 2: Detect QR codes (if available)
            let qrContext = '';
            if (this.qrService.isAvailable()) {
                const qrUrl = await this.qrService.detectQRCode(canvas);
                if (qrUrl) {
                    qrContext = this.qrService.generateQRContext(qrUrl);
                }
            }

            // Step 3: Prepare processing inputs
            const messages = this.imageProcessor.prepareChatMessages(instruction, performanceTier, qrContext);
            const processor = this.coreInference.getProcessor();
            const prompt = this.imageProcessor.preparePrompt(
                processor.apply_chat_template.bind(processor),
                messages
            );

            // Step 4: Run model inference
            performance.mark('vlm:post-processing-start');
            const result = await this.coreInference.runModelGenerate(canvas, prompt, onTextUpdate, false);
            performance.mark('vlm:inference-end');

            // Step 5: Record telemetry
            const elapsedTime = performance.now() - startTime;
            this.telemetry.recordInferenceTime(elapsedTime);

            try {
                this.telemetry.measure('Total Inference', 'vlm:inference-start', 'vlm:inference-end');
                this.telemetry.measure('Image Processing', 'vlm:post-processing-start', 'vlm:model-execution-start');
            } catch(e) {}

            return result;
        } catch (error) {
            console.error('❌ Inference error:', error);
            throw error;
        } finally {
            this.coreInference.releaseInferenceLock();
        }
    }
    /**
     * Get dynamic frame delay based on current performance
     */
    getDynamicFrameDelay() {
        const performanceTier = this.coreInference.getPerformanceTier();
        return this.telemetry.getDynamicFrameDelay(performanceTier);
    }

    /**
     * Get model loaded state
     */
    getLoadedState() {
        const coreState = this.coreInference.getLoadedState();
        const telemetryData = this.telemetry.getTelemetrySummary();
        
        return {
            isLoaded: coreState.isLoaded,
            isLoading: coreState.isLoading,
            warmedUp: coreState.warmedUp,
            avgInferenceTime: telemetryData.avgInferenceTime,
            lastInferenceTime: telemetryData.lastInferenceTime,
            performanceTier: this.coreInference.getPerformanceTier()
        };
    }

    /**
     * Get telemetry summary
     */
    getTelemetrySummary() {
        return this.telemetry.getTelemetrySummary();
    }

    /**
     * Get estimated FPS
     */
    getEstimatedFPS() {
        const performanceTier = this.coreInference.getPerformanceTier();
        return this.telemetry.getEstimatedFPS(performanceTier);
    }

    /**
     * Get QR service status
     */
    getQRServiceStatus() {
        return this.qrService.getStatus();
    }
}

// Export singleton instance
const vlmService = new VLMService();
export default vlmService;
