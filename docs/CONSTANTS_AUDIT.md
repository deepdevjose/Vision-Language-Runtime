# Constants Audit: Production Values vs Documentation

**Date:** March 21, 2026  
**Scope:** Comparing `src/js/utils/constants.js` against README.md and actual code usage

---

## Summary of Findings

| Issue | Severity | Count |
|-------|----------|-------|
| Unused constants | High | 4 (FRAME_CAPTURE_DELAY, VIDEO_RECOVERY_INTERVAL, RESIZE_DEBOUNCE, SUGGESTION_DELAY) |
| Documentation inaccuracy | Medium | 2 |
| Misleading examples | Medium | 1 |

---

## Detailed Discrepancies

### 1. **FRAME_CAPTURE_DELAY Mismatch**

**Location:** `src/js/utils/constants.js:36`  
**Definition:** `FRAME_CAPTURE_DELAY: 3000` (3 seconds)  
**Documentation:** `README.md:174` states `FRAME_CAPTURE_DELAY: 1000` with comment "Default: 500ms"  
**Actual Usage:** **NOT IMPORTED OR USED** anywhere in the codebase

**Issue:** 
- Value in constants (3000) ≠ value in docs (1000)
- Comment says "500ms" but value is 3000
- Constant is defined but completelySince: Appears to be obsolete or placeholder code

**Recommendation:** Remove from constants.js and README, or clarify its purpose and actually implement it.

---

### 2. **Unused TIMING Constants**

**Location:** `src/js/utils/constants.js:35-39`

```javascript
export const TIMING = {
    FRAME_CAPTURE_DELAY: 3000,        // ❌ Unused
    VIDEO_RECOVERY_INTERVAL: 1000,    // ❌ Unused
    RESIZE_DEBOUNCE: 50,              // ❌ Unused
    SUGGESTION_DELAY: 50,             // ❌ Unused
};
```

**Status:** None of these constants are imported in any production file (checked via grep across entire codebase).

**Analysis:**
- These appear to be planned features or remnants from an earlier architecture
- No imports found in: services/, components/, utils/, or main.js
- They take up space and create confusion for maintainers

**Recommendation:** Either:
1. Remove them entirely if truly obsolete
2. Implement the features they reference
3. Add detailed comments explaining why they're kept

---

### 3. **QOS_PROFILES Not Clearly Explained in README**

**Location:** `src/js/utils/constants.js:43-63`

**Actual Architecture:**
- Three hardware performance tiers: `low`, `medium`, `high`
- Each tier has: `MAX_INFERENCE_SIZE`, `MAX_NEW_TOKENS`, `TIMING_DELAY_MS`, `SYSTEM_PROMPT`
- Tier is **auto-detected** based on GPU capabilities
- Frame delay is **dynamic**, calculated as: `max(tier.TIMING_DELAY_MS, measuredInferenceTime * 1.2)`

**Documentation Gap:**
- README's "Performance tuning" section (lines 165-178) shows outdated examples
- Doesn't explain the tier-based QOS system
- Doesn't mention the 1.2x safety buffer used in dynamic delay calculation
- Suggests manually editing constants that are actually tier-controlled

---

### 4. **Misleading Performance Tuning Example**

**Location:** `README.md:165-178`

```javascript
// Current README example:
MAX_INFERENCE_SIZE: 512,  // Default: 640
FRAME_CAPTURE_DELAY: 1000,  // Default: 500ms
MODEL_CONFIG.DEBUG = true
```

**Problems:**
1. Shows editing `MAX_INFERENCE_SIZE` as if it's a top-level constant in TIMING
   - **Actual location:** Inside each QOS_PROFILES tier
   - Should be: Update QOS_PROFILES.high.MAX_INFERENCE_SIZE = 512
2. FRAME_CAPTURE_DELAY doesn't exist as a usable constant
3. No guidance on which tier to modify

---

### 5. **MODEL_CONFIG Properties Not All Documented**

**Location:** `src/js/utils/constants.js:101-109`

```javascript
export const MODEL_CONFIG = {
    MODEL_ID: 'onnx-community/FastVLM-0.5B-ONNX',
    MAX_NEW_TOKENS: 128,        // Absolute cap (not used, QOS tier overrides)
    MAX_INFERENCE_SIZE: 640,    // Absolute cap (not used, QOS tier overrides)
    DEBUG: ...                  // Auto-detected from localhost/IP
};
```

**Issue:** `MAX_NEW_TOKENS` and `MAX_INFERENCE_SIZE` in MODEL_CONFIG are ceilings but never actually used in code - QOS_PROFILES tier values are used instead.

---

## Production Values Reference

### **QOS_PROFILES (Actively Used)**

