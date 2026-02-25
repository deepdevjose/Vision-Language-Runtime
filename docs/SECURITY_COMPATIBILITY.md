# Security & Compatibility Features

## Overview

Recent updates focus on **security**, **compatibility**, and **user experience** improvements. These features ensure the app works safely across different devices and handles edge cases gracefully.

---

## 1. Feature Flags & Fallbacks

### WebGPU Detection and Fallback Mode

The app now gracefully handles devices without WebGPU support.

**How it works:**

1. **Early Detection**: WebGPU capability is detected at startup
2. **Two Modes**:
   - **Live Mode** (WebGPU available): Real-time webcam captioning
   - **Upload Mode** (No WebGPU): Static image upload for one-off analysis

**User Experience:**

- **With WebGPU**: Normal flow → Welcome → Loading → Live Captioning
- **Without WebGPU**: Welcome → Image Upload screen

**Fallback UI:**

The upload mode provides:
- 📸 Drag-and-drop image upload
- 🖼️ Image preview before analysis
- ⚠️ Clear messaging about limited functionality

**Technical Details:**

- Graceful degradation - no errors or crashes
- Clear messaging to users about why certain features aren't available
- Future-ready for CPU/WASM inference implementation

**Files:**
- [src/js/components/image-upload.js](../src/js/components/image-upload.js) - Upload UI component
- [src/js/main.js](../src/js/main.js) - State machine handling fallback mode

---

## 2. Enhanced Camera Error Messages

### Safari/iOS-Specific Error Handling

Camera permission errors now show **context-aware**, **actionable** guidance based on browser and platform.

**Error Types Handled:**

| Error | Browser | Message |
|-------|---------|---------|
| `NotAllowedError` | Safari/iOS | Step-by-step instructions for Settings → Safari → Camera |
| `NotAllowedError` | Chrome/Firefox | Address bar permission instructions |
| `NotFoundError` | All | "No camera detected" with troubleshooting steps |
| `NotReadableError` | All | "Camera in use" - suggests closing other apps |
| `OverconstrainedError` | iOS | iOS-specific constraint issues |
| `SecurityError` | All | "Requires HTTPS" with platform-specific notes |
| `AbortError` | All | Interrupted access guidance |

**Example - Safari/iOS:**

```
🚫 Camera Access Denied

Safari/iOS detected. To enable camera:
1. Go to Settings → Safari → Camera
2. Change to "Ask" or "Allow"
3. Reload this page
4. Tap "Allow" when prompted

Technical: NotAllowedError - User denied permission
```

**Example - Chrome:**

```
🚫 Camera Access Denied

Please allow camera access in your browser settings:
1. Click the camera icon in the address bar
2. Select "Allow"
3. Refresh this page
```

**Benefits:**

- **Reduced support requests**: Users get exact steps to fix issues
- **Browser-specific guidance**: Different instructions for Safari vs Chrome
- **Mobile-optimized**: Special handling for iOS constraints
- **Technical details**: Included for developers/debugging

**Files:**
- [src/js/services/webcam-service.js](../src/js/services/webcam-service.js) - `getCameraErrorMessage()` function

---

## 3. URL Detection & Sanitization

### Automatic URL Detection in Captions

The app now detects URLs in captions and displays them safely with user confirmation before opening.

**Features:**

✅ **Automatic Detection:**
- HTTP/HTTPS URLs
- URLs without protocol (e.g., `example.com`)
- Multiple URLs in one caption
- Email addresses (detected but not treated as URLs)

✅ **Security Measures:**
- Dangerous protocol blocking (`javascript:`, `data:`, `file:`, etc.)
- XSS pattern detection
- HTML entity escaping
- URL length limits (max 2000 chars)
- Suspicious pattern scanning

✅ **User Experience:**
- URLs shown as clickable badges below caption
- Click triggers confirmation dialog
- Dialog shows full URL for inspection
- "Open" opens in new tab with `noopener,noreferrer`
- "Cancel" closes dialog

