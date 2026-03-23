/**
 * Core Inference Module
 * Handles pure model interaction, loading, and inference execution
 */

// @ts-ignore
import {
    AutoProcessor,
    AutoModelForImageTextToText,
    RawImage,
    TextStreamer,
    env,
} from '@huggingface/transformers';
import { MODEL_CONFIG, QOS_PROFILES } from '../utils/constants.js';
import webgpuDetector from '../utils/webgpu-detector.js';

/** Timeout (ms) for model/processor downloads. */
const MODEL_LOAD_TIMEOUT_MS = 120_000;

/** Per-tier timeout (ms) for a single `model.generate()` call. (Currently unused to prevent WebGPU deadlock during shader compilation) */
const INFERENCE_TIMEOUT_MS = { high: 30_000, medium: 45_000, low: 60_000 };

/**
 * Race a promise against a timeout.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} label
 * @returns {Promise<T>}
 */
function withTimeout(promise, ms, label) {
    return Promise.race([
        promise,
        new Promise((_resolve, reject) =>
            setTimeout(
                () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
                ms
            )
        ),
    ]);
}

export class CoreInference {
    constructor() {
        this.processor = null;
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadPromise = null;
        this.inferenceLock = false;
        this.warmedUp = false;
        this.shadersReady = false; // true only after first successful generate()
        this.performanceTier = 'high'; // Default assumption until detected
        this.recoveryPromise = null;
    }

    /**
     * Determine whether an error indicates WebGPU device loss.
     * @param {unknown} error
     * @returns {boolean}
     */
    isDeviceLostError(error) {
        const text = String(error?.message || error || '').toLowerCase();
        return (
            text.includes('device is lost') ||
            text.includes('gpu device lost') ||
            text.includes('mapasync') ||
            text.includes('aborterror')
        );
    }

    /**
     * Wrap low-level errors into a stable runtime error.
     * @param {unknown} error
     * @returns {Error & {code?: string}}
     */
    normalizeInferenceError(error) {
        if (this.isDeviceLostError(error)) {
            const wrapped = /** @type {Error & {code?: string}} */ (
                new Error('WebGPU device was lost during inference')
            );
            wrapped.code = 'WEBGPU_DEVICE_LOST';
            return wrapped;
        }

        const passthrough = /** @type {Error & {code?: string}} */ (
            error instanceof Error ? error : new Error(String(error || 'Unknown inference error'))
        );
        return passthrough;
    }

    /**
     * Reset runtime fields so model can be cleanly reloaded after device loss.
     */
    resetForRecovery() {
        this.processor = null;
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadPromise = null;
        this.inferenceLock = false;
        this.warmedUp = false;
        this.shadersReady = false;
    }

    /**
     * Attempt one full model pipeline recovery after GPU device loss.
     * @param {Function} [onProgress]
     */
    async recoverFromDeviceLoss(onProgress) {
        if (this.recoveryPromise) {
            return this.recoveryPromise;
        }

        this.recoveryPromise = (async () => {
            // First recovery pass: clean reset + lighter startup path.
            this.resetForRecovery();
            webgpuDetector.reset();
            this.performanceTier = 'low';

            try {
                await this.loadModel(onProgress);
            } catch (firstError) {
                // Second and last pass with a fully fresh detector/device attempt.
                this.resetForRecovery();
                webgpuDetector.reset();
                await new Promise((resolve) => setTimeout(resolve, 350));
                await this.loadModel(onProgress);
            }
        })();

        try {
            await this.recoveryPromise;
        } finally {
            this.recoveryPromise = null;
        }
    }

