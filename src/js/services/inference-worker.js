/**
 * Inference Web Worker
 * Runs the full CoreInference pipeline off the main thread so the UI
 * stays responsive during model loading and inference.
 *
 * Fix 7 — Move inference to a Web Worker
 *
 * Communication protocol (postMessage):
 *
 *   Main → Worker:
 *     { type: 'load',    options? }           — Load model
 *     { type: 'warmup' }                      — Run warmup inference
 *     { type: 'infer',   imageData, prompt, performanceTier, isWarmup? }
 *     { type: 'recover' }                     — Recover from GPU loss
 *     { type: 'getState' }                    — Query loaded state
 *
 *   Worker → Main:
 *     { type: 'progress',    message, percent }
 *     { type: 'loaded' }
 *     { type: 'warmedUp' }
 *     { type: 'token',       text }           — Streaming token update
 *     { type: 'result',      text }           — Final inference result
 *     { type: 'state',       state }          — Loaded state response
 *     { type: 'recovered' }
 *     { type: 'error',       message, code? }
 */

// @ts-ignore — importmap is inherited from the page when using module workers
import {
    AutoProcessor,
    AutoModelForImageTextToText,
    RawImage,
    TextStreamer,
    env,
} from '@huggingface/transformers';

// ── Constants (duplicated from constants.js to keep worker self-contained) ──

const MODEL_ID = 'onnx-community/FastVLM-0.5B-ONNX';
const MODEL_LOAD_TIMEOUT_MS = 120_000;

const QOS_PROFILES = {
    low: {
        MAX_NEW_TOKENS: 32,
        SYSTEM_PROMPT:
            'You are a visual AI. Answer in ONE short sentence (8-14 words). No lists, no explanations, no step-by-step. Just the answer.',
    },
    medium: {
        MAX_NEW_TOKENS: 64,
        SYSTEM_PROMPT: 'You are a visual AI. Answer concisely (maximum 2 sentences).',
    },
    high: {
        MAX_NEW_TOKENS: 128,
        SYSTEM_PROMPT:
            "You are a helpful visual AI assistant. Respond concisely and accurately to the user's query in one sentence.",
    },
};

// ── Helpers ─────────────────────────────────────────────────────

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

function post(msg) {
    self.postMessage(msg);
}

// ── Worker state ────────────────────────────────────────────────

let processor = null;
let model = null;
let isLoaded = false;
let isLoading = false;
let warmedUp = false;
let performanceTier = 'high';

// ── Load model ──────────────────────────────────────────────────

async function loadModel(options = {}) {
    if (isLoaded) {
        post({ type: 'progress', message: 'Model already loaded!', percent: 100 });
        post({ type: 'loaded' });
        return;
    }
    if (isLoading) return;
    isLoading = true;

    const fileProgress = new Map();

    try {
        env.useBrowserCache = true;

        post({ type: 'progress', message: 'Loading processor...', percent: 5 });

        processor = await withTimeout(
            AutoProcessor.from_pretrained(MODEL_ID),
            MODEL_LOAD_TIMEOUT_MS,
            'Processor download'
        );

        post({ type: 'progress', message: 'Processor loaded. Loading model...', percent: 10 });

        model = await withTimeout(
            AutoModelForImageTextToText.from_pretrained(MODEL_ID, {
                dtype: {
                    embed_tokens: 'fp16',
                    vision_encoder: 'q4',
                    decoder_model_merged: 'q4',
                },
                device: 'webgpu',
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
                        const percent =
                            sumTotal > 0 ? Math.round((sumLoaded / sumTotal) * 100) : 0;

                        post({
                            type: 'progress',
                            message: `Downloading model files... (${fileProgress.size} files)`,
                            percent,
                        });
                    }
                },
            }),
            MODEL_LOAD_TIMEOUT_MS,
            'Model download'
        );

        isLoaded = true;
        post({ type: 'progress', message: 'Model loaded!', percent: 100 });

        if (!options.skipWarmup) {
            await doWarmup();
        }

        post({ type: 'loaded' });
    } catch (error) {
        post({ type: 'error', message: error.message, code: 'MODEL_LOAD_FAILED' });
    } finally {
        isLoading = false;
    }
}

// ── Warmup ──────────────────────────────────────────────────────

