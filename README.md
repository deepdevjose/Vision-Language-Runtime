# VLM Runtime

> Real-time vision-language model running entirely in your browser  
> WebGPU • Zero dependencies • Privacy-first

---

## What is this?

A browser-based implementation of FastVLM-0.5B that lets you ask questions about what your camera sees. Everything runs locally on your GPU - no servers, no API calls, complete privacy.

**Translation:** Point your camera at something, ask a question, get an AI response. All happening in your browser because why not.

---

## Why?

- **Privacy** — Your camera feed never leaves your device
- **No API costs** — Runs 100% locally using WebGPU
- **Learning** — Wanted to see how fast I could make transformers.js
- **Aesthetic** — Apple/WWDC design language is just *chef's kiss*

---

## How it works

```
Camera → WebGPU → FastVLM-0.5B → Live captions
```

**Tech stack:**
- Vanilla JavaScript (no frameworks, no build tools)
- WebGPU for GPU acceleration
- Transformers.js + ONNX Runtime
- ASCII art background porque se veía cool

**Performance tricks:**
- Lazy loading (60% faster startup)
- Frame downscaling to 640px (50% faster inference)
- Throttled UI updates (100ms intervals)
- Canvas caching and dimension tracking
- Abortable async operations

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

## Quick start

### Local Development

```bash
# Clone the repo
git clone <repository-url>
cd Vision-Language-Runtime

# Start a local server (CORS requirement)
cd src
python -m http.server 8000

# Open browser
http://localhost:8000
```

**Requirements:**
- WebGPU-enabled browser (Chrome 113+, Edge 113+, Firefox 141+)
- Camera/webcam
- Local server (no file:// protocol)
- **HTTPS connection** (or localhost) - required for camera access on mobile devices

### Deploy to Production

**Zero configuration deployment** - no build step needed!

```
Build command:        (empty)
Build output directory: src
```

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed instructions for Cloudflare Pages, Vercel, Netlify, and more.

---

## Mobile Usage

**For mobile devices:**
- Use HTTPS to access the app (camera doesn't work over HTTP on mobile browsers)
- On localhost, you can use HTTP for testing
- Grant camera permissions when prompted
- The app automatically detects mobile and uses optimized constraints
- Responsive design works on phones and tablets

**Testing on mobile (local network):**
```bash
# Find your local IP
ipconfig  # Windows
ifconfig  # Mac/Linux

# Start server from src/
cd src
python -m http.server 8000

# Access from mobile browser
http://YOUR_LOCAL_IP:8000
```

**Recommended:** Deploy to Cloudflare Pages (free) for instant HTTPS and global CDN.

---

## Features

- ✨ Real-time visual inference (1-3s per frame)
- 🎨 Monochromatic glass UI (Apple/WWDC vibes)
- 🔒 100% on-device processing
- 📝 Custom prompts for flexible queries + 10 multilingual presets
- 🎭 Live ASCII art background from camera feed
- ⚡ GPU-accelerated with WebGPU + FP16 support
- 📊 Performance optimizations: warmup, dynamic FPS, backpressure
- � Freeze frame to analyze static images
- 📜 Caption history (last 20 captions with JSON export)
- 🎥 Camera switching and auto-recovery with exponential backoff
- 🔧 Developer tools: diagnostics panel (`Ctrl+Shift+D`), logger, type checking
- 🔗 Smart URL detection with security confirmation
- 📱 Enhanced Safari/iOS camera error messages
- 🖼️ Image upload fallback (for devices without WebGPU)

---

## Performance tuning

Edit `js/utils/constants.js`:

```javascript
// Reduce for slower GPUs
MAX_INFERENCE_SIZE: 512,  // Default: 640

// Increase for slower capture rate
FRAME_CAPTURE_DELAY: 1000,  // Default: 500ms

// Enable debug logs
MODEL_CONFIG.DEBUG = true
```

### Enable FP16 for 2× speed boost

FP16 (half-precision floating-point) can **double inference speed** on compatible GPUs. The app automatically detects and uses FP16 if available.

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

**WebGPU not available?**  
Update your browser or check [webgpu.io](https://webgpu.io) for compatibility. The app will automatically switch to image upload mode as a fallback.

**Model won't load?**  
Clear cache, check console for CORS errors, verify internet connection

**Slow performance?**  
Lower `MAX_INFERENCE_SIZE`, increase `FRAME_CAPTURE_DELAY`, or close other GPU apps

**Camera blocked on mobile?**  
- **Most common:** Not using HTTPS (required on mobile browsers)
- **Safari/iOS:** Go to Settings → Safari → Camera → Allow
- Check browser permissions: Settings → Site Permissions → Camera
- Reload the page after granting permissions
- Make sure no other app is using the camera
- Try in incognito mode to rule out extension conflicts

**Camera blocked on desktop?**  
Check browser permissions and reload. See detailed error messages in the UI for specific guidance.

**"Insecure Connection" warning?**  
Camera access requires HTTPS. Use `https://` or run on `localhost` for testing

**URLs in captions?**  
Click the URL badge to open with security confirmation. Never open untrusted links!

---

## Developer Tools (Optional)

The project includes optional development tools for testing and type checking:

```bash
# Install dev dependencies (optional - not needed for deployment)
npm install

# Run tests (optional)
npm run test:unit      # Unit tests
npm run test:e2e       # E2E tests with Playwright
npm run type-check     # TypeScript type checking
```

**Important:** These are **only for development**. The production app has **zero dependencies** and runs as pure static HTML/CSS/JS.

---

## Credits

**Model & Framework:**
- [Apple/FastVLM-0.5B](https://huggingface.co/apple/FastVLM-0.5B) by Apple Research
- [Transformers.js](https://huggingface.co/docs/transformers.js) by Hugging Face

**This version:**
- Rewritten in vanilla JS by a devdepressed or whatever my name so doing things
- No frameworks. I hate `npm install`. It's just me, WebGPU, and the model. No middlemen.
- Performance optimizations porque mi GPU no es tan buena
- Apple aesthetic porque me gusta cómo se ve

---

## License

Attribution License — You can use this but you **must** give credit (see LICENSE file)

**Model License:** FastVLM-0.5B has its own license terms (see Hugging Face repo)

---

Made with ☕ and questionable life choices
