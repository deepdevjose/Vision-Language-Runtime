# VLM Runtime

> Real-time vision-language model running entirely in your browser  
> **WebGPU • Zero dependencies • 100% Private**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Status](https://img.shields.io/badge/Status-Active-green)
![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-brightgreen)

## Table of Contents

- [What is this?](#what-is-this)
- [Why This Matters](#why-this-matters)
- [How It Works](#how-it-works)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Mobile & HTTPS](#mobile--https-guide)
- [Features](#features)
- [Performance Tuning](#performance-tuning)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## What is this?

A browser-based implementation of **FastVLM-0.5B** that lets you ask questions about what your camera sees. Everything runs locally on your GPU—no servers, no API calls, complete privacy.

**In simple terms:** Point your camera at something, ask a question, get an instant AI response. All processing happens in your browser.

---

## Why This Matters

- **🔒 Privacy First** — Your camera feed never leaves your device
- **💰 Zero API Costs** — Runs 100% locally using WebGPU acceleration
- **⚡ Fast & Responsive** — Real-time inference with GPU acceleration
- **📚 Educational** — See how modern vision-language models work in the browser
- **🎨 Beautiful Design** — Inspired by Apple/WWDC's design language

---

## How It Works

### Processing Pipeline

```
📹 Camera Feed → WebGPU Processing → FastVLM-0.5B Model → Live Captions
```

### Technology Stack

| Component | Technology |
|-----------|-----------|
| **Language** | Vanilla JavaScript (no frameworks) |
| **GPU Acceleration** | WebGPU |
| **Model Runtime** | Transformers.js + ONNX Runtime |
| **UI Design** | CSS + vanilla JS components |
| **Styling** | Apple-inspired glass morphism design |

### Performance Optimizations

- ✅ **Lazy Loading** — 60% faster startup, models load on-demand
- ✅ **Frame Downscaling** — 50% faster inference via 640px resolution
- ✅ **UI Throttling** — Batched updates every 100ms
- ✅ **Canvas Caching** — Dimension tracking prevents reflows
- ✅ **Async Control** — Abortable operations for responsive UI
- ✅ **FP16 Support** — 2-3× speed boost on compatible GPUs
- ✅ **Dynamic Frame Timing** — Automatic adjustment based on GPU speed

---

## Architecture

### State Machine

The app uses a formal **event-driven state machine** for predictable state transitions and robust error handling:

**State Separation:**
- **ViewState** — UI screens: `permission` | `welcome` | `loading` | `runtime` | `error` | `image-upload`
- **RuntimeState** — Execution state: `idle` | `warming` | `running` | `paused` | `recovering` | `failed`
- **LoadingPhase** — Model loading: `loading-wgpu` | `loading-model` | `warming-up` | `complete`

**15+ Formal Transitions:**
```javascript
PERMISSION_GRANTED → welcome screen
START → loading screen
WGPU_READY → model starts loading
MODEL_LOADED → warmup begins
WARMUP_COMPLETE → runtime (live captioning)
STREAM_ENDED → error screen with recovery
RETRY → back to permission flow
```

**Error Handling:**
- Formal error states with codes: `CAMERA_DENIED`, `MODEL_LOAD_FAILED`, `STREAM_LOST`, etc.
- Recovery actions: retry, reload, fallback modes
- Technical details collapsible for debugging

**Why:**
- Declarative transitions with guards prevent invalid states
- Centralized error recovery flows
- Better debugging with event logs
- Production-ready architecture at scale

See `src/js/utils/state-machine.js` for full implementation.

---

## Quick Start

### Requirements

- ✅ **WebGPU-enabled browser** (Chrome 113+, Edge 113+, Firefox 141+)
- ✅ **Camera/Webcam** 
- ✅ **Local server** (file:// protocol not supported)
- ✅ **HTTPS connection** (or localhost) — required for camera access

Check WebGPU compatibility: [webgpu.io/test](https://webgpu.io/test)

### Local Development

```bash
# Clone the repository
git clone <repository-url>
cd Vision-Language-Runtime

# Start a local server (CORS requirement)
cd src
python -m http.server 8000

# Open in browser
http://localhost:8000
```

### Production Deployment

**No build step required!** Deploy the `src/` directory directly:

```
Build command:          (empty - no build needed)
Build output directory: src/
```

Host on:
- **Cloudflare Pages** (recommended - free HTTPS + CDN)
- **Vercel** 
- **Netlify**
- **GitHub Pages**
- Any static file host

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed deployment guides.

---

## Mobile & HTTPS Guide

### Mobile Devices

Camera access on mobile requires HTTPS (except localhost). Follow these steps:

#### iOS/Safari
1. Deploy app to HTTPS (Cloudflare Pages recommended)
2. Settings → Safari → Camera → Allow
3. Grant permissions when prompted
4. Reload page after permissions change

#### Android/Chrome
1. Navigate via HTTPS
2. Grant camera permissions
3. Enable WebGPU support: `chrome://flags` → search "webgpu" → enable developer features
4. Reload and check console for WebGPU status

### Testing on Local Network

```bash
# Find your machine's IP
ifconfig          # Mac/Linux
ipconfig          # Windows

# Start server (from src/ directory)
python -m http.server 8000

# Access from mobile on same network
http://YOUR_LOCAL_IP:8000
```

### Recommended: Deploy to Cloudflare Pages

Get instant HTTPS + global CDN (free tier available):
1. Push to GitHub
2. Connect repo to Cloudflare Pages
3. Set build output directory to `src/`
4. Auto-deploy on push

**Result:** `https://your-app.pages.dev` with zero build steps

---

## Features

### Core Features
- ✨ **Real-time Inference** — 1-3 seconds per frame (varies by GPU)
- 🔒 **Private by Default** — 100% on-device processing
- 🎨 **Glass UI Design** — Apple/WWDC-inspired monochromatic interface
- ⚡ **GPU Accelerated** — WebGPU + FP16 support for 2-3× speed boost

### Customization
- 📝 **Custom Prompts** — Ask any question about what the camera sees
- 🌍 **Multilingual Presets** — 10+ language options for live captions
- 🎭 **Live ASCII Art** — Psychedelic art background from camera feed
- 🖼️ **Freeze Frame Analysis** — Pause and analyze static images

### Productivity
- 📊 **Caption History** — Store last 20 captions with JSON export
- 🔗 **Smart URL Detection** — Automatic URL recognition with security checks
- 📱 **Device Optimization** — Auto-detection for iOS/Safari/Android
- 🎥 **Camera Switching** — Fast switching between front/rear cameras

### Developer Tools
- 🔧 **Diagnostics Panel** — Press `Ctrl+Shift+D` for real-time stats
- 📋 **Debug Logger** — Full logging console for troubleshooting
- ✅ **Type Checking** — TypeScript validation (optional dev tool)

---

## Performance tuning

The app automatically detects your GPU and selects an optimal performance tier (`low`, `medium`, or `high`). Each tier controls inference size, token limit, and minimum frame timing.

### Adjust performance per tier

Edit `src/js/utils/constants.js` in the `QOS_PROFILES` object:

```javascript
// For slower/older GPUs - edit QOS_PROFILES.low
low: {
    MAX_INFERENCE_SIZE: 320,  // Default inference resolution
    MAX_NEW_TOKENS: 32,       // Output token limit
    TIMING_DELAY_MS: 5000,    // Minimum ms between frames
    SYSTEM_PROMPT: '...'      // Prompt for fast responses
}

// For mid-range GPUs - edit QOS_PROFILES.medium
medium: {
    MAX_INFERENCE_SIZE: 480,
    MAX_NEW_TOKENS: 64,
    TIMING_DELAY_MS: 3500,
    SYSTEM_PROMPT: '...'
}

// For high-end GPUs - edit QOS_PROFILES.high
high: {
    MAX_INFERENCE_SIZE: 640,  // Default: 640px
    MAX_NEW_TOKENS: 128,
    TIMING_DELAY_MS: 2000,
    SYSTEM_PROMPT: '...'
}
```

**Frame timing:** The app uses **dynamic frame delays** based on actual inference time. It waits at least `TIMING_DELAY_MS` and adds 20% buffer to measured time: `delay = max(TIMING_DELAY_MS, inferenceTime * 1.2)`. This prevents GPU throttling on slower hardware.

### Enable debug mode

```javascript
// In src/js/utils/constants.js, find MODEL_CONFIG
MODEL_CONFIG.DEBUG = true  // Auto-enabled on localhost
```

### Enable FP16 for 2× speed boost

FP16 (half-precision floating-point) can **double inference speed** on compatible GPUs. The app automatically detects and uses FP16 if available.

**Hardware tier auto-detection:**
The app runs GPU capability tests on startup to determine if it's `low`, `medium`, or `high` tier. This controls frame resolution, token limits, and waiting times. You can see the detection results in the browser console on first load.

**Check FP16 status:**
Open browser console on first load - you'll see WebGPU detection results including FP16 availability.

**Enable FP16 on mobile (Samsung S24+, Pixel 9, etc):**

1. Open Chrome and navigate to:
   ```
   chrome://flags
   ```

2. Search and enable:
   ```
   #enable-webgpu-developer-features
   ```

3. Restart browser and verify:
   ```
   chrome://gpu
   ```
   Look for `shader-f16` in WebGPU Features list

**Enable FP16 on desktop:**

1. Chrome/Edge: `chrome://flags` → enable `#enable-unsafe-webgpu`
2. Restart browser
3. Check console for "🚀 FP16 enabled" message

**Performance impact with FP16:**
- Samsung S24+ (Adreno 750): ~2-3s per frame (vs 4-6s)  
- Desktop RTX 4090: ~1-2s per frame (vs 3-4s)
- iPhone 15 Pro (A17): ~3-4s per frame (partial support)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **WebGPU not available** | Update browser to latest version. Check [webgpu.io](https://webgpu.io) for compatibility. App falls back to image upload mode. |
| **Model won't load** | Clear cache (Ctrl+Shift+Delete), check console for CORS errors, verify internet connection |
| **Slow performance** | Reduce `MAX_INFERENCE_SIZE` in `src/js/utils/constants.js` or increase `TIMING_DELAY_MS`. Close GPU-intensive apps. |
| **Camera blocked on mobile** | Make sure using HTTPS (camera requires HTTPS on mobile). Check Settings → Safari → Camera → Allow. Reload page. |
| **Camera blocked on desktop** | Check browser permissions: Settings → Site Permissions → Camera. Reload page. Try incognito mode. |
| **"Insecure Connection" warning** | Camera requires HTTPS. Use secure connection or run on localhost for testing. |
| **URLs in captions aren't clickable** | Click the URL badge to open with security confirmation. Never open untrusted links! |

### Debug Mode

Enable debug logging in `src/js/utils/constants.js`:

```javascript
MODEL_CONFIG.DEBUG = true  // Auto-enabled on localhost
```

Open browser DevTools (F12) to see detailed logs for:
- GPU detection
- Model loading
- Inference timing
- State transitions
- Error details

---

## Credits & Attribution

**Base Model & Framework:**
- [Apple/FastVLM-0.5B](https://huggingface.co/apple/FastVLM-0.5B) — Efficient vision-language model by Apple Research
- [Transformers.js](https://huggingface.co/docs/transformers.js) — JavaScript runtime by Hugging Face
- [ONNX Runtime Web](https://github.com/microsoft/onnx-runtime) — Inference engine

**Implementation:**
- Browser-native implementation in Vanilla JavaScript
- Zero external dependencies in production
- Performance optimizations for GPU efficiency
- Apple-inspired design language

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Optional: Install dev dependencies (for testing only)
npm install

# Run tests
npm run test:unit      # Unit tests
npm run test:e2e       # E2E tests with Playwright
npm run type-check     # TypeScript validation

# Start development server
cd src && python -m http.server 8000
```

**Note:** Development tools are optional. The production app has **zero external dependencies**.

---

## License

Licensed under the [MIT License](LICENSE). See LICENSE file for details.

**Model License:** FastVLM-0.5B is subject to its own license terms on [Hugging Face](https://huggingface.co/apple/FastVLM-0.5B).

---

Made with ☕ and questionable engineering decisions
