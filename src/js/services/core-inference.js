/**
 * Core Inference Module
 * Handles pure model interaction, loading, and inference execution
 */

// @ts-ignore
import { AutoProcessor, AutoModelForImageTextToText, TextStreamer } from '@huggingface/transformers';
import { MODEL_CONFIG, QOS_PROFILES } from '../utils/constants.js';
import webgpuDetector from '../utils/webgpu-detector.js';

export class CoreInference {
    constructor() {
        this.processor = null;
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadPromise = null;
        this.inferenceLock = false;
        this.warmedUp = false;
        this.performanceTier = 'high'; // Default assumption until detected
    }

    /**
     * Load model and processor from Hugging Face
     * @param {Function} onProgress - Callback for progress updates
     */
    async loadModel(onProgress) {
        if (this.isLoaded) {
            onProgress?.('Model already loaded!');
            return;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.isLoading = true;
        const fileProgress = new Map();

        this.loadPromise = (async () => {
            try {
                performance.mark('vlm:model-load-start');
                onProgress?.('Detecting GPU capabilities...', 5);
                
                const gpuInfo = await webgpuDetector.detect();
                if (!gpuInfo.supported) {
                    throw new Error('WebGPU not supported on this device/browser');
                }

                const perfEstimate = webgpuDetector.getPerformanceEstimate();
                this.performanceTier = perfEstimate.tier;
                
                console.log(`⚡ Detected Hardware Tier: ${this.performanceTier.toUpperCase()} tier (${perfEstimate.expectedLatency})`);
                if (perfEstimate.recommendations.length > 0) {
                    console.log('💡 Recommendations:');
                    perfEstimate.recommendations.forEach(rec => console.log(`   ${rec}`));
                }

                onProgress?.('Loading processor...', 10);
                this.processor = await AutoProcessor.from_pretrained(MODEL_CONFIG.MODEL_ID);
                performance.mark('vlm:processor-loaded');

                onProgress?.('Processor loaded. Loading model...', 20);
                this.model = await AutoModelForImageTextToText.from_pretrained(MODEL_CONFIG.MODEL_ID, {
                    dtype: {
                        embed_tokens: 'fp16',
                        vision_encoder: 'q4',
                        decoder_model_merged: 'q4'
                    },
                    device: 'webgpu',
                    progress_callback: (data) => {
                        if (data.status === 'progress') {
                            const fileName = data.file || 'unknown';
                            const progress = data.progress || 0;

                            fileProgress.set(fileName, progress);
                            const progressValues = Array.from(fileProgress.values());
                            const avgProgress = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
                            const overallPercent = Math.round(avgProgress);

                            onProgress?.(`Downloading model files... (${fileProgress.size} files)`, 20 + (overallPercent * 0.6));
                        }
                    }
                });

                onProgress?.('Model loaded successfully!', 80);
                this.isLoaded = true;
                performance.mark('vlm:model-weights-loaded');

                onProgress?.('Warming up inference pipeline...', 85);
                await this.performWarmup();
                onProgress?.('Warmup complete!', 95);
                performance.mark('vlm:model-load-end');
                
                try {
                    performance.measure('Model Load Total', 'vlm:model-load-start', 'vlm:model-load-end');
                    performance.measure('Processor Load', 'vlm:model-load-start', 'vlm:processor-loaded');
                    performance.measure('Weights Download/Load', 'vlm:processor-loaded', 'vlm:model-weights-loaded');
                    
                    if (MODEL_CONFIG.DEBUG) {
                        const totalMatch = performance.getEntriesByName('Model Load Total').pop();
                        console.log(`⏱️ Total Model Load: ${(totalMatch.duration / 1000).toFixed(2)}s`);
                    }
                } catch(e) {}
            } catch (error) {
                console.error('Error loading model:', error);
                throw error;
            } finally {
                this.isLoading = false;
                this.loadPromise = null;
            }
        })();

        return this.loadPromise;
    }

    /**
     * Warm up the model with dummy inferences
     */
    async performWarmup() {
        if (this.warmedUp) return;

        try {
            console.log('🔥 Starting model warmup...');

            const warmupCanvas = document.createElement('canvas');
            warmupCanvas.width = 320;
            warmupCanvas.height = 240;
            const ctx = warmupCanvas.getContext('2d');
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, 320, 240);

            const dummyPrompt = 'Describe this.';

            for (let i = 0; i < 2; i++) {
                const startTime = performance.now();
                await this.runModelGenerate(warmupCanvas, dummyPrompt, null, true);
                const elapsed = performance.now() - startTime;
                console.log(`🔥 Warmup inference ${i + 1}/2 completed in ${(elapsed / 1000).toFixed(2)}s`);
            }

            this.warmedUp = true;
            console.log('✅ Warmup complete - inference pipeline stabilized');
        } catch (error) {
            console.warn('⚠️ Warmup failed (non-critical):', error);
        }
    }

