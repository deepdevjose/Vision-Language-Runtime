/**
 * VLM (Vision Language Model) Service
 * Handles loading and running inference with FastVLM model
 */

import { AutoProcessor, AutoModelForImageTextToText, RawImage, TextStreamer } from '@huggingface/transformers';
import { MODEL_CONFIG } from '../utils/constants.js';
import webgpuDetector from '../utils/webgpu-detector.js';

class VLMService {
    constructor() {
        this.processor = null;
        this.model = null;
        this.isLoaded = false;
        this.isLoading = false;
        this.loadPromise = null;
        this.inferenceLock = false;
        this.canvas = null;
        this.ctx = null;  // Cache canvas context
    }

    async loadModel(onProgress) {
        if (this.isLoaded) {
            onProgress?.('Model already loaded!');
            return;
        }

        if (this.loadPromise) {
            return this.loadPromise;
        }

        this.isLoading = true;

        // Track progress for multiple files
        const fileProgress = new Map();
        let totalFiles = 0;
        let completedFiles = 0;

        this.loadPromise = (async () => {
            try {
                // Detect WebGPU and FP16 support before loading model
                onProgress?.('Detecting GPU capabilities...', 5);
                const gpuInfo = await webgpuDetector.detect();
                
                if (!gpuInfo.supported) {
                    throw new Error('WebGPU not supported on this device/browser');
                }

                // Show performance estimate
                const perfEstimate = webgpuDetector.getPerformanceEstimate();
                console.log(`⚡ Expected Performance: ${perfEstimate.tier.toUpperCase()} tier (${perfEstimate.expectedLatency})`);
                if (perfEstimate.recommendations.length > 0) {
                    console.log('💡 Recommendations:');
                    perfEstimate.recommendations.forEach(rec => console.log(`   ${rec}`));
                }

                onProgress?.('Loading processor...', 10);
                this.processor = await AutoProcessor.from_pretrained(MODEL_CONFIG.MODEL_ID);

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
                            
                            // Calculate overall progress
                            const progressValues = Array.from(fileProgress.values());
                            const avgProgress = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
                            const overallPercent = Math.round(avgProgress);
                            
                            onProgress?.(`Downloading model files... (${fileProgress.size} files)`, 20 + (overallPercent * 0.6));
                        } else if (data.status === 'done') {
                            completedFiles++;
                        } else if (data.status === 'initiate') {
                            totalFiles++;
                        }
                    }
                });

                onProgress?.('Model loaded successfully!', 80);
                this.isLoaded = true;
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

