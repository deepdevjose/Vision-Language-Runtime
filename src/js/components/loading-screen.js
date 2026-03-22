/**
 * Loading Screen Component — Thinking UI
 */

import { createElement } from '../utils/dom-helpers.js';
import logger from '../utils/logger.js';

export function createLoadingScreen(onPhaseChange, onComplete, onError) {
    const wrapper = createElement('div', { className: 'ls-wrapper' });
    const card = createElement('div', { className: 'ls-card' });

    // Header
    const header = createElement('div', { className: 'ls-header' });
    const headerIcon = createElement('div', { className: 'ls-icon' });
    headerIcon.innerHTML = `<svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
        <path class="ls-icon-arc" d="M14 3 A11 11 0 0 1 25 14" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    const headerText = createElement('div', { className: 'ls-header-text' });
    const title = createElement('h2', { className: 'ls-title', text: 'Setting up' });
    const subtitle = createElement('p', {
        className: 'ls-subtitle',
        text: 'This may take a moment',
    });
    headerText.appendChild(title);
    headerText.appendChild(subtitle);
    header.appendChild(headerIcon);
    header.appendChild(headerText);

    // Steps list — shows progress as sequential steps
    const stepsList = createElement('div', { className: 'ls-steps' });

    const stepsData = [
        { id: 'webgpu', label: 'Verifying GPU access' },
        { id: 'engine', label: 'Loading inference engine' },
        { id: 'weights', label: 'Downloading model weights' },
        { id: 'warmup', label: 'Warming up pipeline' },
    ];

    const stepEls = {};
    stepsData.forEach(({ id, label }) => {
        const row = createElement('div', { className: 'ls-step ls-step-pending' });
        const dot = createElement('div', { className: 'ls-step-dot' });
        const text = createElement('div', { className: 'ls-step-text', text: label });
        const check = createElement('div', { className: 'ls-step-check', text: '✓' });
        row.appendChild(dot);
        row.appendChild(text);
        row.appendChild(check);
        stepEls[id] = row;
        stepsList.appendChild(row);
    });

    // Progress bar
    const progressWrap = createElement('div', { className: 'ls-progress-wrap' });
    const progressBar = createElement('div', { className: 'ls-progress-bar' });
    const progressFill = createElement('div', {
        className: 'ls-progress-fill',
        style: { width: '0%' },
    });
    progressBar.appendChild(progressFill);
    const progressLabel = createElement('span', { className: 'ls-progress-label', text: '0%' });
    progressWrap.appendChild(progressBar);
    progressWrap.appendChild(progressLabel);

    // Thinking log — the "AI is working" feel
    const thinkingRow = createElement('div', { className: 'ls-thinking' });
    const thinkingDot = createElement('div', { className: 'ls-thinking-dot' });
    const thinkingText = createElement('span', {
        className: 'ls-thinking-text',
        text: 'Checking GPU availability...',
    });
    thinkingRow.appendChild(thinkingDot);
    thinkingRow.appendChild(thinkingText);

    card.appendChild(header);
    card.appendChild(stepsList);
    card.appendChild(progressWrap);
    card.appendChild(thinkingRow);
    wrapper.appendChild(card);

    // ── Helpers ────────────────────────────────────────────
    let progress = 0;

    function setProgress(pct, thinking) {
        progress = Math.max(progress, pct);
        progressFill.style.width = progress + '%';
        progressLabel.textContent = Math.round(progress) + '%';
        if (thinking) thinkingText.textContent = thinking;
    }

    function activateStep(id) {
        const el = stepEls[id];
        if (!el) return;
        // Deactivate any currently active
        Object.values(stepEls).forEach((s) => s.classList.remove('ls-step-active'));
        el.classList.remove('ls-step-pending');
        el.classList.add('ls-step-active');
    }

    function completeStep(id) {
        const el = stepEls[id];
        if (!el) return;
        el.classList.remove('ls-step-active');
        el.classList.add('ls-step-done');
    }

    function showError(message) {
        title.textContent = 'Initialization Failed';
        subtitle.textContent = message;
        subtitle.classList.add('ls-subtitle-error');
        thinkingText.textContent = 'Pipeline failed';
        thinkingDot.classList.add('ls-thinking-dot-error');
        Object.values(stepEls).forEach((s) => {
            if (s.classList.contains('ls-step-active')) {
                s.classList.replace('ls-step-active', 'ls-step-error');
            }
        });
    }

    // ── Load sequence ──────────────────────────────────────
    setTimeout(async () => {
        try {
            // Step 1
            activateStep('webgpu');
            setProgress(5, 'Checking GPU availability...');
            logger.info('Loading phase: WebGPU');

            if (!(/** @type {any} */ (navigator).gpu)) {
                const error = /** @type {Error & {code?: string}} */ (
                    new Error('WebGPU not available')
                );
                error.code = 'WEBGPU_NOT_SUPPORTED';
                onError?.(error);
                showError('WebGPU not supported in this browser');
                return;
            }

            completeStep('webgpu');
            onPhaseChange?.('WGPU_READY');

            // Step 2
            activateStep('engine');
            setProgress(10, 'Loading inference engine...');
            logger.info('Loading phase: Engine');

            const { default: vlmService } = await import('../services/vision-language-service.js');
            completeStep('engine');

            // Step 3
            activateStep('weights');
            setProgress(15, 'Resolving model dependencies...');
            logger.info('Loading phase: Model weights');

            await vlmService.loadModel((message, progressPercent) => {
                let thinking = 'Downloading model weights...';
                if (message.includes('Loading processor')) thinking = 'Initializing tokenizer...';
                else if (message.includes('Processor loaded'))
                    thinking = 'Allocating tensor memory...';
                else if (message.includes('Loading model')) thinking = 'Loading ONNX graph...';
                else if (message.includes('Model loaded'))
                    thinking = 'Optimizing execution graph...';

                const pct =
                    progressPercent !== undefined
                        ? Math.max(progress, progressPercent * 0.7)
                        : progress;
                setProgress(pct, thinking);
            });

            completeStep('weights');
            onPhaseChange?.('MODEL_LOADED');

            // Step 4
            activateStep('warmup');
            setProgress(75, 'Running calibration inferences...');
            logger.info('Loading phase: Warmup');

            await vlmService.performWarmup();

            completeStep('warmup');
            onPhaseChange?.('WARMUP_COMPLETE');

            // Done
            setProgress(100, 'All systems operational');
            title.textContent = 'Runtime Ready';
            subtitle.textContent = 'Vision-language pipeline active';
            thinkingDot.classList.add('ls-thinking-dot-ready');

            await new Promise((resolve) => setTimeout(resolve, 700));
            onComplete?.();
        } catch (error) {
            logger.error('Runtime initialization failed', { error: error.message });
            /** @type {any} */ (error).code =
                /** @type {any} */ (error).code || 'MODEL_LOAD_FAILED';
            onError?.(error);
            showError(error.message);
        }
    }, 0);

    return wrapper;
}
