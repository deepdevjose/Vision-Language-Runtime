/**
 * Loading Screen Component - Apple/WWDC Premium Style
 */

import { createElement } from '../utils/dom-helpers.js';
import { GLASS_EFFECTS } from '../utils/constants.js';

export function createLoadingScreen(onComplete) {
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
            currentStep = 'Verifying WebGPU context';
            microLog = 'Checking GPU availability...';
            progress = 5;
            updateUI();

            if (!navigator.gpu) {
                currentStep = 'WebGPU not available';
                microLog = 'GPU acceleration required';
                isError = true;
                updateUI();

                // Show error UI
                const errorIconContainer = createElement('div', {
                    className: 'error-icon-container'
                });
                const errorIcon = createElement('svg', {
                    className: 'error-icon',
                    attributes: { fill: 'currentColor', viewBox: '0 0 20 20' }
                });
                errorIcon.innerHTML = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />`;
                errorIconContainer.appendChild(errorIcon);
                content.insertBefore(errorIconContainer, title);

                progressSection.style.display = 'none';
                microLogText.style.display = 'none';

                const reloadButton = createElement('button', {
                    className: 'loading-error-button',
                    text: 'Reload Runtime'
                });
                reloadButton.addEventListener('click', () => window.location.reload());
                content.appendChild(reloadButton);
                return;
            }

            // Lazy load VLM service
            currentStep = 'Resolving model dependencies';
            microLog = 'Loading inference engine...';
            assetCount = 5;
            progress = 8;
            updateUI();
            
            const { default: vlmService } = await import('../services/vlm-service.js');
            
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
                    progress = Math.max(progress, progressPercent);
                } else {
                    // Fallback logic
                    if (message.includes('Loading processor')) {
                        progress = Math.max(progress, 10);
                    } else if (message.includes('Processor loaded')) {
                        progress = Math.max(progress, 20);
                    } else if (message.includes('Model loaded')) {
                        progress = Math.max(progress, 80);
                    }
                }

                updateUI();
            });

            currentStep = 'Runtime ready';
            microLog = 'Vision-language pipeline active';
            assetCount = 0;
            progress = 100;
            updateUI();

            // Longer delay for smooth transition
            // (800ms looks professional, 500ms feels rushed, 1000ms feels slow - don't ask how I know)
            await new Promise(resolve => setTimeout(resolve, 800));
            onComplete();
        } catch (error) {
            console.error('Runtime initialization failed:', error);
            currentStep = `Runtime error: ${error.message}`;
            microLog = 'Execution pipeline failed';
            isError = true;
            updateUI();

            // Show error UI
            const errorIconContainer = createElement('div', {
                className: 'error-icon-container'
            });
            const errorIcon = createElement('svg', {
                className: 'error-icon',
                attributes: { fill: 'currentColor', viewBox: '0 0 20 20' }
            });
            errorIcon.innerHTML = `<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />`;
            errorIconContainer.appendChild(errorIcon);
            content.insertBefore(errorIconContainer, title);

            progressSection.style.display = 'none';
            microLogText.style.display = 'none';

            const reloadButton = createElement('button', {
                className: 'loading-error-button',
                text: 'Reload Runtime'
            });
            reloadButton.addEventListener('click', () => window.location.reload());
            content.appendChild(reloadButton);
        }
    }, 0);

    return wrapper;
}
