/**
 * Inference Worker Bridge
 * Wraps the inference Web Worker in a Promise-based API that is compatible
 * with the CoreInference interface used by VLMService.
 *
 * Fix 7 — Main-thread bridge for the inference Web Worker.
 *
 * Usage:
 *   import { InferenceWorkerBridge } from './inference-worker-bridge.js';
 *   const bridge = new InferenceWorkerBridge();
 *   await bridge.loadModel(onProgress);
 *   const text = await bridge.runModelGenerate(canvas, prompt, onTextUpdate);
 */

export class InferenceWorkerBridge {
    constructor() {
        /** @type {Worker|null} */
        this.worker = null;

        // Mirror state from the worker
        this.isLoaded = false;
        this.isLoading = false;
        this.warmedUp = false;
        this.inferenceLock = false;
        this.performanceTier = 'high';
        this.loadPromise = null;
        this.recoveryPromise = null;

        /** @type {Map<string, Function>} pending one-shot resolvers */
        this._pendingResolvers = new Map();

        /** @type {Function|null} streaming token callback */
        this._onTextUpdate = null;

        /** @type {Function|null} progress callback */
        this._onProgress = null;
    }

    /**
     * Lazily spawn the worker.
     * Uses `type: 'module'` so the importmap from index.html is available.
     */
    _ensureWorker() {
        if (this.worker) return;

        this.worker = new Worker(
            new URL('./inference-worker.js', import.meta.url),
            { type: 'module' }
        );

        this.worker.onmessage = (event) => this._handleMessage(event.data);

        this.worker.onerror = (event) => {
            console.error('[WorkerBridge] Worker error:', event.message);
            const reject = this._pendingResolvers.get('error');
            if (reject) {
                reject(new Error(event.message));
                this._pendingResolvers.delete('error');
            }
        };
    }

    /**
     * Route messages from the worker to the right callback/resolver.
     * @param {Object} msg
     */
    _handleMessage(msg) {
        switch (msg.type) {
            case 'progress':
                this._onProgress?.(msg.message, msg.percent);
                break;

            case 'loaded':
                this.isLoaded = true;
                this.isLoading = false;
                this._resolve('load');
                break;

            case 'warmedUp':
                this.warmedUp = true;
                this._resolve('warmup');
                break;

            case 'token':
                this._onTextUpdate?.(msg.text);
                break;

            case 'result':
                this._resolve('infer', msg.text);
                break;

            case 'state':
                this.isLoaded = msg.state.isLoaded;
                this.isLoading = msg.state.isLoading;
                this.warmedUp = msg.state.warmedUp;
                this.performanceTier = msg.state.performanceTier;
                this._resolve('getState', msg.state);
                break;

            case 'recovered':
                this.isLoaded = true;
                this._resolve('recover');
                break;

            case 'error': {
                const err = /** @type {Error & {code?: string}} */ (new Error(msg.message));
                err.code = msg.code;
                // Reject whichever promise is pending
                for (const [key, { reject }] of this._pendingResolvers) {
                    reject(err);
                    this._pendingResolvers.delete(key);
                    break; // reject only the first (most recent)
                }
                break;
            }
        }
    }

    /**
     * Create a pending promise for a given message type.
     * @param {string} key
     * @returns {Promise<any>}
     */
    _createPending(key) {
        return new Promise((resolve, reject) => {
            this._pendingResolvers.set(key, { resolve, reject });
        });
    }

    /**
     * Resolve a pending promise.
     * @param {string} key
     * @param {*} [value]
     */
    _resolve(key, value) {
        const pending = this._pendingResolvers.get(key);
        if (pending) {
            pending.resolve(value);
            this._pendingResolvers.delete(key);
        }
    }

    // ── Public API (mirrors CoreInference interface) ─────────────

    /**
     * Load model inside the worker.
     * @param {Function} [onProgress]
     * @param {Object} [options]
     */
    async loadModel(onProgress, options = {}) {
        if (this.isLoaded) {
            onProgress?.('Model already loaded!');
            return;
        }
        if (this.loadPromise) return this.loadPromise;

        this._ensureWorker();
        this._onProgress = onProgress || null;
        this.isLoading = true;

        const promise = this._createPending('load');
        this.worker.postMessage({ type: 'load', options });

        this.loadPromise = promise;
        try {
            await promise;
        } finally {
            this.loadPromise = null;
        }
    }

    /**
     * Perform warmup inside the worker.
     */
    async performWarmup() {
        if (this.warmedUp) return;
        this._ensureWorker();

        const promise = this._createPending('warmup');
        this.worker.postMessage({ type: 'warmup' });
        await promise;
    }

    /**
     * Run model inference.
     * Extracts ImageData from the canvas on the main thread, sends it to the worker.
     * @param {HTMLCanvasElement|OffscreenCanvas} canvas
     * @param {string} prompt
     * @param {Function|null} onTextUpdate
     * @param {boolean} isWarmup
     * @returns {Promise<string>}
     */
    async runModelGenerate(canvas, prompt, onTextUpdate, isWarmup = false) {
        this._ensureWorker();
        this._onTextUpdate = onTextUpdate || null;

        // Extract ImageData on main thread (canvas may not be transferable)
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const promise = this._createPending('infer');
        this.worker.postMessage(
            {
                type: 'infer',
                imageData,
                prompt,
                performanceTier: this.performanceTier,
                isWarmup,
            },
            [imageData.data.buffer] // Transfer the buffer for zero-copy
        );

        return promise;
    }

    /**
     * Recover from GPU device loss.
     * @param {Function} [onProgress]
     */
    async recoverFromDeviceLoss(onProgress) {
        if (this.recoveryPromise) return this.recoveryPromise;

        this._ensureWorker();
        this._onProgress = onProgress || null;

        const promise = this._createPending('recover');
        this.worker.postMessage({ type: 'recover' });

        this.recoveryPromise = promise;
        try {
            await promise;
        } finally {
            this.recoveryPromise = null;
        }
    }

    /**
     * Check if an error indicates device loss.
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
     * Normalize inference errors.
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

        return /** @type {Error & {code?: string}} */ (
            error instanceof Error ? error : new Error(String(error || 'Unknown inference error'))
        );
    }

    acquireInferenceLock() {
        if (this.inferenceLock) return false;
        this.inferenceLock = true;
        return true;
    }

    releaseInferenceLock() {
        this.inferenceLock = false;
    }

    resetForRecovery() {
        this.isLoaded = false;
        this.isLoading = false;
        this.loadPromise = null;
        this.inferenceLock = false;
        this.warmedUp = false;
    }

    getLoadedState() {
        return {
            isLoaded: this.isLoaded,
            isLoading: this.isLoading,
            warmedUp: this.warmedUp,
        };
    }

    getPerformanceTier() {
        return this.performanceTier;
    }

    /** @param {string} tier */
    setPerformanceTier(tier) {
        this.performanceTier = tier;
    }

    getProcessor() {
        // Processor lives in the worker; return null.
        // Callers that need the processor (e.g. prompt template) should
        // use the main-thread processor from vision-language-service.
        return null;
    }

    getModel() {
        return null;
    }

    /**
     * Terminate the worker (cleanup).
     */
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export default new InferenceWorkerBridge();
