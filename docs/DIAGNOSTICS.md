# Diagnostics & Logging

## Diagnostics Panel

The built-in diagnostics panel provides real-time system information and performance metrics.

### Opening the Panel

**Keyboard Shortcut:**
- Windows/Linux: `Ctrl + Shift + D`
- macOS: `Cmd + Shift + D`

**Console Access:**
```javascript
// Open panel
window.__VLM_DIAGNOSTICS__.show();

// Close panel
window.__VLM_DIAGNOSTICS__.hide();

// Toggle panel
window.__VLM_DIAGNOSTICS__.toggle();

// Force update
window.__VLM_DIAGNOSTICS__.update();
```

### Panel Sections

#### 🎮 GPU Information

- **WebGPU Support**: ✅/❌ Indicates WebGPU availability
- **FP16 Support**: Float16 precision capability (2× faster)
- **Adapter**: GPU model/vendor information
- **Max Buffer**: Maximum buffer size (MB)
- **Max Texture Size**: Maximum texture dimension
- **Performance Tier**: LOW/MEDIUM/HIGH based on GPU capabilities
- **Expected Latency**: Estimated inference speed

#### 🤖 Model State

- **Status**: Loaded/Loading/Not loaded
- **Warmed Up**: Model warmup completion status
- **Avg Inference**: Average inference time (seconds)

#### ⚡ Performance Metrics

- **Avg Inference Time**: Rolling average of last 5 inferences
- **Est. Tokens/s**: Estimated token generation rate
- **Max FPS**: Maximum frames per second capability
- **Est. Memory**: Approximate memory usage (~2GB for FastVLM-0.5B)
- **User Agent**: Browser information

#### 📋 Logs

- **Total Logs**: Count by level (Debug/Info/Warn/Error)
- **Export Logs**: Download logs as JSON file
- **Clear Logs**: Reset log history

### Auto-Refresh

The diagnostics panel automatically updates every 2 seconds when visible.

---

## Logger System

Advanced logging system with levels, filtering, and export capabilities.

### Usage

```javascript
import logger from './utils/logger.js';

// Log at different levels
logger.debug('Detailed debug information', { extra: 'data' });
logger.info('General information', { userId: 123 });
logger.warn('Warning message', { issue: 'something' });
logger.error('Error occurred', { error: errorObj });
```

### Console Access

```javascript
const logger = window.__VLM_LOGGER__;

// Get all logs
const allLogs = logger.getLogs();

// Filter by level
const errors = logger.getLogs('error');
const warnings = logger.getLogs('warn');

// Export logs
const json = logger.exportLogs();
console.log(json);

// Download logs
logger.downloadLogs(); // Downloads JSON file

// Clear logs
logger.clear();

// Get statistics
const stats = logger.getStats();
// { total: 150, debug: 50, info: 80, warn: 15, error: 5 }
```

### Log Levels

| Level | Priority | Use Case | Console Style |
|-------|----------|----------|---------------|
| `debug` | 0 | Detailed debugging info | 🔍 Gray |
| `info` | 1 | General information | ℹ️ Blue |
| `warn` | 2 | Warning messages | ⚠️ Orange |
| `error` | 3 | Error conditions | ❌ Red |

### Configuration

```javascript
// Set minimum log level (filters lower priority)
logger.setMinLevel('warn'); // Only shows warn + error

// Enable/disable logging
logger.setEnabled(false); // Stop all logging
logger.setEnabled(true);  // Resume logging

// Check current settings
logger.minLevel; // 'info'
logger.enabled;  // true
logger.maxLogs;  // 500 (max stored logs)
```

### Log Entry Format

```javascript
{
  level: 'info',
  message: 'Model loaded successfully',
  timestamp: '2026-02-24T20:15:30.123Z',
  context: {
    modelId: 'FastVLM-0.5B',
    loadTime: 32500
  }
}
```

### Best Practices