**Example Flow:**

1. **Caption Generated:**
   ```
   "A screenshot of a website showing https://example.com/page"
   ```

2. **Display:**
   ```
   Caption: "A screenshot of a website showing [URL_0]"
   
   🔗 1 Link Detected
   ├─ 🔗 example.com/page [Open]
   ```

3. **Click "Open":**
   ```
   🔗 Open External Link
   
   You are about to open an external link. Make sure you trust this URL:
   
   https://example.com/page
   
   ⚠️ Never open links from untrusted sources.
   
   [Cancel] [Open Link]
   ```

**Blocked URLs:**

URLs with dangerous protocols are shown but not clickable:

```
⚠️ javascript:alert(1) [Blocked]
Reason: Blocked protocol: javascript:
```

**Technical Implementation:**

- **Detection**: Regex-based with multiple fallback patterns
- **Sanitization**: HTML entity escaping + protocol validation
- **Validation**: Multi-layer security checks
- **Display**: Separate component with confirmation UI

**Files:**
- [src/js/utils/url-sanitizer.js](../src/js/utils/url-sanitizer.js) - Core URL processing
- [src/js/components/url-display.js](../src/js/components/url-display.js) - UI components
- [src/js/components/live-caption.js](../src/js/components/live-caption.js) - Integration

---

## Security Considerations

### Threat Model

**What we protect against:**

1. **XSS via caption text**: All URLs are escaped before display
2. **Malicious protocols**: `javascript:`, `data:`, `file:` blocked
3. **Clickjacking**: Confirmation dialog before opening
4. **Tabnabbing**: `noopener,noreferrer` prevents access to parent window
5. **Popup blocking**: Graceful fallback with user notification

**What we DON'T protect against:**

1. **Phishing sites**: User must verify URL in confirmation dialog
2. **Malware downloads**: Browser's built-in protection applies
3. **Social engineering**: User education is key

### Best Practices

**For Users:**

- ✅ Always read URLs in confirmation dialog
- ✅ Be suspicious of shortened URLs (bit.ly, tinyurl, etc.)
- ✅ Check for typos in domain names (e.g., `gooogle.com`)
- ❌ Never open links you don't recognize
- ❌ Don't trust URLs just because they're in a caption

**For Developers:**

- ✅ Add additional domain whitelisting if needed
- ✅ Log all URL open attempts for security monitoring
- ✅ Consider adding reputation checking APIs
- ✅ Update regex patterns to catch new URL formats

---

## Browser Compatibility

### WebGPU Availability

| Browser | Version | WebGPU | Notes |
|---------|---------|--------|-------|
| Chrome | 113+ | ✅ | Full support |
| Edge | 113+ | ✅ | Full support |
| Firefox | 141+ | ⚠️ | Requires flag in Nightly |
| Safari | 18+ | ⚠️ | Experimental, limited |
| Mobile Chrome | Latest | ✅ | Android only |
| Mobile Safari | Latest | ❌ | Not supported (use fallback) |

**Fallback Mode** works on all modern browsers (ES6+ required).

### Camera API Support

| Platform | Camera Access | HTTPS Required | Notes |
|----------|---------------|----------------|-------|
| Desktop Chrome | ✅ | No (localhost OK) | Best support |
| Desktop Firefox | ✅ | No (localhost OK) | Good support |
| Desktop Safari | ✅ | ⚠️ | Strict permissions |
| Mobile Chrome (Android) | ✅ | Yes | Requires HTTPS |
| Mobile Safari (iOS) | ✅ | Yes | Very strict, needs Settings |
| Mobile Firefox | ✅ | Yes | Good support |

---

## Configuration

### Feature Flags (Future)

Currently all features are enabled. To add feature flags:

```javascript
// constants.js
export const FEATURE_FLAGS = {
    URL_DETECTION: true,
    IMAGE_UPLOAD_FALLBACK: true,
    ENHANCED_ERRORS: true
};
```

### URL Security Settings