async function doWarmup() {
    if (warmedUp) {
        post({ type: 'warmedUp' });
        return;
    }

    try {
        const WARMUP_KEY = 'vlm:warmup-done';
        // Workers don't have sessionStorage; we rely on a message from main if needed.
        // Default to 2 runs for safety.
        const warmupRuns = 2;

        const canvas = new OffscreenCanvas(320, 240);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, 320, 240);

        const profile = QOS_PROFILES[performanceTier] || QOS_PROFILES.high;
        const messages = [
            { role: 'system', content: profile.SYSTEM_PROMPT },
            { role: 'user', content: '<image>Describe this image briefly.' },
        ];
        const prompt = processor.apply_chat_template(messages, {
            add_generation_prompt: true,
        });

        for (let i = 0; i < warmupRuns; i++) {
            await runInference(canvas, prompt, null, true);
            console.log(`🔥 Worker warmup ${i + 1}/${warmupRuns} done`);
        }

        warmedUp = true;
        post({ type: 'warmedUp' });
    } catch (error) {
        console.warn('⚠️ Worker warmup failed (non-critical):', error);
        post({ type: 'warmedUp' }); // non-blocking
    }
}

// ── Inference ───────────────────────────────────────────────────

async function runInference(canvasOrImageData, prompt, _unused, isWarmup = false) {
    if (!model || !processor) {
        throw new Error('Model/processor not loaded');
    }

    // Accept either OffscreenCanvas or plain ImageData
    let imageData;
    if (canvasOrImageData instanceof OffscreenCanvas) {
        const ctx = canvasOrImageData.getContext('2d');
        imageData = ctx.getImageData(
            0,
            0,
            canvasOrImageData.width,
            canvasOrImageData.height
        );
    } else {
        imageData = canvasOrImageData;
    }

    const rawImage = new RawImage(
        imageData.data,
        imageData.width,
        imageData.height,
        4
    );

    const inputs = await processor(rawImage, prompt, {
        add_special_tokens: false,
    });

    const profile = QOS_PROFILES[performanceTier] || QOS_PROFILES.high;
    const maxTokens = profile.MAX_NEW_TOKENS;

    let streamed = '';
    let tokenCount = 0;
    const STREAM_UPDATE_EVERY_N_TOKENS = 5;

    const streamer = new TextStreamer(processor.tokenizer, {
        skip_prompt: true,
        skip_special_tokens: true,
        callback_function: (token) => {
            streamed += token;
            tokenCount++;
            if (tokenCount % STREAM_UPDATE_EVERY_N_TOKENS === 0 && !isWarmup) {
                post({ type: 'token', text: streamed.trim() });
            }
        },
    });

    const outputs = await model.generate({
        ...inputs,
        max_new_tokens: maxTokens,
        do_sample: false,
        streamer,
        repetition_penalty: 1.2,
    });

    const finalText =
        streamed.trim() ||
        processor
            .batch_decode(outputs.slice(null, [inputs.input_ids.dims.at(-1), null]), {
                skip_special_tokens: true,
            })[0]
            .trim();

    return finalText;
}

// ── Recovery ────────────────────────────────────────────────────

async function recoverFromDeviceLoss() {
    processor = null;
    model = null;
    isLoaded = false;
    warmedUp = false;
    performanceTier = 'low';

    try {
        await loadModel({ skipWarmup: true });
        post({ type: 'recovered' });
    } catch (error) {
        // Retry once
        processor = null;
        model = null;
        isLoaded = false;
        await new Promise((r) => setTimeout(r, 350));
        try {
            await loadModel({ skipWarmup: true });
            post({ type: 'recovered' });
        } catch (retryError) {
            post({ type: 'error', message: retryError.message, code: 'RECOVERY_FAILED' });
        }
    }
}

// ── Message handler ─────────────────────────────────────────────

self.onmessage = async (event) => {
    const { type, ...data } = event.data;

    try {
        switch (type) {
            case 'load':
                await loadModel(data.options);
                break;

            case 'warmup':
                await doWarmup();
                break;

            case 'infer': {
                if (data.performanceTier) {
                    performanceTier = data.performanceTier;
                }
                const result = await runInference(
                    data.imageData,
                    data.prompt,
                    null,
                    data.isWarmup || false
                );
                post({ type: 'result', text: result });
                break;
            }

            case 'recover':
                await recoverFromDeviceLoss();
                break;

            case 'getState':
                post({
                    type: 'state',
                    state: {
                        isLoaded,
                        isLoading,
                        warmedUp,
                        performanceTier,
                    },
                });
                break;

            default:
                console.warn(`[InferenceWorker] Unknown message type: ${type}`);
        }
    } catch (error) {
        const message = error?.message || String(error);
        const isDeviceLost =
            message.toLowerCase().includes('device is lost') ||
            message.toLowerCase().includes('gpu device') ||
            message.toLowerCase().includes('mapasync');

        post({
            type: 'error',
            message,
            code: isDeviceLost ? 'WEBGPU_DEVICE_LOST' : 'INFERENCE_ERROR',
        });
    }
};

console.log('🧵 Inference Worker initialized');
