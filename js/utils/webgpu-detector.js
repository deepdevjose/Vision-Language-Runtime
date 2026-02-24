/**
 * WebGPU Feature Detector
 * Detects WebGPU support and available features (especially FP16/shader-f16)
 * 
 * Run this early in the app lifecycle to verify GPU capabilities.
 * Critical for mobile devices like Samsung S24+ where FP16 can double performance.
 * 
 * NOTE: WebGPU ≠ WebGL
 * - WebGL (2011): Used by Three.js, widely supported
 * - WebGPU (2023): New API, better performance, required by Transformers.js
 */

class WebGPUDetector {
    constructor() {
        this.adapter = null;
        this.device = null;
        this.features = new Set();
        this.limits = {};
        this.info = {};
        this.browserInfo = this.detectBrowser();
    }

    /**
     * Detect browser type and version
     * @returns {Object} Browser info
     */
    detectBrowser() {
        const userAgent = navigator.userAgent;
        const info = {
            name: 'Unknown',
            version: 'Unknown',
            isChrome: false,
            isEdge: false,
            isFirefox: false,
            isSafari: false,
            isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
        };

        // Detect browser
        if (userAgent.indexOf('Edg/') > -1) {
            info.name = 'Edge';
            info.isEdge = true;
            info.version = userAgent.match(/Edg\/(\d+)/)?.[1] || 'Unknown';
        } else if (userAgent.indexOf('Chrome/') > -1) {
            info.name = 'Chrome';
            info.isChrome = true;
            info.version = userAgent.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
        } else if (userAgent.indexOf('Firefox/') > -1) {
            info.name = 'Firefox';
            info.isFirefox = true;
            info.version = userAgent.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
        } else if (userAgent.indexOf('Safari/') > -1 && userAgent.indexOf('Chrome') === -1) {
            info.name = 'Safari';
            info.isSafari = true;
            info.version = userAgent.match(/Version\/(\d+)/)?.[1] || 'Unknown';
        }

        return info;
    }

    /**
     * Detect WebGPU availability and features
     * @returns {Promise<Object>} Detection results
     */
    async detect() {
        const result = {
            supported: false,
            fp16Available: false,
            features: [],
            adapter: null,
            limits: {},
            vendor: 'Unknown',
            architecture: 'Unknown'
        };

        try {
            // Check if WebGPU is available
            if (!navigator.gpu) {
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ WebGPU Not Available');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error(`Browser: ${this.browserInfo.name} ${this.browserInfo.version}`);
                console.error(`Device: ${this.browserInfo.isMobile ? 'Mobile' : 'Desktop'}`);
                console.error('');
                console.error('ℹ️  WebGPU vs WebGL:');
                console.error('   • WebGL (used by Three.js): ✅ Your browser supports this');
                console.error('   • WebGPU (used by Transformers.js): ❌ Not available');
                console.error('');
                this.showEnableInstructions();
                return result;
            }

            // Request adapter
            this.adapter = await navigator.gpu.requestAdapter({
                powerPreference: 'high-performance'
            });

            if (!this.adapter) {
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('❌ WebGPU Adapter Failed');
                console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.error('navigator.gpu exists, but no adapter could be requested.');
                console.error('This might mean:');
                console.error('  • WebGPU is disabled in browser flags');
                console.error('  • GPU drivers are incompatible');
                console.error('  • Running in a VM or remote desktop');
                console.error('');
                this.showEnableInstructions();
                return result;
            }

            result.supported = true;
            result.adapter = this.adapter.info?.description || 'Unknown GPU';
            result.vendor = this.adapter.info?.vendor || 'Unknown';
            result.architecture = this.adapter.info?.architecture || 'Unknown';

            // Get all available features
            this.features = this.adapter.features;
            result.features = Array.from(this.features);
            
            // Check for FP16 support (shader-f16 feature)
            result.fp16Available = this.features.has('shader-f16');

            // Get adapter limits
            this.limits = this.adapter.limits;
            result.limits = {
                maxBufferSize: this.formatBytes(this.limits.maxBufferSize),
                maxStorageBufferBindingSize: this.formatBytes(this.limits.maxStorageBufferBindingSize),
                maxComputeWorkgroupSizeX: this.limits.maxComputeWorkgroupSizeX,
                maxComputeWorkgroupsPerDimension: this.limits.maxComputeWorkgroupsPerDimension,
                maxBindGroups: this.limits.maxBindGroups
            };

            // Log detection results
            this.logResults(result);

            return result;

        } catch (error) {
            console.error('❌ WebGPU detection failed:', error);
            return result;
        }
    }