    /**
     * Load model and processor from Hugging Face
     * @param {Function} onProgress - Callback for progress updates
     */
    async loadModel(onProgress, options = {}) {
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

                // Enable browser cache for model files
                env.useBrowserCache = true;

                onProgress?.('Detecting GPU & loading processor...', 5);

                // Parallelize GPU detection and processor loading
                const [gpuInfo, processor] = await Promise.all([
                    withTimeout(
                        webgpuDetector.detect(),
                        MODEL_LOAD_TIMEOUT_MS,
                        'GPU detection'
                    ),
                    withTimeout(
                        AutoProcessor.from_pretrained(MODEL_CONFIG.MODEL_ID),
                        MODEL_LOAD_TIMEOUT_MS,
                        'Processor download'
                    ),
                ]);

                if (!gpuInfo.supported) {
                    throw new Error('WebGPU not supported on this device/browser');
                }

                this.processor = processor;
                performance.mark('vlm:processor-loaded');

                const perfEstimate = webgpuDetector.getPerformanceEstimate();
                this.performanceTier = perfEstimate.tier;

                console.log(
                    `⚡ Detected Hardware Tier: ${this.performanceTier.toUpperCase()} tier (${perfEstimate.expectedLatency})`
                );
                if (perfEstimate.recommendations.length > 0) {
                    console.log('💡 Recommendations:');
                    perfEstimate.recommendations.forEach((rec) => console.log(`   ${rec}`));
                }

                onProgress?.('Processor loaded. Loading model...', 10);

                // Timeout on model download
                this.model = await withTimeout(
                    AutoModelForImageTextToText.from_pretrained(
                        MODEL_CONFIG.MODEL_ID,
                        {
                            dtype: {
                                embed_tokens: 'fp16',
                                vision_encoder: 'q4',
                                decoder_model_merged: 'q4',
                            },
                            device: 'webgpu',
                            // Weighted progress by bytes downloaded
                            progress_callback: (data) => {
                                if (data.status === 'progress') {
                                    const fileName = data.file || 'unknown';
                                    const loaded = data.loaded || 0;
                                    const total = data.total || 1;

                                    fileProgress.set(fileName, { loaded, total });

                                    let sumLoaded = 0;
                                    let sumTotal = 0;
                                    for (const v of fileProgress.values()) {
                                        sumLoaded += v.loaded;
                                        sumTotal += v.total;
                                    }
                                    const overallPercent =
                                        sumTotal > 0
                                            ? Math.round((sumLoaded / sumTotal) * 100)
                                            : 0;

                                    // Emit raw 0–100; loading-screen maps to UI range
                                    onProgress?.(
                                        `Downloading model files... (${fileProgress.size} files)`,
                                        overallPercent
                                    );
                                }
                            },
                        }
                    ),
                    MODEL_LOAD_TIMEOUT_MS,
                    'Model download'
                );

                onProgress?.('Model loaded successfully!', 80);
                this.isLoaded = true;
                performance.mark('vlm:model-weights-loaded');

                if (options.skipWarmup) {
                    onProgress?.('Skipping warmup for fast recovery...', 92);
                    this.warmedUp = false;
                } else {
                    onProgress?.('Warming up inference pipeline...', 85);
                    await this.performWarmup();
                    onProgress?.('Warmup complete!', 95);
                }

                onProgress?.('Ready!', 95);
                performance.mark('vlm:model-load-end');

                try {
                    performance.measure(
                        'Model Load Total',
                        'vlm:model-load-start',
                        'vlm:model-load-end'
                    );
                    performance.measure(
                        'Processor Load',
                        'vlm:model-load-start',
                        'vlm:processor-loaded'
                    );
                    performance.measure(
                        'Weights Download/Load',
                        'vlm:processor-loaded',
                        'vlm:model-weights-loaded'
                    );

                    if (MODEL_CONFIG.DEBUG) {
                        const totalMatch = performance.getEntriesByName('Model Load Total').pop();
                        console.log(
                            `⏱️ Total Model Load: ${(totalMatch.duration / 1000).toFixed(2)}s`
                        );
                    }
                } catch (e) {}
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
            const WARMUP_KEY = 'vlm:warmup-done';
            console.log('🔥 Starting model warmup (1 run, max_tokens=1)...');

            // Plain canvas — OffscreenCanvas can cause RawImage buffer issues
            const warmupCanvas = document.createElement('canvas');
            warmupCanvas.width = 224;
            warmupCanvas.height = 224;
            const ctx = warmupCanvas.getContext('2d');
            ctx.fillStyle = '#808080';
            ctx.fillRect(0, 0, 224, 224);

            const currentProfile = QOS_PROFILES[this.performanceTier] || QOS_PROFILES.high;
            const warmupMessages = [
                { role: 'system', content: currentProfile.SYSTEM_PROMPT },
                { role: 'user', content: '<image>Describe this image briefly.' },
            ];
            const warmupPrompt = this.processor.apply_chat_template(warmupMessages, {
                add_generation_prompt: true,
            });

            const startTime = performance.now();
            // Pass maxTokens=1 — just enough to trigger shader compilation
            await this.runModelGenerate(warmupCanvas, warmupPrompt, null, true, 1);
            const elapsed = performance.now() - startTime;
            console.log(`🔥 Warmup completed in ${(elapsed / 1000).toFixed(2)}s`);

            this.warmedUp = true;
            this.shadersReady = true;
            try { sessionStorage.setItem(WARMUP_KEY, '1'); } catch {}
            console.log('✅ Warmup complete — shaders compiled, pipeline ready');
        } catch (error) {
            // Warmup timed out — the GPU is still compiling shaders in background.
            // Mark warmedUp so we don't loop, but shadersReady stays false so
            // real inference uses a longer timeout until shaders are confirmed ready.
            this.warmedUp = true;
            try { sessionStorage.setItem('vlm:warmup-done', '1'); } catch {}
            console.warn('⚠️ Warmup timed out — shaders still compiling. First inference will use extended timeout.');
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
    async runModelGenerate(canvas, prompt, onTextUpdate, isWarmup = false, warmupMaxTokens = null) {
        if (!this.model || !this.processor) {
            throw new Error('Model/processor not loaded');
        }

        try {
            const t0 = performance.now();
            // Fix 8: RawImage imported statically at top of file

            const getImageDataStart = performance.now();
            const frame = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
            const getImageDataMs = performance.now() - getImageDataStart;

            const rawImage = new RawImage(frame.data, frame.width, frame.height, 4);

            const preprocessStart = performance.now();
            const inputs = await this.processor(rawImage, prompt, {
                add_special_tokens: false,
            });
            const preprocessMs = performance.now() - preprocessStart;

            if (MODEL_CONFIG.DEBUG) console.log('🤖 Running model inference...');
            if (MODEL_CONFIG.DEBUG) {
                console.log(`🔍 Inference input: image=${frame.width}x${frame.height}, tier=${this.performanceTier}, isWarmup=${isWarmup}`);
            }

            const currentProfile = QOS_PROFILES[this.performanceTier] || QOS_PROFILES.high;
            const maxTokens = warmupMaxTokens ?? currentProfile.MAX_NEW_TOKENS;

            let streamed = '';
            let tokenCount = 0;
            let firstTokenAt = 0;
            const STREAM_UPDATE_EVERY_N_TOKENS = 5;

            // Skip streamer on warmup — no output needed, reduces overhead
            const streamer = isWarmup ? undefined : new TextStreamer(this.processor.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (token) => {
                    streamed += token;
                    tokenCount++;
                    if (tokenCount === 1) {
                        firstTokenAt = performance.now();
                        console.log(`🟢 First token received at ${((firstTokenAt - t0) / 1000).toFixed(2)}s`);
                    }
                    if (MODEL_CONFIG.DEBUG && tokenCount % 5 === 0) {
                        console.log(`📤 Streaming... (${tokenCount} tokens)`);
                    }
                    // Avoid reflow on every token; batch UI updates.
                    if (tokenCount % STREAM_UPDATE_EVERY_N_TOKENS === 0) {
                        onTextUpdate?.(streamed.trim());
                    }
                },
            });

            performance.mark('vlm:model-execution-start');

            // 🚨 CRITICAL FIX: Removed withTimeout() wrapper here!
            // First-run shader compilation can take 60s-120s+ on mobile/low-end GPUs.
            // If we throw a timeout error in JS, the WebGPU driver is STILL compiling in the background.
            // When the UI loop retries, we send a *second* generate() request, permanently locking the GPU.
            // We MUST let model.generate() resolve naturally to maintain pipeline integrity.
            console.log(`⏳ model.generate() starting (maxTokens=${maxTokens}, warmedUp=${this.warmedUp}). First run may take 1-2 minutes for shader compilation...`);
            const generateStart = performance.now();
            const outputs = await this.model.generate({
                ...inputs,
                max_new_tokens: maxTokens,
                do_sample: false,
                ...(streamer ? { streamer } : {}),
                repetition_penalty: 1.2,
            });
            console.log(`✅ model.generate() resolved in ${((performance.now() - generateStart) / 1000).toFixed(2)}s (${tokenCount} tokens)`);
            this.shadersReady = true; // Shaders confirmed compiled after first successful generate

            performance.mark('vlm:model-execution-end');

            if (MODEL_CONFIG.DEBUG && !isWarmup) {
                console.log(`✅ Model output generated (${maxTokens} max tokens)`);
                try {
                    performance.measure(
                        'Model Execution',
                        'vlm:model-execution-start',
                        'vlm:model-execution-end'
                    );
                } catch (e) {}
            }

            const finalText =
                streamed.trim() ||
                this.processor
                    .batch_decode(outputs.slice(null, [inputs.input_ids.dims.at(-1), null]), {
                        skip_special_tokens: true,
                    })[0]
                    .trim();

            // Ensure the UI receives the final buffered text.
            if (streamed.trim()) {
                onTextUpdate?.(streamed.trim());
            }

            if (MODEL_CONFIG.DEBUG && !isWarmup) console.log('💬 Final caption:', finalText);

            if (MODEL_CONFIG.DEBUG && !isWarmup) {
                const totalMs = performance.now() - t0;
                const postGenerateMs = totalMs - getImageDataMs - preprocessMs;
                console.log(
                    `⏱️ Inference stages | getImageData=${getImageDataMs.toFixed(1)}ms | preprocess=${preprocessMs.toFixed(1)}ms | generate+decode=${postGenerateMs.toFixed(1)}ms | total=${totalMs.toFixed(1)}ms`
                );
            }

            return finalText;
        } catch (error) {
            const normalizedError = this.normalizeInferenceError(error);
            if (normalizedError.code === 'WEBGPU_DEVICE_LOST') {
                console.error('🔌 WebGPU device lost during inference');
            }
            throw normalizedError;
        }
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
            warmedUp: this.warmedUp,
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
