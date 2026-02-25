// @ts-check

/**
 * Diagnostics Panel Component
 * Shows WebGPU info, performance metrics, and system diagnostics
 */

import { createElement } from '../utils/dom-helpers.js';
import { createGlassContainer } from './glass-container.js';
import webgpuDetector from '../utils/webgpu-detector.js';
import logger from '../utils/logger.js';

export function createDiagnosticsPanel() {
    let isVisible = false;
    let vlmService = null;
    let updateInterval = null;

    // Main container (hidden by default)
    const container = createGlassContainer({
        className: 'diagnostics-panel rounded-2xl shadow-2xl',
        children: []
    });

    container.style.display = 'none';

    // Header
    const header = createElement('div', {
        className: 'diagnostics-header'
    });

    const title = createElement('h3', {
        className: 'text-sm font-semibold text-gray-200',
        text: '⚙️ System Diagnostics'
    });

    const closeBtn = createElement('button', {
        className: 'glass-button text-xs px-3 py-1',
        text: '✕',
        attributes: { 'aria-label': 'Close diagnostics' }
    });

    closeBtn.addEventListener('click', () => {
        hide();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);

    // Content sections
    const content = createElement('div', {
        className: 'diagnostics-content'
    });

    // GPU Section
    const gpuSection = createSection('🎮 GPU Information');
    const gpuContent = createElement('div', {
        className: 'diagnostics-metrics'
    });
    gpuSection.appendChild(gpuContent);

    // Model Section
    const modelSection = createSection('🤖 Model State');
    const modelContent = createElement('div', {
        className: 'diagnostics-metrics'
    });
    modelSection.appendChild(modelContent);

    // Performance Section
    const perfSection = createSection('⚡ Performance');
    const perfContent = createElement('div', {
        className: 'diagnostics-metrics'
    });
    perfSection.appendChild(perfContent);

    // Logs Section
    const logsSection = createSection('📋 Logs');
    const logsContent = createElement('div', {
        className: 'diagnostics-logs'
    });

    const logStats = createElement('div', {
        className: 'text-xs text-gray-400 mb-2'
    });

    const exportLogsBtn = createElement('button', {
        className: 'glass-button text-xs px-3 py-1 mr-2',
        text: '📥 Export Logs'
    });

    exportLogsBtn.addEventListener('click', () => {
        logger.downloadLogs();
    });

    const clearLogsBtn = createElement('button', {
        className: 'glass-button text-xs px-3 py-1',
        text: '🗑️ Clear Logs'
    });

    clearLogsBtn.addEventListener('click', () => {
        logger.clear();
        updateLogs();
    });

    logsContent.appendChild(logStats);
    logsContent.appendChild(exportLogsBtn);
    logsContent.appendChild(clearLogsBtn);
    logsSection.appendChild(logsContent);

    // Assemble
    content.appendChild(gpuSection);
    content.appendChild(modelSection);
    content.appendChild(perfSection);
    content.appendChild(logsSection);

    container.appendChild(header);
    container.appendChild(content);

    /**
     * Create section with title
     * @param {string} title
     * @returns {HTMLElement}
     */
    function createSection(title) {
        const section = createElement('div', {
            className: 'diagnostics-section'
        });

        const sectionTitle = createElement('h4', {
            className: 'text-xs font-semibold text-gray-300 mb-2',
            text: title
        });

        section.appendChild(sectionTitle);
        return section;
    }

    /**
     * Create metric row
     * @param {string} label
     * @param {string} value
     * @param {string} [color='text-gray-200']
     * @returns {HTMLElement}
     */
    function createMetric(label, value, color = 'text-gray-200') {
        const row = createElement('div', {
            className: 'diagnostics-metric-row'
        });

        const labelEl = createElement('span', {
            className: 'text-xs text-gray-400',
            text: label + ':'
        });

        const valueEl = createElement('span', {
            className: `text-xs font-mono ${color}`,
            text: value
        });

        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
    }

    /**
     * Update GPU info
     */
    async function updateGPUInfo() {
        gpuContent.innerHTML = '';

        try {
            const gpuInfo = await webgpuDetector.detect();
            const perfEstimate = webgpuDetector.getPerformanceEstimate();

            gpuContent.appendChild(createMetric(
                'WebGPU Support',
                gpuInfo.supported ? '✅ Yes' : '❌ No',
                gpuInfo.supported ? 'text-green-400' : 'text-red-400'
            ));

            gpuContent.appendChild(createMetric(
                'FP16 Support',
                gpuInfo.fp16Available ? '✅ Yes' : '❌ No',
                gpuInfo.fp16Available ? 'text-green-400' : 'text-yellow-400'
            ));

            if (gpuInfo.adapter) {
                gpuContent.appendChild(createMetric(
                    'Adapter',
                    gpuInfo.adapter
                ));
            }

            if (gpuInfo.limits) {
                const maxBufferSize = (gpuInfo.limits.maxBufferSize / 1024 / 1024).toFixed(0);
                gpuContent.appendChild(createMetric(
                    'Max Buffer',
                    `${maxBufferSize} MB`
                ));

                gpuContent.appendChild(createMetric(
                    'Max Texture Size',
                    `${gpuInfo.limits.maxTextureDimension2D}px`
                ));
            }

            gpuContent.appendChild(createMetric(
                'Performance Tier',
                perfEstimate.tier.toUpperCase(),
                perfEstimate.tier === 'high' ? 'text-green-400' : 
                perfEstimate.tier === 'medium' ? 'text-yellow-400' : 'text-red-400'
            ));

            gpuContent.appendChild(createMetric(
                'Expected Latency',
                perfEstimate.expectedLatency
            ));

        } catch (error) {
            gpuContent.appendChild(createMetric(
                'Error',
                error.message,
                'text-red-400'
            ));
        }
    }

    /**
     * Update model state
     */
    async function updateModelState() {
        modelContent.innerHTML = '';

        if (!vlmService) {
            try {
                const module = await import('../services/vision-language-service.js');
                vlmService = module.default;
            } catch {
                modelContent.appendChild(createMetric('Status', 'Not loaded'));
                return;
            }
        }

        const state = vlmService.getLoadedState();

        modelContent.appendChild(createMetric(
            'Status',
            state.isLoaded ? '✅ Loaded' : state.isLoading ? '⏳ Loading...' : '❌ Not loaded',
            state.isLoaded ? 'text-green-400' : 'text-yellow-400'
        ));

        modelContent.appendChild(createMetric(
            'Warmed Up',
            state.warmedUp ? '✅ Yes' : '❌ No',
            state.warmedUp ? 'text-green-400' : 'text-gray-400'
        ));

        if (state.isLoaded) {
            modelContent.appendChild(createMetric(
                'Avg Inference',
                `${(state.avgInferenceTime / 1000).toFixed(2)}s`
            ));
        }
    }

    /**
     * Update performance metrics
     */
    async function updatePerformance() {
        perfContent.innerHTML = '';

        if (!vlmService) return;

        const state = vlmService.getLoadedState();

        if (state.isLoaded && state.avgInferenceTime > 0) {
            const avgTimeSec = state.avgInferenceTime / 1000;
            perfContent.appendChild(createMetric(
                'Avg Inference Time',
                `${avgTimeSec.toFixed(2)}s`
            ));

            // Estimate tokens/s (assuming ~50 tokens per inference)
            const tokensPerSecond = (50 / avgTimeSec).toFixed(1);
            perfContent.appendChild(createMetric(
                'Est. Tokens/s',
                tokensPerSecond
            ));

            // FPS equivalent
            const fps = (1 / avgTimeSec).toFixed(2);
            perfContent.appendChild(createMetric(
                'Max FPS',
                fps + ' fps'
            ));

            // Estimated memory (rough approximation)
            // FastVLM 0.5B ~2GB model size
            const estimatedMemory = '~2000 MB';
            perfContent.appendChild(createMetric(
                'Est. Memory',
                estimatedMemory
            ));

            // Browser info
            perfContent.appendChild(createMetric(
                'User Agent',
                navigator.userAgent.includes('Chrome') ? 'Chrome' :
                navigator.userAgent.includes('Firefox') ? 'Firefox' :
                navigator.userAgent.includes('Safari') ? 'Safari' : 'Other'
            ));
        } else {
            perfContent.appendChild(createMetric(
                'Status',
                'No performance data yet',
                'text-gray-400'
            ));
        }
    }

    /**
     * Update log statistics
     */
    function updateLogs() {
        const stats = logger.getStats();
        logStats.textContent = `Total: ${stats.total} | Debug: ${stats.debug} | Info: ${stats.info} | Warn: ${stats.warn} | Error: ${stats.error}`;
    }

    /**
     * Update all sections
     */
    async function updateAll() {
        await updateGPUInfo();
        await updateModelState();
        await updatePerformance();
        updateLogs();
    }

    /**
     * Show diagnostics panel
     */
    function show() {
        isVisible = true;
        container.style.display = 'flex';
        updateAll();

        // Auto-refresh every 2 seconds
        if (updateInterval) clearInterval(updateInterval);
        updateInterval = setInterval(() => {
            updateAll();
        }, 2000);

        logger.info('Diagnostics panel opened');
    }

    /**
     * Hide diagnostics panel
     */
    function hide() {
        isVisible = false;
        container.style.display = 'none';

        if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
        }

        logger.info('Diagnostics panel closed');
    }

    /**
     * Toggle visibility
     */
    function toggle() {
        if (isVisible) {
            hide();
        } else {
            show();
        }
    }

    // Public API
    return {
        element: container,
        show,
        hide,
        toggle,
        isVisible: () => isVisible,
        update: updateAll
    };
}
