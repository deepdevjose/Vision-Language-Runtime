/**
 * Captioning View Component
 * Main view for live video captioning
 */

import { createElement, sleep } from '../utils/dom-helpers.js';
import { createDraggableContainer } from './draggable-container.js';
import { createPromptInput } from './prompt-input.js';
import { createLiveCaption } from './live-caption.js';
import { createWebcamCapture } from './webcam-capture.js';
import { createCaptionHistory } from './caption-history.js';
import { createFreezeFrame } from './freeze-frame.js';
import { createURLList } from './url-display.js';
import { processTextWithURLs } from '../utils/url-sanitizer.js';
import { TIMING, PROMPTS, MODEL_CONFIG } from '../utils/constants.js';
import logger from '../utils/logger.js';

// Lazy load vlmService (it's already loaded by LoadingScreen)
let vlmService = null;

/**
 * Post-process caption to clean up common artifacts
 */
function postProcessCaption(text) {
    if (!text) return text;
    
    let cleaned = text;
    
    // Normalize spaces (multiple spaces -> single space)
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove trailing/leading spaces
    cleaned = cleaned.trim();
    
    // Remove repetitive phrases (e.g., "The image shows the image shows...")
    // Match repeated sequences of 3+ words
    cleaned = cleaned.replace(/\b(\w+\s+\w+\s+\w+)(\s+\1)+/gi, '$1');
    
    // Remove common filler artifacts ("uh", "...", excessive punctuation)
    cleaned = cleaned.replace(/\buh+\b/gi, '');
    cleaned = cleaned.replace(/\.{3,}/g, '...');
    cleaned = cleaned.replace(/!{2,}/g, '!');
    cleaned = cleaned.replace(/\?{2,}/g, '?');
    
    // Fix spacing around punctuation
    cleaned = cleaned.replace(/\s+([.,!?])/g, '$1');
    cleaned = cleaned.replace(/([.,!?])(\w)/g, '$1 $2');
    
    // Final trim
    cleaned = cleaned.trim();
    
    return cleaned;
}

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
    
    // Caption history (desktop only)
    const captionHistoryComponent = !isMobile ? createCaptionHistory() : null;
    
    // Freeze frame component
    const freezeFrameComponent = createFreezeFrame(
        () => {
            // On freeze
            if (MODEL_CONFIG.DEBUG) console.log('🧊 Frame frozen');
        },
        () => {
            // On unfreeze
            if (MODEL_CONFIG.DEBUG) console.log('▶️ Frame resumed');
        }
    );
    
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
            const module = await import('../services/vision-language-service.js');
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
                // Check if frozen - skip inference if in freeze mode
                if (freezeFrameComponent.isFrozen()) {
                    await sleep(500, signal).catch(() => {});
                    continue;
                }
                
                if (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    // Ensure video is always playing
                    if (videoElement.paused) {
                        await videoElement.play().catch(err => console.error('Failed to resume video in loop:', err));
                    }
                    
                    // BACKPRESSURE: Check if inference is already running
                    // Don't queue up frames - skip if busy
                    const serviceState = vlmService.getLoadedState();
                    if (vlmService.inferenceLock) {
                        if (MODEL_CONFIG.DEBUG) console.log('⏭️ Skipping frame - inference still running');
                        await sleep(500, signal).catch(() => {});
                        continue;
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
                            // Post-process caption: clean up artifacts
                            const cleanedResult = postProcessCaption(result);
                            liveCaptionComponent.updateCaption(cleanedResult, false);
                            webcamCaptureComponent.updateStatus(`✅ Ready (last: ${elapsedTime}s)`);
                            
                            // Add to history (desktop only)
                            if (captionHistoryComponent) {
                                captionHistoryComponent.addCaption(
                                    cleanedResult, 
                                    currentPrompt, 
                                    freezeFrameComponent.isFrozen()
                                );
                            }
                        }
                        
                        // DYNAMIC FPS: Wait based on actual inference time
                        // If inference takes 2s, don't capture every 100ms
                        if (!signal.aborted) {
                            const dynamicDelay = vlmService.getDynamicFrameDelay();
                            if (MODEL_CONFIG.DEBUG) console.log(`⏸️ Dynamic wait: ${(dynamicDelay/1000).toFixed(1)}s (based on avg inference time)`);
                            try {
                                await sleep(dynamicDelay, signal);
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
    
    // Add history component (desktop only)
    if (captionHistoryComponent) {
        innerContainer.appendChild(captionHistoryComponent.element);
    }
    
    // Add freeze frame button to webcam controls
    const webcamControls = webcamCaptureComponent.querySelector('.webcam-controls-row');
    if (webcamControls) {
        webcamControls.appendChild(freezeFrameComponent.element);
    }
    
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
