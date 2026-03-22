/**
 * Telemetry Module
 * Tracks QoS metrics, performance monitoring, and dynamic frame rate adjustment
 */

import { QOS_PROFILES } from '../utils/constants.js';

export class TelemetryService {
    constructor() {
        this.lastInferenceTime = 0;
        this.avgInferenceTime = 3000; // Initial estimate: 3s
        this.inferenceHistory = []; // Track last 5 inference times
        this.maxHistorySize = 5;
    }

    /**
     * Record inference timing
     * @param {number} elapsedTime - Inference duration in milliseconds
     */
    recordInferenceTime(elapsedTime) {
        this.lastInferenceTime = elapsedTime;
        this.inferenceHistory.push(elapsedTime);

        if (this.inferenceHistory.length > this.maxHistorySize) {
            this.inferenceHistory.shift();
        }

        this.avgInferenceTime =
            this.inferenceHistory.reduce((a, b) => a + b, 0) / this.inferenceHistory.length;
    }

    /**
     * Get average inference time
     * @returns {number} Average time in milliseconds
     */
    getAverageInferenceTime() {
        return this.avgInferenceTime;
    }

    /**
     * Get last inference time
     * @returns {number} Last time in milliseconds
     */
    getLastInferenceTime() {
        return this.lastInferenceTime;
    }

    /**
     * Get inference history (last N measurements)
     * @returns {Array<number>} Array of inference times
     */
    getInferenceHistory() {
        return [...this.inferenceHistory];
    }

    /**
     * Calculate optimal delay based on hardware profile and average inference time
     * @param {string} performanceTier - Current hardware performance tier
     * @returns {number} Recommended frame delay in milliseconds
     */
    getDynamicFrameDelay(performanceTier) {
        const currentProfile = QOS_PROFILES[performanceTier] || QOS_PROFILES.high;

        // Calculate optimal delay based on average inference time (add 20% breathing room buffer),
        // but never drop below the hardware profile's safety threshold ceiling.
        const recommendedDelay = Math.max(
            currentProfile.TIMING_DELAY_MS,
            this.avgInferenceTime * 1.2
        );

        return recommendedDelay;
    }

    /**
     * Mark performance measurement start point
     * @param {string} markName - Unique mark name
     */
    markStart(markName) {
        performance.mark(markName);
    }

    /**
     * Create a performance measurement between two marks
     * @param {string} measureName - Name of the measurement
     * @param {string} startMark - Start mark name
     * @param {string} endMark - End mark name
     * @returns {PerformanceMeasure|null} Performance measure or null if failed
     */
    measure(measureName, startMark, endMark) {
        try {
            return performance.measure(measureName, startMark, endMark);
        } catch (e) {
            return null;
        }
    }

    /**
     * Get a specific performance measurement by name
     * @param {string} name - Measurement name
     * @returns {Array<PerformanceMeasure>} Array of matching measurements
     */
    getMeasurement(name) {
        return performance.getEntriesByName(name);
    }

    /**
     * Get all performance marks
     * @returns {Array<PerformanceMark>} Array of all marks
     */
    getAllMarks() {
        return performance.getEntriesByType('mark');
    }

    /**
     * Get all performance measurements
     * @returns {Array<PerformanceMeasure>} Array of all measurements
     */
    getAllMeasures() {
        return performance.getEntriesByType('measure');
    }

    /**
     * Clear all performance marks and measures
     */
    clearPerformanceData() {
        performance.clearMarks();
        performance.clearMeasures();
    }

    /**
     * Get telemetry summary
     * @returns {Object} Current telemetry metrics
     */
    getTelemetrySummary() {
        return {
            lastInferenceTime: this.lastInferenceTime,
            avgInferenceTime: this.avgInferenceTime,
            historySize: this.inferenceHistory.length,
            historyValues: [...this.inferenceHistory],
        };
    }

    /**
     * Get estimated FPS based on current inference time
     * @returns {number} Estimated frames per second
     */
    getEstimatedFPS(performanceTier) {
        const delay = this.getDynamicFrameDelay(performanceTier);
        return Math.round((1000 / delay) * 100) / 100; // Round to 2 decimals
    }

    /**
     * Reset telemetry data
     */
    reset() {
        this.lastInferenceTime = 0;
        this.avgInferenceTime = 3000;
        this.inferenceHistory = [];
    }
}

export default new TelemetryService();