    async runInference(video, instruction, onTextUpdate) {
        // Prevents concurrent inference calls (GPU doesn't like multitasking this hard)
        if (this.inferenceLock) {
            if (MODEL_CONFIG.DEBUG) console.warn('⚠️ Inference already running, skipping frame');
            return '';
        }

        this.inferenceLock = true;
        if (MODEL_CONFIG.DEBUG) console.log('🔒 Inference lock acquired');

        if (!this.processor || !this.model) {
            this.inferenceLock = false;
            if (MODEL_CONFIG.DEBUG) console.log('🔓 Inference lock released (no model)');
            throw new Error('Model/processor not loaded');
        }

        try {
            if (MODEL_CONFIG.DEBUG) console.log('🎥 Starting inference with prompt:', instruction);
            
            // Create canvas if it doesn't exist
            if (!this.canvas) {
                this.canvas = document.createElement('canvas');
                this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
            }

            // Calculate scaled dimensions to reduce inference cost
            // Keep aspect ratio but limit max dimension to MAX_INFERENCE_SIZE
            // (640px is the sweet spot - tested higher values, GPU starts crying)
            const videoWidth = video.videoWidth;
            const videoHeight = video.videoHeight;
            const maxSize = MODEL_CONFIG.MAX_INFERENCE_SIZE || 640;
            
            let canvasWidth, canvasHeight;
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

            // Only resize canvas if dimensions changed
            // (recreating canvas every frame = bad time)
            if (this.canvas.width !== canvasWidth || this.canvas.height !== canvasHeight) {
                this.canvas.width = canvasWidth;
                this.canvas.height = canvasHeight;
                if (MODEL_CONFIG.DEBUG) console.log(`📐 Canvas resized to ${canvasWidth}x${canvasHeight} (from ${videoWidth}x${videoHeight})`);
            }

            if (!this.ctx) {
                throw new Error('Could not get canvas context');
            }

            // Draw current video frame to canvas (downscaled)
            this.ctx.drawImage(video, 0, 0, canvasWidth, canvasHeight);

            // Get image data
            const frame = this.ctx.getImageData(0, 0, canvasWidth, canvasHeight);
            const rawImg = new RawImage(frame.data, frame.width, frame.height, 4);
            
            if (MODEL_CONFIG.DEBUG) console.log('📸 Captured frame:', canvasWidth, 'x', canvasHeight);

            // Detect if mobile for concise mode
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            const maxTokens = isMobile ? MODEL_CONFIG.MAX_NEW_TOKENS_MOBILE : MODEL_CONFIG.MAX_NEW_TOKENS;

            // Prepare messages for the model
            const systemPrompt = isMobile 
                ? 'You are a visual AI. Answer in ONE short sentence (8-14 words). No lists, no explanations, no step-by-step. Just the answer.'
                : 'You are a helpful visual AI assistant. Respond concisely and accurately to the user\'s query in one sentence.';
            
            const messages = [
                {
                    role: 'system',
                    content: systemPrompt
                },
                { role: 'user', content: `<image>${instruction}` }
            ];

            const prompt = this.processor.apply_chat_template(messages, {
                add_generation_prompt: true
            });

            if (MODEL_CONFIG.DEBUG) console.log('📝 Processing inputs...');
            const inputs = await this.processor(rawImg, prompt, {
                add_special_tokens: false
            });

            if (MODEL_CONFIG.DEBUG) console.log('🤖 Running model inference...');
            // Run inference with streaming
            let streamed = '';
            let tokenCount = 0;
            const streamer = new TextStreamer(this.processor.tokenizer, {
                skip_prompt: true,
                skip_special_tokens: true,
                callback_function: (token) => {
                    streamed += token;
                    tokenCount++;
                    // Only log every 5th token if DEBUG enabled to reduce noise
                    if (MODEL_CONFIG.DEBUG && tokenCount % 5 === 0) {
                        console.log(`📤 Streaming... (${tokenCount} tokens)`);
                    }
                    onTextUpdate?.(streamed.trim());
                }
            });

            const outputs = await this.model.generate({
                ...inputs,
                max_new_tokens: maxTokens,
                do_sample: false,
                streamer,
                repetition_penalty: 1.2
            });
            
            if (MODEL_CONFIG.DEBUG) console.log(`✅ Model output generated (${maxTokens} max tokens)`);

            // If streaming worked, use that result to avoid redundant decoding
            const finalText = streamed.trim() || this.processor.batch_decode(
                outputs.slice(null, [inputs.input_ids.dims.at(-1), null]),
                { skip_special_tokens: true }
            )[0].trim();

            if (MODEL_CONFIG.DEBUG) console.log('💬 Final caption:', finalText);
            
            this.inferenceLock = false;
            if (MODEL_CONFIG.DEBUG) console.log('🔓 Inference lock released (success)');
            return finalText;
        } catch (error) {
            console.error('❌ Inference error:', error);
            this.inferenceLock = false;
            if (MODEL_CONFIG.DEBUG) console.log('🔓 Inference lock released (error)');
            throw error;
        }
    }

    getLoadedState() {
        return {
            isLoaded: this.isLoaded,
            isLoading: this.isLoading
        };
    }
}

// Export singleton instance
const vlmService = new VLMService();
export default vlmService;