```javascript
low: {
    MAX_INFERENCE_SIZE: 320,
    MAX_NEW_TOKENS: 32,
    TIMING_DELAY_MS: 5000,
    SYSTEM_PROMPT: "Answer in ONE short sentence (8-14 words)"
}

medium: {
    MAX_INFERENCE_SIZE: 480,
    MAX_NEW_TOKENS: 64,
    TIMING_DELAY_MS: 3500,
    SYSTEM_PROMPT: "Answer concisely (maximum 2 sentences)"
}

high: {
    MAX_INFERENCE_SIZE: 640,
    MAX_NEW_TOKENS: 128,
    TIMING_DELAY_MS: 2000,
    SYSTEM_PROMPT: "Respond concisely and accurately in one sentence"
}
```

**Default Tier:** `high` (used as fallback in all code paths)

### **Glass Effects (Verified - Documented Correctly)**
```javascript
GLASS_EFFECTS = {
    BASE_FREQUENCY: 0.008,
    NUM_OCTAVES: 2,
    SCALE: 77,
    COLORS: { ... }  // 6 color constants for different states
}
```

### **Layout (Verified - Documented Correctly)**
```javascript
LAYOUT = {
    MARGINS: { DEFAULT: 20, BOTTOM: 20 },
    DIMENSIONS: { PROMPT_WIDTH: 420, CAPTION_WIDTH: 150, CAPTION_HEIGHT: 45 },
    TRANSITIONS: { SCALE_DURATION: 200, OPACITY_DURATION: 200, TRANSFORM_DURATION: 400 }
}
```

### **Prompts (Verified - Documented Correctly)**
- Default: "Describe what you see in one sentence."
- 11 multilingual presets (Spanish, Chinese, French, etc.)
- Fallback caption: "Waiting for first caption..."
- Processing message: "Starting analysis..."

---

## How Frame Timing Actually Works (Correct Implementation)

**Not FRAME_CAPTURE_DELAY, but DYNAMIC via getDynamicFrameDelay():**

1. **Tier selection** → Auto-detect GPU capabilities → Select low/medium/high
2. **Get safety ceiling** → `QOS_PROFILES[tier].TIMING_DELAY_MS` (2000-5000ms depending on tier)
3. **Measure inference** → Track actual inference time for current frame
4. **Calculate delay** → `max(tierCeiling, measuredTime * 1.2)` (1.2x safety buffer)
5. **Apply delay** → Wait before capturing next frame, allowing GPU to cool

**Current values in production:**
- **Low tier minimum:** 5000ms (5 seconds)
- **Medium tier minimum:** 3500ms
- **High tier minimum:** 2000ms
- **With 1.2x buffer:** Could be up to 6000ms on slow inference

---

## Recommendations

### **Immediate (High Priority)**

1. **Update README.md performance tuning section:**
   - Explain the three equipment tiers: low (320px), medium (480px), high (640px)
   - Show how to modify QOS_PROFILES per tier
   - Remove references to non-existent FRAME_CAPTURE_DELAY
   - Explain the 1.2x safety buffer in dynamic delay calculation

2. **Remove or implement unused TIMING constants:**
   - Option A: Delete all four unused constants (FRAME_CAPTURE_DELAY, VIDEO_RECOVERY_INTERVAL, RESIZE_DEBOUNCE, SUGGESTION_DELAY)
   - Option B: If they're planned features, add detailed comments and create GitHub issues

3. **Clarify use of MODEL_CONFIG ceiling values:**
   - Add comments explaining they're ceilings (not used)
   - Explain that QOS_PROFILES per-tier values are what actually control behavior

### **Documentation Tasks**

1. Create performance troubleshooting guide with examples:
   ```javascript
   // For low-end GPUs, edit QOS_PROFILES.low:
   low: {
       MAX_INFERENCE_SIZE: 320,  // ← Reduce further to 256 if needed
       MAX_NEW_TOKENS: 32,
       TIMING_DELAY_MS: 5000,    // ← Increase to 7000 for very slow GPUs
   }
   ```

2. Document the hardware tier auto-detection system
3. Explain the inference time tracking and 1.2x buffer strategy

### **Code Cleanup**

1. Remove unused TIMING constants if not planned
2. Add explicit comments in MODEL_CONFIG explaining that values are ceilings
3. Consider exporting the performance tier detection logic for userland visibility

---

## Files Affected by This Audit

- ✅ `src/js/utils/constants.js` — Source of truth
- ❌ `README.md` — Requires updating
- ✅ `src/js/services/core-inference.js` — Uses QOS_PROFILES correctly
- ✅ `src/js/services/processing.js` — Uses QOS_PROFILES correctly
- ✅ `src/js/services/telemetry.js` — Implements dynamic delay correctly
- 📋 Documentation needs update

---

## Conclusion

**The codebase is correct; documentation is outdated.** The actual frame timing strategy is more sophisticated than what's
