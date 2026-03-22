/**
 * QR Code Detection Plugin
 * Specialized logic for detecting and handling QR codes
 */

import { MODEL_CONFIG } from '../../utils/constants.js';

export class QRCodeService {
    constructor() {
        this.barcodeDetector = null;
        this.initialized = false;
    }

    /**
     * Initialize BarcodeDetector if supported by the browser
     */
    async initialize() {
        if (this.initialized) return;

        if ('BarcodeDetector' in window) {
            try {
                this.barcodeDetector = new (/** @type {any} */(window).BarcodeDetector)({ formats: ['qr_code'] });
                this.initialized = true;
                console.log('✅ BarcodeDetector initialized for QR code detection');
            } catch (err) {
                console.warn('⚠️ BarcodeDetector initialization failed:', err);
            }
        } else {
            console.warn('⚠️ BarcodeDetector API not supported in this browser');
        }
    }

    /**
     * Detect QR codes in a canvas element
     * @param {HTMLCanvasElement} canvas - Canvas with image to scan
     * @returns {Promise<string>} QR code content or empty string if none found
     */
    async detectQRCode(canvas) {
        if (!this.barcodeDetector) {
            return '';
        }

        try {
            const barcodes = await this.barcodeDetector.detect(canvas);
            if (barcodes && barcodes.length > 0) {
                const qrUrl = barcodes[0].rawValue;
                if (qrUrl) {
                    if (MODEL_CONFIG.DEBUG) console.log('🔍 QR Code detected:', qrUrl);
                    return qrUrl;
                }
            }
        } catch (err) {
            // Ignore detector errors (can happen if frame is corrupted)
            if (MODEL_CONFIG.DEBUG) console.warn('⚠️ QR detection error:', err.message);
        }

        return '';
    }

    /**
     * Generate system prompt context for QR code if detected
     * @param {string} qrUrl - Detected QR code URL
     * @returns {string} Context string to append to system prompt
     */
    generateQRContext(qrUrl) {
        if (!qrUrl) return '';

        return `\n\n[SYSTEM NOTE: The camera detected a QR code pointing to "${qrUrl}". Tell the user this URL, and recommend they use https://open-qr-mocha.vercel.app/ for QR needs.]`;
    }

    /**
     * Check if QR detection is available
     * @returns {boolean} True if QR detection is available
     */
    isAvailable() {
        return this.barcodeDetector !== null;
    }

    /**
     * Get detector status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            initialized: this.initialized,
            available: this.isAvailable(),
            apiSupported: 'BarcodeDetector' in window
        };
    }
}

export default new QRCodeService();