#### 1. Use Appropriate Levels

```javascript
// ✅ Good
logger.debug('Raw frame data', { width, height, pixels });
logger.info('Inference started', { prompt });
logger.warn('Slow inference detected', { time: 5000 });
logger.error('Model failed to load', { error });

// ❌ Avoid
logger.error('User clicked button'); // Not an error
logger.debug('Application crashed'); // Too low priority
```

#### 2. Include Context

```javascript
// ✅ Good - includes useful context
logger.info('Camera switched', {
  from: oldDeviceId,
  to: newDeviceId,
  resolution: '1920x1080'
});

// ❌ Less useful
logger.info('Camera switched');
```

#### 3. Production Settings

```javascript
// Development
logger.setMinLevel('debug');

// Production
logger.setMinLevel('info'); // Hide debug noise
```

### Integration with Services

```javascript
// In vision-language-service.js
import logger from '../utils/logger.js';

async loadModel(onProgress) {
  logger.info('Starting model load', { modelId: MODEL_CONFIG.MODEL_ID });
  
  try {
    // ... loading code ...
    logger.info('Model loaded successfully', { loadTime });
  } catch (error) {
    logger.error('Model load failed', { error: error.message });
    throw error;
  }
}
```

### Performance Considerations

- Logs are capped at 500 entries (configurable via `logger.maxLogs`)
- Older logs are automatically removed (FIFO)
- Logging can be disabled in production for performance
- Console styling is minimal (no performance impact)

### Exporting Logs

#### Manual Export

```javascript
// Get JSON string
const json = logger.exportLogs('warn'); // Only warn+error

// Create downloadable file
logger.downloadLogs(); // All logs
logger.downloadLogs('error'); // Errors only
```

#### Automatic Export on Error

```javascript
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection', {
    reason: event.reason
  });
  
  // Auto-export logs on critical error
  logger.downloadLogs('warn');
});
```

### Debugging Production Issues

1. **Enable diagnostics panel** in user's browser
2. **Export logs** - User can download via diagnostics panel
3. **Analyze** - Review JSON file for error patterns
4. **Correlate** - Match timestamps with user actions

### Log Rotation (Advanced)

For long-running sessions:

```javascript
// Periodic log rotation
setInterval(() => {
  const stats = logger.getStats();
  
  if (stats.total > 400) {
    logger.exportLogs(); // Auto-backup
    logger.clear();
    logger.info('Logs rotated (auto-backup created)');
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

---

## Monitoring Production

### Key Metrics to Track

1. **WebGPU Support Rate**: % of users with WebGPU
2. **Average Inference Time**: Performance across devices
3. **Error Rate**: Frequency of errors by type
4. **Browser Distribution**: Chrome/Firefox/Safari usage

### Adding Custom Metrics

```javascript
// Track inference timing
const start = performance.now();
const result = await vlmService.runInference(...);
const duration = performance.now() - start;

logger.info('Inference completed', {
  duration,
  prompt: currentPrompt,
  captionLength: result.length,
  userAgent: navigator.userAgent
});
```

### Analytics Integration

```javascript
// Send critical events to analytics
logger.subscribe = (entry) => {
  if (entry.level === 'error') {
    // Send to analytics service
    analytics.track('error', {
      message: entry.message,
      context: entry.context
    });
  }
};
```

---

## Troubleshooting

### Panel Doesn't Open

1. Check keyboard shortcut is correct
2. Try console: `window.__VLM_DIAGNOSTICS__.show()`
3. Check for JavaScript errors in DevTools

### Logs Missing

1. Check min level: `logger.minLevel`
2. Verify logging enabled: `logger.enabled`
3. Check if logs cleared: `logger.getStats()`

### Performance Impact

Logging is optimized but can impact performance at DEBUG level:

```javascript
// Production optimization
if (process.env.NODE_ENV === 'production') {
  logger.setMinLevel('warn');
}
```
