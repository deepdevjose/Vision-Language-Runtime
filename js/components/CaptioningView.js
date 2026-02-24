/**
 * Captioning View Component
 * Main view for live video captioning
 */

import { createElement, sleep } from '../utils/dom-helpers.js';
import { createDraggableContainer } from './DraggableContainer.js';
import { createPromptInput } from './PromptInput.js';
import { createLiveCaption } from './LiveCaption.js';
import { createWebcamCapture } from './WebcamCapture.js';
import { TIMING, PROMPTS, MODEL_CONFIG } from '../utils/constants.js';

// Lazy load vlmService (it's already loaded by LoadingScreen)
let vlmService = null;

export function createCaptioningView(videoElement) {
    const container = createElement('div', {
        className: 'absolute inset-0 text-white'
    });

    const innerContainer = createElement('div', {
        className: 'relative w-full h-full'
    });

    // State
    let isRunning = true;
    let currentPrompt = PROMPTS.default;
    let abortController = null;
    let isPromptFocused = false;

    // Detect mobile
    const isMobile = window.matchMedia('(max-width: 768px)').matches;

    // Create components
    const liveCaptionComponent = createLiveCaption();
    
    // Prompt focus handler for conditional visibility
    const handlePromptFocus = (focused) => {
        isPromptFocused = focused;
        if (isMobile) {
            // When prompt is focused/shown, hide caption
            // When prompt loses focus/hidden, show caption
            if (focused) {
                liveCaptionComponent.hide?.();
            } else {
                setTimeout(() => {
                    liveCaptionComponent.show?.();
                }, 150);
            }
        }
    };
    
    const promptInputComponent = createPromptInput(
        (newPrompt) => {
            currentPrompt = newPrompt;
        },
        handlePromptFocus
    );

    const webcamCaptureComponent = createWebcamCapture((running) => {
        isRunning = running;

        if (!running) {
            // Stop the loop
            if (abortController) {
                abortController.abort();
                abortController = null;
            }
        } else {
            // Restart the loop
            startCaptioningLoop();
        }
    });

    // Draggable containers (desktop only)
    let promptDraggable, captionDraggable;
    
    if (isMobile) {
        // Mobile: no draggable, direct positioning
        promptDraggable = promptInputComponent;
        captionDraggable = liveCaptionComponent;
    } else {
        // Desktop: draggable containers
        promptDraggable = createDraggableContainer({
            initialPosition: 'bottom-left',
            children: [promptInputComponent]
        });

        captionDraggable = createDraggableContainer({
            initialPosition: 'bottom-right',
            children: [liveCaptionComponent]
        });
    }

    // Captioning loop
    async function startCaptioningLoop() {
        if (abortController) {
            abortController.abort();
        }

        abortController = new AbortController();
        const signal = abortController.signal;

        // Lazy load vlmService if not already loaded
        if (!vlmService) {
            const module = await import('../services/vlm-service.js');
            vlmService = module.default;
        }

        // Verify model is loaded before starting
        const modelState = vlmService.getLoadedState();
        if (!modelState.isLoaded) {
            console.error('⚠️ Model is not loaded yet!');
            liveCaptionComponent.showError('Model not loaded');
            return;
        }
        
        if (MODEL_CONFIG.DEBUG) console.log('✅ Model is loaded, starting captioning loop...');

        const captureLoop = async () => {
            while (!signal.aborted && isRunning) {
                if (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    // Ensure video is always playing
                    if (videoElement.paused) {
                        await videoElement.play().catch(err => console.error('Failed to resume video in loop:', err));
                    }
                    
                    try {
                        const startTime = performance.now();
                        webcamCaptureComponent.updateStatus('🔄 Processing frame...');
                        if (MODEL_CONFIG.DEBUG) console.log('⏱️ Starting new inference cycle...');

                        // Throttle UI updates during streaming (every 100ms)
                        // 60fps DOM updates = browser meltdown, learned this the hard way
                        let lastUpdateTime = 0;
                        const updateThrottle = 100; // ms
                        
                        const result = await vlmService.runInference(
                            videoElement,
                            currentPrompt,
                            (streamedText) => {
                                // Throttle UI updates to reduce DOM churn
                                const now = performance.now();
                                if (now - lastUpdateTime >= updateThrottle) {
                                    liveCaptionComponent.updateCaption(streamedText, true);
                                    lastUpdateTime = now;
                                }
                            }
                        );

                        const elapsedTime = ((performance.now() - startTime) / 1000).toFixed(1);
                        if (MODEL_CONFIG.DEBUG) console.log(`⏱️ Inference completed in ${elapsedTime}s`);

                        if (result && !signal.aborted) {
                            liveCaptionComponent.updateCaption(result, false);
                            webcamCaptureComponent.updateStatus(`✅ Ready (last: ${elapsedTime}s)`);
                        }
                        
                        // Wait before next capture to prevent GPU saturation
                        // (tried 0ms delay once, GPU usage went to 100%, fans sounded like a jet engine)
                        if (!signal.aborted) {
                            if (MODEL_CONFIG.DEBUG) console.log(`⏸️ Waiting ${TIMING.FRAME_CAPTURE_DELAY/1000}s before next capture...`);
                            try {
                                await sleep(TIMING.FRAME_CAPTURE_DELAY, signal);
                            } catch (err) {
                                // Sleep was aborted, exit loop
                                if (err.name === 'AbortError') break;
                                throw err;
                            }
                        }
                    } catch (error) {
                        if (!signal.aborted) {
                            const message = error instanceof Error ? error.message : String(error);
                            liveCaptionComponent.showError(message);
                            webcamCaptureComponent.updateStatus('❌ Error: ' + message, true);
                            console.error('❌ Error processing frame:', error);
                            // Wait a bit before retrying on error
                            try {
                                await sleep(2000, signal);
                            } catch (err) {
                                if (err.name === 'AbortError') break;
                            }
                        }
                    }
                } else {
                    // Video not ready, wait and check again
                    try {
                        await sleep(100, signal);
                    } catch (err) {
                        if (err.name === 'AbortError') break;
                    }
                }

                if (signal.aborted) break;
            }
        };

        setTimeout(captureLoop, 0);
    }

    // Start the loop
    startCaptioningLoop();

    // Assemble
    innerContainer.appendChild(webcamCaptureComponent);
    innerContainer.appendChild(promptDraggable);
    innerContainer.appendChild(captionDraggable);
    container.appendChild(innerContainer);

    // Cleanup function
    container.cleanup = () => {
        if (abortController) {
            abortController.abort();
        }
        if (webcamCaptureComponent.cleanup) {
            webcamCaptureComponent.cleanup();
        }
        if (promptDraggable.cleanup) {
            promptDraggable.cleanup();
        }
        if (captionDraggable.cleanup) {
            captionDraggable.cleanup();
        }
    };

    return container;
}
