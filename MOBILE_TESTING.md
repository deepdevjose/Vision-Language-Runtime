# Testing on Mobile Devices

## Why HTTPS is Required

Modern browsers **require HTTPS** (secure connection) to access camera/microphone on mobile devices. This is a security feature to prevent malicious websites from accessing your camera without encryption.

**Exception:** `localhost` and `127.0.0.1` work with HTTP for local testing.

---

## Option 1: ngrok (Easiest)

**Install ngrok:**
```bash
# Download from https://ngrok.com/download
# Or use package manager
npm install -g ngrok
# or
brew install ngrok
```

**Start your local server:**
```bash
python -m http.server 8000
```

**Create HTTPS tunnel:**
```bash
ngrok http 8000
```

You'll get a URL like: `https://abc123.ngrok.io`

**Access from mobile:**
- Open the ngrok URL on your phone
- Grant camera permissions
- Works perfectly ✓

**Pros:**
- Super easy
- Real HTTPS certificate
- Works on any device

**Cons:**
- Free tier has random URLs (they change each time)
- Requires ngrok account

---

## Option 2: localtunnel

**Install:**
```bash
npm install -g localtunnel
```

**Start server and tunnel:**
```bash
# Terminal 1
python -m http.server 8000

# Terminal 2
lt --port 8000
```

You'll get a URL like: `https://random-name.loca.lt`

**Pros:**
- No account needed
- Easy setup

**Cons:**
- Less stable than ngrok
- Slower sometimes

---

## Option 3: Self-Signed Certificate (Advanced)

**Generate certificate:**
```bash
# Install mkcert
brew install mkcert  # Mac
choco install mkcert # Windows

# Install local CA
mkcert -install

# Generate cert for your local IP
mkcert YOUR_LOCAL_IP localhost 127.0.0.1
```

**Start HTTPS server:**
```bash
# Python
python -m http.server 8000 --ssl

# Node.js (requires http-server with SSL)
npm install -g http-server
http-server -p 8000 -S -C YOUR_LOCAL_IP.pem -K YOUR_LOCAL_IP-key.pem
```

**Access from mobile:**
- Find your local IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- On mobile, go to `https://YOUR_LOCAL_IP:8000`
- You'll get a security warning - accept it

**Pros:**
- No external services
- Fast (local network)
- Works offline

**Cons:**
- More complex setup
- Certificate warnings on mobile
- Need to find local IP each time

---

## Option 4: GitHub Pages / Netlify / Vercel (Production)

**Deploy to static hosting:**

All these platforms provide **free HTTPS** automatically:

- **GitHub Pages:** Push to repo, enable in settings
- **Netlify:** Drag & drop folder or connect repo
- **Vercel:** `vercel --prod`

**Pros:**
- Real HTTPS
- No setup for end users
- Shareable URL

**Cons:**
- Requires deployment
- Not for active development

---

## Testing Checklist

✅ **Before testing:**
- [ ] Using HTTPS (or localhost)
- [ ] Camera permissions granted in browser
- [ ] No other app using camera
- [ ] WebGPU supported in browser

✅ **Mobile-specific:**
- [ ] Browser updated to latest version
- [ ] Tried incognito mode (rules out extensions)
- [ ] Check Console for error messages (Chrome DevTools via USB)
- [ ] Screen orientation works (portrait & landscape)

---

## Common Mobile Issues

### "Camera access denied"
**Cause:** Browser permissions not granted  
**Fix:** Settings → Site Permissions → Camera → Allow

### "Insecure connection"
**Cause:** Using HTTP instead of HTTPS  
**Fix:** Use one of the HTTPS methods above

### "Camera already in use"
**Cause:** Another app/tab using camera  
**Fix:** Close other apps, check other browser tabs

### "NotReadableError"
**Cause:** Hardware access denied by OS  
**Fix:** iOS Settings → Privacy → Camera → Safari (enable)

### "OverconstrainedError"
**Cause:** Requested resolution not supported  
**Fix:** Code now has fallbacks, should work automatically

---

## Debugging on Mobile

### Chrome DevTools (Android)

1. Enable USB Debugging on Android
2. Connect phone to computer
3. Open `chrome://inspect` on desktop Chrome
4. Select your device → Inspect
5. Check Console for errors

### Safari DevTools (iOS)

1. iPhone: Settings → Safari → Advanced → Web Inspector (enable)
2. Mac: Safari → Preferences → Advanced → Show Develop menu
3. Connect iPhone to Mac
4. Safari → Develop → [Your iPhone] → Select page
5. Console shows errors

---

## Expected Behavior on Mobile

✅ **Should work:**
- Camera access (with HTTPS)
- Responsive layout (width 100%)
- Touch controls (no drag on mobile)
- All inference features
- ASCII background (reduced performance)

⚠️ **May be slower:**
- Model loading (~30-60s on mobile)
- Inference (~3-5s per frame vs 1-2s desktop)
- ASCII rendering (optimized for mobile)

❌ **Won't work:**
- HTTP (camera blocked)
- Very old browsers (need WebGPU)
- iOS Safari < 18 (limited WebGPU)

---

## Performance Tips for Mobile

**Reduce inference size:**
```javascript
// js/utils/constants.js
MAX_INFERENCE_SIZE: 384  // Lower than default 640
```

**Increase delays:**
```javascript
FRAME_CAPTURE_DELAY: 1000  // 1 second instead of 500ms
```

**Disable ASCII background:**
```javascript
// In CaptioningView, comment out ASCII creation
// Or reduce columns in AsciiBackground.js
cols: 80  // Instead of 130
```

---

## Quick Mobile Test

**Fastest way to test:**

```bash
# Terminal 1: Start server
python -m http.server 8000

# Terminal 2: Create tunnel
npx localtunnel --port 8000

# Open the URL on your phone
# Grant camera permission
# Start using the app!
```

---

Made with ☕ by a dev deprimido who spent too much time debugging camera permissions on iOS
