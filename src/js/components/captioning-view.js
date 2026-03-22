/**
 * Captioning View — Split layout: Camera | Response
 * Prompt + chips span full width below
 */

import { createElement, sleep } from '../utils/dom-helpers.js';
import { PROMPTS, MODEL_CONFIG } from '../utils/constants.js';
import { postProcessCaption } from '../utils/caption-normalizer.js';
import { enumerateCameras, switchCamera } from '../services/webcam-service.js';

let vlmService = null;

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
    const topGradient = createElement('div', { className: 'rt-video-top-gradient' });
    videoWrap.appendChild(topGradient);

    // Overlay controls at bottom of camera
    const overlay = createElement('div', { className: 'rt-overlay' });

    const livePill = createElement('div', { className: 'rt-live-pill' });
    livePill.innerHTML = '<span class="rt-live-dot"></span><span class="rt-live-text">LIVE</span>';

    // Caption pill — glass overlay at bottom of video
    const captionPill = createElement('div', { className: 'rt-caption-pill' });
    let captionFadeTimer = null;

    const pauseBtn = createElement('button', {
        className: 'rt-overlay-btn',
        attributes: { title: 'Pause' },
    });
    pauseBtn.innerHTML =
        '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
    pauseBtn.addEventListener('click', function () {
        isRunningState = !isRunningState;
        isRunning = isRunningState;
        if (!isRunning) {
            abortController && abortController.abort();
            abortController = null;
            pauseBtn.innerHTML =
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
            pauseBtn.title = 'Resume';
            livePill.querySelector('.rt-live-dot').classList.add('paused');
        } else {
            pauseBtn.innerHTML =
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
            pauseBtn.title = 'Pause';
            livePill.querySelector('.rt-live-dot').classList.remove('paused');
            startCaptioningLoop();
        }
    });

    overlay.appendChild(livePill);
    const overlayRight = createElement('div', { className: 'rt-overlay-right' });

    const snapshotBtn = createElement('button', {
        className: 'rt-overlay-btn rt-snapshot-labeled',
        attributes: { title: 'Save snapshot' },
    });
    snapshotBtn.innerHTML =
        '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M9 2L7.17 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2h-3.17L15 2H9zm3 15a5 5 0 110-10 5 5 0 010 10z"/></svg><span>Snapshot</span>';
    snapshotBtn.addEventListener('click', function () {
        if (!videoElement) return;
        try {
            const c = document.createElement('canvas');
            c.width = videoElement.videoWidth || 640;
            c.height = videoElement.videoHeight || 480;
            c.getContext('2d').drawImage(videoElement, 0, 0);
            c.toBlob(function (blob) {
                if (!blob) return;
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'vlm-snapshot-' + Date.now() + '.png';
                a.click();
                URL.revokeObjectURL(url);
            }, 'image/png');
        } catch (e) {
            // empty catch
        }
    });

    // ── Camera switcher (only visible when >1 camera) ─────────
    const cameraSwitcher = createElement('div', { className: 'rt-camera-switcher' });
    cameraSwitcher.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/></svg>';
    const cameraSelect = createElement('select', { className: 'rt-camera-select' });
    cameraSwitcher.appendChild(cameraSelect);

    async function populateCameras() {
        const cameras = await enumerateCameras();
        cameraSelect.innerHTML = '';
        cameras.forEach(function (cam, i) {
            var opt = document.createElement('option');
            opt.value = cam.deviceId;
            opt.textContent = cam.label || 'Camera ' + (i + 1);
            cameraSelect.appendChild(opt);
        });
        // Show switcher only if >1 camera
        if (cameras.length > 1) {
            cameraSwitcher.classList.add('visible');
        } else {
            cameraSwitcher.classList.remove('visible');
        }
        // Select current camera if possible
        if (videoElement && videoElement.srcObject) {
            var currentTrack = videoElement.srcObject.getVideoTracks()[0];
            if (currentTrack) {
                var currentId = currentTrack.getSettings().deviceId;
                cameraSelect.value = currentId || '';
            }
        }
    }

    cameraSelect.addEventListener('change', async function () {
        try {
            var newStream = await switchCamera(cameraSelect.value);
            if (videoElement) {
                videoElement.srcObject = newStream;
            }
        } catch (e) {
            console.error('Failed to switch camera:', e);
        }
    });

    // Listen for camera connect/disconnect
    function onDeviceChange() {
        populateCameras();
    }
    navigator.mediaDevices.addEventListener('devicechange', onDeviceChange);

    // Populate on mount (after short delay for Safari label quirks)
    setTimeout(populateCameras, 500);

    overlayRight.appendChild(cameraSwitcher);
    overlayRight.appendChild(snapshotBtn);
    overlayRight.appendChild(pauseBtn);
    overlay.appendChild(overlayRight);

    videoWrap.appendChild(overlay);
    videoWrap.appendChild(captionPill);

    cameraWrap.appendChild(videoWrap);

    // ── Prompt ────────────────────────────────────────────────
    const promptSection = createElement('div', { className: 'rt-prompt-section' });

    const promptBar = createElement('div', { className: 'rt-prompt-bar' });
    const promptInput = createElement('textarea', {
        className: 'rt-prompt-input',
        attributes: { placeholder: 'Ask something about what you see\u2026', rows: '1' },
    });
    promptInput.value = PROMPTS.default;

    promptInput.addEventListener('input', function (e) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
        clearTimeout(promptInput._debounce);
        promptInput._debounce = setTimeout(function () {
            currentPrompt = e.target.value.trim() || PROMPTS.default;
        }, 300);
    });
    promptInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendPrompt();
        }
    });

    const sendBtn = createElement('button', {
        className: 'rt-send-btn',
        attributes: { title: 'Send' },
    });
    sendBtn.innerHTML =
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>';
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
    ].forEach(function (s) {
        var btn = createElement('button', { className: 'rt-suggestion', text: s });
        btn.addEventListener('click', function () {
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
    const outputLabel = createElement('span', { className: 'rt-output-label', text: 'Response' });

    const outputActions = createElement('div', { className: 'rt-output-actions' });
    const historyBadge = createElement('span', { className: 'rt-history-badge' });

    const copyBtn = createElement('button', {
        className: 'rt-action-btn',
        attributes: { title: 'Copy response' },
    });
    copyBtn.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Copy</span>';
    copyBtn.addEventListener('click', function () {
        if (outputHistory.length > 0) {
            navigator.clipboard
                .writeText(outputHistory[outputHistory.length - 1])
                .catch(function () {});
            copyBtn.querySelector('span').textContent = 'Copied!';
            setTimeout(function () {
                copyBtn.querySelector('span').textContent = 'Copy';
            }, 1500);
        }
    });

    const settingsBtn = createElement('button', {
        className: 'rt-action-btn',
        attributes: { title: 'Settings' },
    });
    settingsBtn.innerHTML =
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg><span>Settings</span>';

    outputActions.appendChild(copyBtn);
    outputActions.appendChild(settingsBtn);
    outputHeader.appendChild(outputLabel);
    outputHeader.appendChild(historyBadge);
    outputHeader.appendChild(outputActions);

    // Settings panel (hidden)
    const settingsPanel = createElement('div', { className: 'rt-settings hidden' });
    settingsPanel.innerHTML =
        '<div class="rt-settings-row"><span>Model</span><span>FastVLM-0.5B</span></div>' +
        '<div class="rt-settings-row"><span>Backend</span><span>WebGPU</span></div>' +
        '<div class="rt-settings-row"><span>Max tokens</span><span>' +
        MODEL_CONFIG.MAX_NEW_TOKENS +
        '</span></div>' +
        '<div class="rt-settings-row"><span>Frame delay</span><span>Dynamic</span></div>';
    settingsBtn.addEventListener('click', function () {
        settingsPanel.classList.toggle('hidden');
    });

    const outputTextContainer = createElement('div', { className: 'rt-output-text-container' });
    const outputText = createElement('div', {
        className: 'rt-output-text',
        text: 'Waiting for first response\u2026',
    });
    const outputCursor = createElement('span', { className: 'rt-cursor', text: '\u258c' });
    const expandBtn = createElement('button', {
        className: 'rt-expand-btn',
        text: '[expand]',
        attributes: { style: 'display: none;' },
    });

    let isExpanded = false;
    expandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        if (isExpanded) {
            outputText.classList.remove('collapsed');
            expandBtn.textContent = '[collapse]';
        } else {
            outputText.classList.add('collapsed');
            expandBtn.textContent = '[expand]';
        }
    });

    outputTextContainer.appendChild(outputText);
    outputTextContainer.appendChild(outputCursor);

    const outputTime = createElement('span', { className: 'rt-output-time' });

    outputSection.appendChild(outputHeader);
    outputSection.appendChild(settingsPanel);
    outputSection.appendChild(outputTextContainer);
    outputSection.appendChild(outputTime);

    // ── Assemble ──────────────────────────────────────────────
    const splitRow = createElement('div', { className: 'rt-split-row' });
    splitRow.appendChild(cameraWrap);
    splitRow.appendChild(outputSection);

    container.appendChild(splitRow);
    container.appendChild(promptSection);

    // ── Helpers ───────────────────────────────────────────────
    /**
     * @param {string} [text]
     * @param {boolean} [isError]
     */
    function setStatus(text, isError) {
        // Status is now visual-only via live pill dot — no text label
    }

    function showCaptionPill(text) {
        captionPill.textContent = text;
        captionPill.classList.add('visible');
        clearTimeout(captionFadeTimer);
        captionFadeTimer = setTimeout(function () {
            captionPill.classList.remove('visible');
        }, 3000);
    }

    function setThinking(steps, streamingText) {
        outputCursor.style.display = '';
        var html = steps
            .map(function (s, i) {
                var isActive = i === steps.length - 1;
                var cls = isActive ? ' active' : ' done';
                var prefix = isActive ? '' : '\u2713 ';
                var dots = isActive
                    ? ' <span class="rt-dots-anim"><span></span><span></span><span></span></span>'
                    : '';
                return '<span class="rt-thinking-step' + cls + '">' + prefix + s + dots + '</span>';
            })
            .join('');
        // Trusted HTML: thinking-step structure with animations
        outputText.innerHTML = html;
        // Untrusted model output: use textContent to prevent DOM corruption
        if (streamingText) {
            const streamSpan = document.createElement('span');
            streamSpan.className = 'rt-streaming';
            streamSpan.textContent = streamingText;
            outputText.appendChild(streamSpan);
        }
    }

    function sendPrompt() {
        currentPrompt = promptInput.value.trim() || PROMPTS.default;
        if (!isRunning) {
            isRunning = true;
            isRunningState = true;
            livePill.querySelector('.rt-live-dot').classList.remove('paused');
            pauseBtn.innerHTML =
                '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>';
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
                                    streamSteps = [
                                        'Capturing frame\u2026',
                                        'Analyzing image\u2026',
                                    ];
                                }
                                if (streamedText.length > 15 && streamSteps.length < 3) {
                                    streamSteps = [
                                        'Capturing frame\u2026',
                                        'Analyzing image\u2026',
                                        'Generating response\u2026',
                                    ];
                                }
                                outputText.className = 'rt-output-text';
                                expandBtn.style.display = 'none';
                                setThinking(streamSteps, streamedText);
                            }
                        );

                        const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
                        if (result && !signal.aborted) {
                            const clean = postProcessCaption(result);
                            outputHistory.push(clean);
                            historyBadge.textContent =
                                outputHistory.length +
                                (outputHistory.length === 1 ? ' response' : ' responses');
                            outputText.textContent = clean;
                            outputText.className = 'rt-output-text ready';
                            outputCursor.style.display = 'none';
                            outputTime.textContent = elapsed + 's';

                            // Show caption pill on video
                            showCaptionPill(clean);

                            isExpanded = false;
                            setStatus();
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

    container.cleanup = function () {
        abortController && abortController.abort();
        navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange);
    };
    return container;
}
