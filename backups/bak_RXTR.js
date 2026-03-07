/**
 * Captioning View — Apple Intelligence-style runtime layout
 * Camera (protagonist) → Prompt → Response → Settings (hidden)
 */

import { createElement, sleep } from '../utils/dom-helpers.js';
import { PROMPTS, MODEL_CONFIG } from '../utils/constants.js';
import logger from '../utils/logger.js';

let vlmService = null;

function postProcessCaption(text) {
    if (!text) return text;
    let t = text.replace(/\s+/g, ' ').trim();
    t = t.replace(/\b(\w+\s+\w+\s+\w+)(\s+\1)+/gi, '$1');
    t = t.replace(/\buh+\b/gi, '');
    t = t.replace(/\.{3,}/g, '...');
    t = t.replace(/!{2,}/g, '!');
    t = t.replace(/\?{2,}/g, '?');
    t = t.replace(/\s+([.,!?])/g, '$1');
    t = t.replace(/([.,!?])(\w)/g, '$1 $2');
    return t.trim();
}

export function createCaptioningView(videoElement) {
    const container = createElement('div', { className: 'rt-layout' });

    let isRunning = true;
    let isRunningState = true;
    let currentPrompt = PROMPTS.default;
    let abortController = null;
    let outputHistory = [];

    // ── Camera — the visual protagonist ──────────────────────
    const cameraWrap = createElement('div', { className: 'rt-camera' });
    const videoWrap = createElement('div', { className: 'rt-video-wrap' });

    if (videoElement) {
        videoElement.className = 'rt-video';
        videoWrap.appendChild(videoElement);
    }

    // Overlay controls at bottom of camera
    const overlay = createElement('div', { className: 'rt-overlay' });

    const livePill = createElement('div', { className: 'rt-live-pill' });
    livePill.innerHTML = '<span class="rt-live-dot"></span><span>Live</span>';

    const statusEl = createElement('span', { className: 'rt-status', text: 'Ready' });

    const pauseBtn = createElement('button', { className: 'rt-overlay-btn', attributes: { title: 'Pause' } });
    pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
    pauseBtn.addEventListener('click', function() {
        isRunningState = !isRunningState;
        isRunning = isRunningState;
        if (!isRunning) {
            abortController && abortController.abort();
            abortController = null;
            pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            pauseBtn.title = 'Resume';
            livePill.querySelector('.rt-live-dot').classList.add('paused');
            statusEl.textContent = 'Paused';
        } else {
            pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
            pauseBtn.title = 'Pause';
            livePill.querySelector('.rt-live-dot').classList.remove('paused');
            statusEl.textContent = 'Ready';
            startCaptioningLoop();
        }
    });

    overlay.appendChild(livePill);
    overlay.appendChild(statusEl);
    const overlayRight = createElement('div', { className: 'rt-overlay-right' });

    const snapshotBtn = createElement('button', { className: 'rt-overlay-btn rt-snapshot-labeled', attributes: { title: 'Save snapshot' } });
    snapshotBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z"/></svg><span>Snapshot</span>';
    snapshotBtn.addEventListener('click', function() {
        if (!videoElement) return;
        try {
            const c = document.createElement('canvas');
            c.width = videoElement.videoWidth || 640;
            c.height = videoElement.videoHeight || 480;
            c.getContext('2d').drawImage(videoElement, 0, 0);
            c.toBlob(function(blob) {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vlm-snapshot-' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch(e) {}
    });

    overlayRight.appendChild(snapshotBtn);
    overlayRight.appendChild(pauseBtn);
    overlay.appendChild(overlayRight);

    videoWrap.appendChild(overlay);

    // ── Live caption banner — top of camera ──────────────────
    const liveCaptionBanner = createElement('div', { className: 'rt-caption-live' });
    const liveCaptionText = createElement('p', { className: 'rt-caption-live-text', text: 'Waiting for first caption\u2026' });
    liveCaptionBanner.appendChild(liveCaptionText);

    cameraWrap.appendChild(videoWrap);
    cameraWrap.appendChild(liveCaptionBanner);

    // ── Prompt ────────────────────────────────────────────────
    const promptSection = createElement('div', { className: 'rt-prompt-section' });

    const promptBar = createElement('div', { className: 'rt-prompt-bar' });
    const promptInput = createElement('textarea', {
        className: 'rt-prompt-input',
        attributes: { placeholder: 'Ask something about the image\u2026', rows: '1' }
    });
    promptInput.value = PROMPTS.default;

    promptInput.addEventListener('input', function(e) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        clearTimeout(promptInput._debounce);
        promptInput._debounce = setTimeout(function() {
            currentPrompt = e.target.value.trim() || PROMPTS.default;
        }, 300);
    });
    promptInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    });

    const sendBtn = createElement('button', { className: 'rt-send-btn', attributes: { title: 'Send' } });
    sendBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
    sendBtn.addEventListener('click', sendPrompt);

    promptBar.appendChild(promptInput);
    promptBar.appendChild(sendBtn);

    // Suggestion chips — Apple Intelligence-style
    const suggestions = createElement('div', { className: 'rt-suggestions' });
    [
        'What objects are visible?',
        'Describe the scene',
        'Is there a person?',
        'Read any text you see',
        'What colors are prominent?',
    ].forEach(function(s) {
        var btn = createElement('button', { className: 'rt-suggestion', text: s });
        btn.addEventListener('click', function() {
            promptInput.value = s;
            currentPrompt = s;
            promptInput.dispatchEvent(new Event('input'));
            sendPrompt();
        });
        suggestions.appendChild(btn);
    });

    promptSection.appendChild(promptBar);
    promptSection.appendChild(suggestions);

    // ── Output ────────────────────────────────────────────────
    const outputSection = createElement('div', { className: 'rt-output-section' });

    const outputHeader = createElement('div', { className: 'rt-output-header' });
    const outputLabel = createElement('span', { className: 'rt-output-label', text: 'AI Response' });

    const outputActions = createElement('div', { className: 'rt-output-actions' });
    const historyBadge = createElement('span', { className: 'rt-history-badge' });

    const copyBtn = createElement('button', { className: 'rt-action-btn', attributes: { title: 'Copy response' } });
    copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>';
    copyBtn.addEventListener('click', function() {
        if (outputHistory.length > 0) {
            navigator.clipboard.writeText(outputHistory[outputHistory.length - 1]).catch(function() {});
            copyBtn.querySelector('span').textContent = 'Copied!';
            setTimeout(function() { copyBtn.querySelector('span').textContent = 'Copy'; }, 1500);
        }
    });

    const settingsBtn = createElement('button', { className: 'rt-action-btn', attributes: { title: 'Settings' } });
    settingsBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg><span>Settings</span>';

    outputActions.appendChild(copyBtn);
    outputActions.appendChild(settingsBtn);
    outputHeader.appendChild(outputLabel);
    outputHeader.appendChild(historyBadge);
    outputHeader.appendChild(outputActions);

    // Settings panel (hidden)
    const settingsPanel = createElement('div', { className: 'rt-settings hidden' });
    settingsPanel.innerHTML = '<div class="rt-settings-row"><span>Model</span><span>FastVLM-0.5B</span></div>'
        + '<div class="rt-settings-row"><span>Backend</span><span>WebGPU</span></div>'
        + '<div class="rt-settings-row"><span>Max tokens</span><span>' + MODEL_CONFIG.MAX_NEW_TOKENS + '</span></div>'
        + '<div class="rt-settings-row"><span>Frame delay</span><span>Dynamic</span></div>';
    settingsBtn.addEventListener('click', function() {
        settingsPanel.classList.toggle('hidden');
    });

    const outputText = createElement('div', { className: 'rt-output-text', text: 'Waiting for first response\u2026' });
    const outputCursor = createElement('span', { className: 'rt-cursor', text: '\u258c' });
    const outputTime = createElement('span', { className: 'rt-output-time' });

    outputSection.appendChild(outputHeader);
    outputSection.appendChild(settingsPanel);
    outputSection.appendChild(outputText);
    outputSection.appendChild(outputCursor);
    outputSection.appendChild(outputTime);

    // ── Model info bar ────────────────────────────────────────
    const modelBar = createElement('div', { className: 'rt-model-bar' });
    const modelBarLeft = createElement('div', { className: 'rt-model-bar-group' });
    const makeBarItem = function(key, val) {
        const item = createElement('div', { className: 'rt-model-bar-item' });
        const k = createElement('span', { className: 'rt-model-bar-key', text: key });
        const v = createElement('span', { className: 'rt-model-bar-value', text: val });
        item.appendChild(k);
        item.appendChild(v);
        return { item, valueEl: v };
    };
    modelBarLeft.appendChild(makeBarItem('Model', 'FastVLM-0.5B').item);
    modelBarLeft.appendChild(makeBarItem('Backend', 'WebGPU').item);
    const latencyBar = makeBarItem('Latency', '\u2014');
    modelBarLeft.appendChild(latencyBar.item);
    modelBar.appendChild(modelBarLeft);

    // ── Assemble ──────────────────────────────────────────────
    container.appendChild(cameraWrap);
    container.appendChild(promptSection);
    container.appendChild(outputSection);
    container.appendChild(modelBar);

    // ── Helpers ───────────────────────────────────────────────
    function setStatus(text, isErr) {
        statusEl.textContent = text;
        statusEl.className = 'rt-status' + (isErr ? ' error' : '');
    }

    function setThinking(steps, streamingText) {
        outputCursor.style.display = '';
        var html = steps.map(function(s, i) {
            var isActive = i === steps.length - 1;
            var cls = isActive ? ' active' : ' done';
            var prefix = isActive ? '' : '\u2713 ';
            var dots = isActive ? ' <span class="rt-dots-anim"><span></span><span></span><span></span></span>' : '';
            return '<span class="rt-thinking-step' + cls + '">' + prefix + s + dots + '</span>';
        }).join('');
        outputText.innerHTML = html + (streamingText ? '<span class="rt-streaming">' + streamingText + '</span>' : '');
    }

    function sendPrompt() {
        currentPrompt = promptInput.value.trim() || PROMPTS.default;
        if (!isRunning) {
            isRunning = true;
            isRunningState = true;
            livePill.querySelector('.rt-live-dot').classList.remove('paused');
            pauseBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
            statusEl.textContent = 'Ready';
            startCaptioningLoop();
        }
    }

    // ── Inference loop ────────────────────────────────────────
    async function startCaptioningLoop() {
        if (abortController) abortController.abort();
        abortController = new AbortController();
        const signal = abortController.signal;

        if (!vlmService) {
            const mod = await import('../services/vision-language-service.js');
            vlmService = mod.default;
        }

        if (!vlmService.getLoadedState().isLoaded) {
            setStatus('Model not loaded', true);
            return;
        }

        const loop = async () => {
            while (!signal.aborted && isRunning) {
                if (videoElement && videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
                    if (videoElement.paused) await videoElement.play().catch(() => {});
                    if (vlmService.inferenceLock) {
                        await sleep(500, signal).catch(() => {});
                        continue;
                    }
                    try {
                        const t0 = performance.now();
                        setStatus('Analyzing\u2026');
                        setThinking(['Capturing frame\u2026']);
                        let streamSteps = ['Capturing frame\u2026'];

                        const result = await vlmService.runInference(
                            videoElement,
                            currentPrompt,
                            (streamedText) => {
                                if (streamSteps.length === 1) {
                                    streamSteps = ['Capturing frame\u2026', 'Analyzing image\u2026'];
                                }
                                if (streamedText.length > 15 && streamSteps.length < 3) {
                                    streamSteps = ['Capturing frame\u2026', 'Analyzing image\u2026', 'Generating response\u2026'];
                                }
                                setThinking(streamSteps, streamedText);
                                if (streamedText) liveCaptionText.textContent = streamedText;
                            }
                        );

                        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
                        if (result && !signal.aborted) {
                            const clean = postProcessCaption(result);
                            outputHistory.push(clean);
                            historyBadge.textContent = outputHistory.length + (outputHistory.length === 1 ? ' response' : ' responses');
                            outputText.textContent = clean;
                            outputText.className = 'rt-output-text ready';
                            liveCaptionText.textContent = clean;
                            liveCaptionBanner.classList.add('has-text');
                            outputCursor.style.display = 'none';
                            outputTime.textContent = new Date().toLocaleTimeString();
                            latencyBar.valueEl.textContent = elapsed + 's';
                            setStatus('Ready \u00b7 ' + elapsed + 's');
                        }
                        if (!signal.aborted) {
                            await sleep(vlmService.getDynamicFrameDelay(), signal).catch(() => {});
                        }
                    } catch (error) {
                        if (!signal.aborted) {
                            setStatus('Error', true);
                            outputText.textContent = error.message;
                            outputCursor.style.display = 'none';
                            await sleep(2000, signal).catch(() => {});
                        }
                    }
                } else {
                    await sleep(100, signal).catch(() => {});
                }
                if (signal.aborted) break;
            }
        };

        setTimeout(loop, 0);
    }

    startCaptioningLoop();

    container.cleanup = function() { abortController && abortController.abort(); };
    return container;
}