    /**
     * Request a WebGPU device with optimal features
     * Automatically requests FP16 if available
     * @returns {Promise<GPUDevice>}
     */
    async requestDevice() {
        if (!this.adapter) {
            await this.detect();
        }

        if (!this.adapter) {
            throw new Error('No WebGPU adapter available');
        }

        try {
            // Build feature list - request FP16 if available
            const requiredFeatures = [];
            
            if (this.features.has('shader-f16')) {
                requiredFeatures.push('shader-f16');
                console.log('✅ Requesting shader-f16 feature (FP16 support)');
            }

            // Request device with features
            this.device = await this.adapter.requestDevice({
                requiredFeatures
            });

            console.log('🎮 WebGPU device created with features:', requiredFeatures);

            // Handle device lost events
            this.device.lost.then((info) => {
                console.error('🔌 WebGPU device lost:', info.message);
            });

            return this.device;

        } catch (error) {
            console.error('❌ Failed to create WebGPU device:', error);
            throw error;
        }
    }

    /**
     * Format bytes to human-readable format
     * @param {number} bytes 
     * @returns {string}
     */
    formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    /**
     * Show instructions for enabling WebGPU based on browser
     */
    showEnableInstructions() {
        const { name, version, isChrome, isEdge, isFirefox, isSafari, isMobile } = this.browserInfo;

        console.error('📖 How to enable WebGPU:');
        console.error('');

        if (isChrome || isEdge) {
            const minVersion = 113;
            const currentVersion = parseInt(version);
            
            if (!isNaN(currentVersion) && currentVersion < minVersion) {
                console.error(`⚠️  Your ${name} version (${version}) is too old`);
                console.error(`   Minimum required: ${name} ${minVersion}+`);
                console.error(`   👉 Update your browser: chrome://settings/help`);
            } else {
                console.error(`✅ ${name} ${version} should support WebGPU`);
                console.error('');
                console.error('👉 Enable WebGPU:');
                console.error('   1. Open: chrome://flags');
                if (isMobile) {
                    console.error('   2. Search: "webgpu-developer-features"');
                    console.error('   3. Enable: "Unsafe WebGPU Support"');
                } else {
                    console.error('   2. Search: "unsafe-webgpu"');
                    console.error('   3. Enable: "Unsafe WebGPU"');
                }
                console.error('   4. Restart browser');
                console.error('');
                console.error('   Alternative URL: chrome://flags/#enable-unsafe-webgpu');
            }
        } else if (isFirefox) {
            const minVersion = 141;
            const currentVersion = parseInt(version);
            
            if (!isNaN(currentVersion) && currentVersion < minVersion) {
                console.error(`⚠️  Your Firefox version (${version}) is too old`);
                console.error(`   Minimum required: Firefox ${minVersion}+ (Nightly)`);
                console.error(`   👉 Download Firefox Nightly: https://www.mozilla.org/firefox/nightly`);
            } else {
                console.error('✅ Firefox Nightly should support WebGPU');
                console.error('');
                console.error('👉 Enable WebGPU:');
                console.error('   1. Open: about:config');
                console.error('   2. Search: "dom.webgpu.enabled"');
                console.error('   3. Set to: true');
                console.error('   4. Restart Firefox');
            }
        } else if (isSafari) {
            console.error('ℹ️  Safari has partial WebGPU support');
            console.error('   Minimum required: Safari 18+ (macOS Sonoma 14.4+)');
            console.error('   👉 Update macOS and Safari to the latest version');
        } else {
            console.error('⚠️  Unknown browser - WebGPU may not be supported');
            console.error('   Recommended browsers:');
            console.error('   • Chrome 113+');
            console.error('   • Edge 113+');
            console.error('   • Firefox 141+ (Nightly)');
            console.error('   • Safari 18+ (macOS 14.4+)');
        }

        console.error('');
        console.error('🔗 Test WebGPU support: https://webgpu.io');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    /**
     * Log detection results to console
     * @param {Object} result Detection results
     */
    logResults(result) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 WebGPU Feature Detection');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🌐 Browser: ${this.browserInfo.name} ${this.browserInfo.version}`);
        console.log(`📱 Device: ${this.browserInfo.isMobile ? 'Mobile' : 'Desktop'}`);
        console.log(`🎮 WebGPU Support: ${result.supported ? '✅' : '❌'}`);
        
        if (result.supported) {
            console.log(`📊 Adapter: ${result.adapter}`);
            console.log(`🏢 Vendor: ${result.vendor}`);
            console.log(`🏗️  Architecture: ${result.architecture}`);
            console.log(`🔧 FP16 (shader-f16): ${result.fp16Available ? '✅ AVAILABLE' : '❌ NOT AVAILABLE'}`);
            console.log(`\n📋 Available Features (${result.features.length}):`);
            result.features.forEach(feature => {
                const icon = feature === 'shader-f16' ? '🚀' : '  ';
                console.log(`   ${icon} ${feature}`);
            });
            console.log(`\n💾 Limits:`);
            console.log(`   Max Buffer Size: ${result.limits.maxBufferSize}`);
            console.log(`   Max Storage Buffer: ${result.limits.maxStorageBufferBindingSize}`);
            console.log(`   Max Workgroup Size X: ${result.limits.maxComputeWorkgroupSizeX}`);
            console.log(`   Max Bind Groups: ${result.limits.maxBindGroups}`);
            
            if (!result.fp16Available) {
                console.log('\n⚠️  FP16 not available - performance may be reduced');
                console.log('   Enable for 2× faster inference:');
                if (this.browserInfo.isChrome || this.browserInfo.isEdge) {
                    console.log('   chrome://flags → search "webgpu-developer-features" → Enable');
                }
            }
        }
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    /**
     * Get a performance estimate based on detected features
     * @returns {Object} Performance estimation
     */
    getPerformanceEstimate() {
        const estimate = {
            tier: 'unknown',
            expectedLatency: 'unknown',
            recommendations: []
        };

        if (!this.adapter) {
            estimate.tier = 'unsupported';
            estimate.recommendations.push('WebGPU not available - app will not work');
            return estimate;
        }

        // FP16 doubles performance on memory-bound workloads
        const hasFP16 = this.features.has('shader-f16');
        const maxBuffer = this.limits.maxBufferSize || 0;

        if (hasFP16 && maxBuffer > 2 * 1024 * 1024 * 1024) { // > 2GB
            estimate.tier = 'high';
            estimate.expectedLatency = '2-3s per frame';
            estimate.recommendations.push('✅ Optimal configuration detected');
        } else if (hasFP16) {
            estimate.tier = 'medium';
            estimate.expectedLatency = '3-4s per frame';
            estimate.recommendations.push('Consider reducing MAX_INFERENCE_SIZE to 512px');
        } else if (maxBuffer > 2 * 1024 * 1024 * 1024) {
            estimate.tier = 'medium';
            estimate.expectedLatency = '4-6s per frame';
            estimate.recommendations.push('Enable FP16 in browser flags for 2× speedup');
        } else {
            estimate.tier = 'low';
            estimate.expectedLatency = '6-10s per frame';
            estimate.recommendations.push('Enable FP16 in browser flags');
            estimate.recommendations.push('Reduce MAX_INFERENCE_SIZE to 384px');
            estimate.recommendations.push('Increase INFERENCE_DELAY to 5000ms');
        }

        return estimate;
    }
}

// Create singleton instance
const webgpuDetector = new WebGPUDetector();

// Export both the class and singleton
export { WebGPUDetector, webgpuDetector };
export default webgpuDetector;
