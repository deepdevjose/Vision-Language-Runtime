/**
 * Loading Screen Component - Apple/WWDC Premium Style
 * Now with phase-aware loading and event dispatching
 */

import { createElement } from '../utils/dom-helpers.js';
import { GLASS_EFFECTS } from '../utils/constants.js';
import logger from '../utils/logger.js';

/**
 * @typedef {'loading-wgpu' | 'loading-model' | 'warming-up' | 'complete'} LoadingPhase
 */

/**
 * Creates loading screen with phase-based progress
 * @param {Function} onPhaseChange - Called when loading phase changes (event, data)
 * @param {Function} onComplete - Called when loading completes successfully
 * @param {Function} onError - Called when loading fails (error)
 * @returns {HTMLElement}
 */
export function createLoadingScreen(onPhaseChange, onComplete, onError) {
    const wrapper = createElement('div', {
        className: 'loading-screen-wrapper'
    });

    let progress = 0;
    let currentStep = 'Initializing...';
    let microLog = 'WebGPU context ready';
    let assetCount = 0;
    let isError = false;

    const content = createElement('div', {
        className: 'loading-content'
    });

    // Title - More technical
    const title = createElement('h2', {
        className: 'loading-title',
        text: 'Initializing Runtime'
    });

    // Subtitle - Technical
    const subtitle = createElement('p', {
        className: 'loading-subtitle',
        text: 'PREPARING EXECUTION ENVIRONMENT'
    });

    // Step text - Elegant format
    const stepText = createElement('p', {
        className: 'loading-step',
        text: currentStep
    });

    // Progress Section
    const progressSection = createElement('div', {
        className: 'loading-progress-section'
    });

    // Progress bar (minimal, with internal %)
    const progressBarContainer = createElement('div', {
        className: 'loading-progress-bar-container'
    });

    const progressBarFill = createElement('div', {
        className: 'loading-progress-bar-fill',
        style: { width: '0%' }
    });

    progressBarContainer.appendChild(progressBarFill);
    progressSection.appendChild(progressBarContainer);

    // Micro log (simulates real runtime logs)
    const microLogText = createElement('p', {
        className: 'loading-micro-log',
        text: microLog
    });

    content.appendChild(title);
    content.appendChild(subtitle);
    content.appendChild(stepText);
    content.appendChild(progressSection);
    content.appendChild(microLogText);

    wrapper.appendChild(content);

    // Update UI function
    function updateUI() {
        // Update step text with elegant format
        if (assetCount > 0 && !isError) {
            stepText.textContent = `Fetching model weights • ${assetCount} assets`;
        } else {
            stepText.textContent = currentStep;
        }
        
        // Update progress bar
        progressBarFill.style.width = progress + '%';
        
        // Update micro log
        microLogText.textContent = microLog;
        
        // At 100%, smooth transition
        if (progress >= 100 && !isError) {
            setTimeout(() => {
                progressSection.style.opacity = '0';
                title.textContent = 'Runtime Ready';
                subtitle.textContent = 'EXECUTION ENVIRONMENT ACTIVE';
                microLogText.textContent = 'All systems operational';
            }, 200);
        }

        if (isError) {
            title.textContent = 'Initialization Failed';
            subtitle.textContent = 'RUNTIME ERROR';
            stepText.className = 'loading-step loading-step-error';
            content.style.background = GLASS_EFFECTS.COLORS.ERROR_BG;
        }
    }

    // Load model
    setTimeout(async () => {
        try {
            // Phase 1: WebGPU verification
            currentStep = 'Verifying WebGPU context';
            microLog = 'Checking GPU availability...';
            progress = 5;
            updateUI();
            logger.info('Loading phase: WebGPU verification');

            if (!navigator.gpu) {
                const error = new Error('WebGPU not available');
                error.code = 'WEBGPU_NOT_SUPPORTED';
                onError?.(error);
                
                currentStep = 'WebGPU not available';
                microLog = 'GPU acceleration required';
                isError = true;
                updateUI();
                return;
            }

            onPhaseChange?.('WGPU_READY');
            
            // Phase 2: Load model
            currentStep = 'Resolving model dependencies';
            microLog = 'Loading inference engine...';
            assetCount = 5;
            progress = 10;
            updateUI();
            logger.info('Loading phase: Model loading');
            
            const { default: vlmService } = await import('../services/vision-language-service.js');
            
            // Load the model
            await vlmService.loadModel((message, progressPercent) => {
                // Map service messages to technical runtime language
                if (message.includes('Loading processor')) {
                    microLog = 'Initializing tokenizer...';
                    assetCount = 3;
                } else if (message.includes('Processor loaded')) {
                    microLog = 'Allocating tensors...';
                    assetCount = 5;
                } else if (message.includes('Loading model')) {
                    microLog = 'Resolving ONNX runtime...';
                    assetCount = 7;
                } else if (message.includes('Model loaded')) {
                    microLog = 'Optimizing execution graph...';
                    assetCount = 1;
                }
                
                // Use the progress percent provided by the service
                if (progressPercent !== undefined) {
                    progress = Math.max(progress, progressPercent * 0.7); // 70% for model load
                } else {
                    // Fallback logic
                    if (message.includes('Loading processor')) {
                        progress = Math.max(progress, 15);
                    } else if (message.includes('Processor loaded')) {
                        progress = Math.max(progress, 25);
                    } else if (message.includes('Model loaded')) {
                        progress = Math.max(progress, 70);
                    }
                }

                updateUI();
            });

            onPhaseChange?.('MODEL_LOADED');
            
            // Phase 3: Warmup
            currentStep = 'Warming up inference pipeline';
            microLog = 'Running calibration inferences...';
            assetCount = 0;
            progress = 75;
            updateUI();
            logger.info('Loading phase: Warmup');
            
            await vlmService.performWarmup();
            
            onPhaseChange?.('WARMUP_COMPLETE');
            
            // Phase 4: Complete
            currentStep = 'Runtime ready';
            microLog = 'Vision-language pipeline active';
            progress = 100;
            updateUI();
            logger.info('Loading phase: Complete');

            // Longer delay for smooth transition
            await new Promise(resolve => setTimeout(resolve, 800));
            onComplete?.();
            
        } catch (error) {
            logger.error('Runtime initialization failed', { error: error.message });
            console.error('Runtime initialization failed:', error);
            
            error.code = error.code || 'MODEL_LOAD_FAILED';
            onError?.(error);
            
            currentStep = `Runtime error: ${error.message}`;
            microLog = 'Execution pipeline failed';
            isError = true;
            updateUI();
        }
    }, 0);

    return wrapper;
}