    /**
     * Run model generation with streaming
     * @param {HTMLCanvasElement} canvas - Canvas with processed image
     * @param {string} prompt - Prepared prompt string
     * @param {Function} onTextUpdate - Streaming callback
     * @param {boolean} isWarmup - Whether this is a warmup inference
     * @returns {Promise<string>} Generated text
     */
    async runModelGenerate(canvas, prompt, onTextUpdate, isWarmup = false) {
        if (!this.model || !this.processor) {
            throw new Error('Model/processor not loaded');
        }

        const { RawImage } = await import('@huggingface/transformers');
        const frame = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        
        const rawImage = new RawImage(frame.data, frame.width, frame.height, 4);

        const inputs = await this.processor(rawImage, prompt, {
            add_special_tokens: false
        });

        if (MODEL_CONFIG.DEBUG) console.log('🤖 Running model inference...');
        
        const currentProfile = QOS_PROFILES[this.performanceTier] || QOS_PROFILES.high;
        const maxTokens = currentProfile.MAX_NEW_TOKENS;

        let streamed = '';
        let tokenCount = 0;
        
        const streamer = new TextStreamer(this.processor.tokenizer, {
            skip_prompt: true,
            skip_special_tokens: true,
            callback_function: (token) => {
                streamed += token;
                tokenCount++;
                if (MODEL_CONFIG.DEBUG && tokenCount % 5 === 0) {
                    console.log(`📤 Streaming... (${tokenCount} tokens)`);
                }
                onTextUpdate?.(streamed.trim());
            }
        });

        performance.mark('vlm:model-execution-start');

        const outputs = await this.model.generate({
            ...inputs,
            max_new_tokens: maxTokens,
            do_sample: false,
            streamer,
            repetition_penalty: 1.2
        });

        performance.mark('vlm:model-execution-end');

        if (MODEL_CONFIG.DEBUG && !isWarmup) {
            console.log(`✅ Model output generated (${maxTokens} max tokens)`);
            try {
                performance.measure('Model Execution', 'vlm:model-execution-start', 'vlm:model-execution-end');
            } catch(e) {}
        }

        const finalText = streamed.trim() || this.processor.batch_decode(
            outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
            { skip_special_tokens: true }
        )[0].trim();

        if (MODEL_CONFIG.DEBUG && !isWarmup) console.log('💬 Final caption:', finalText);

        return finalText;
    }

    /**
     * Acquire inference lock (prevents concurrent inference)
     * @returns {boolean} True if lock acquired, false if already locked
     */
    acquireInferenceLock() {
        if (this.inferenceLock) {
            if (MODEL_CONFIG.DEBUG) console.warn('⚠️ Inference already running, skipping frame');
            return false;
        }
        this.inferenceLock = true;
        if (MODEL_CONFIG.DEBUG) console.log('🔒 Inference lock acquired');
        return true;
    }

    /**
     * Release inference lock
     * @param {boolean} hadError - Whether error occurred during inference
     */
    releaseInferenceLock(hadError = false) {
        this.inferenceLock = false;
        if (MODEL_CONFIG.DEBUG) {
            const msg = hadError ? 'error' : 'success';
            console.log(`🔓 Inference lock released (${msg})`);
        }
    }

    /**
     * Get model loading state
     */
    getLoadedState() {
        return {
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            warmedUp: this.warmedUp
        };
    }

    /**
     * Get current performance tier
     */
    getPerformanceTier() {
        return this.performanceTier;
    }

    /**
     * Get processor for external use
     */
    getProcessor() {
        return this.processor;
    }

    /**
     * Get model for external use
     */
    getModel() {
        return this.model;
    }
}

export default new CoreInference();