Customize in `url-sanitizer.js`:

```javascript
// Max URL length
const MAX_URL_LENGTH = 2000;

// Blocked protocols
const BLOCKED_PROTOCOLS = [
    'javascript:',
    'data:',
    'vbscript:',
    // Add more...
];

// Whitelisted domains (optional)
const TRUSTED_DOMAINS = [
    'example.com',
    'trusted-site.org'
];
```

---

## Testing

### Manual Testing Checklist

**WebGPU Fallback:**
- [ ] Open in browser without WebGPU
- [ ] Verify image upload screen appears
- [ ] Upload an image
- [ ] Verify error message (not yet supported)

**Camera Errors:**
- [ ] Test in Safari/iOS - deny camera
- [ ] Test in Chrome - deny camera
- [ ] Unplug camera mid-session
- [ ] Use camera in another app first

**URL Detection:**
- [ ] Caption with `https://example.com`
- [ ] Caption with `example.com` (no protocol)
- [ ] Caption with `javascript:alert(1)` (blocked)
- [ ] Caption with multiple URLs
- [ ] Click "Open" - verify new tab
- [ ] Click "Cancel" - verify dialog closes

### Automated Tests (Future)

Add to test suite:

```javascript
// Test URL sanitization
test('sanitizes dangerous URLs', () => {
    const result = validateURLSafety('javascript:alert(1)');
    assertEqual(result.safe, false);
});

// Test error messages
test('shows iOS-specific error for Safari', () => {
    const error = { name: 'NotAllowedError' };
    const message = getCameraErrorMessage(error);
    assertTrue(message.message.includes('Settings → Safari'));
});
```

---

## Troubleshooting

### Image Upload Not Working

**Symptom:** Upload button does nothing

**Causes:**
1. WebGPU is actually available (shouldn't show upload mode)
2. File type not supported

**Fix:**
- Check browser console for errors
- Verify file is JPG/PNG/WebP/GIF
- Try different image

### URLs Not Detected

**Symptom:** Caption has URL but no badge appears

**Causes:**
1. URL format not recognized by regex
2. URL classified as email

**Fix:**
- Check console logs (`logger.debug`)
- Verify URL format matches patterns
- Update regex in `url-sanitizer.js`

### Camera Errors Still Confusing

**Symptom:** Error message doesn't help user

**Causes:**
1. New error type not in `getCameraErrorMessage()`
2. Browser-specific edge case

**Fix:**
- Check `error.name` in console
- Add new error type to switch statement
- Test across browsers

---

## Future Enhancements

### Planned Features

1. **CPU/WASM Inference**
   - Enable image upload analysis without WebGPU
   - Slower but works on all devices
   - Estimated completion: Q2 2026

2. **URL Reputation Checking**
   - Integrate with Google Safe Browsing API
   - VirusTotal URL scanning
   - Community-based URL ratings

3. **Smart URL Handling**
   - Auto-extract metadata (title, image, description)
   - Preview cards for links
   - QR code generation for URLs

4. **Enhanced Fallback Mode**
   - Batch image processing
   - Image comparison mode
   - Save/export results

---

## Related Documentation

- [Testing Guide](../tests/README.md) - Unit and E2E tests
- [Diagnostics Panel](DIAGNOSTICS.md) - Logging and debugging
- [Deployment Guide](DEPLOYMENT.md) - Production setup

---

## Changelog

### v1.1.0 - Security & Compatibility Update

**Added:**
- 🔒 URL detection and sanitization
- 📱 Safari/iOS-specific error messages
- 🖼️ Image upload fallback mode (WebGPU not available)
- ⚠️ Enhanced camera error handling

**Security:**
- Dangerous protocol blocking
- XSS prevention in captions
- User confirmation before opening links
- `noopener,noreferrer` for external links

**Compatibility:**
- Graceful degradation for non-WebGPU devices
- Browser-specific error messages
- Mobile-optimized error handling
- iOS constraint detection

---

**Last Updated:** February 24, 2026
