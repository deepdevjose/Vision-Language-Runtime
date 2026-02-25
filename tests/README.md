# Testing Guide

## Overview

This project includes both unit tests and end-to-end (E2E) tests to ensure code quality and functionality.

## Setup

First, install dependencies:

```bash
npm install
```

## Unit Tests

Unit tests cover core utilities and business logic.

### Run All Unit Tests

```bash
npm run test:unit
```

### Individual Test Files

```bash
# State Manager tests
node tests/state-manager.test.js

# Caption Normalizer tests
node tests/caption-normalizer.test.js
```

### Covered Components

- **StateManager**: State management, subscriptions, updates
- **Caption Normalizer**: Text cleaning, normalization, artifact removal

## E2E Tests (Playwright)

End-to-end tests validate the full application flow in real browsers.

### Install Playwright Browsers

```bash
npx playwright install
```

### Run E2E Tests

```bash
# Headless mode (default)
npm run test:e2e

# Headed mode (see browser)
npm run test:e2e:headed

# UI mode (interactive)
npm run test:e2e:ui
```

### Test Coverage

- ✅ Page loads successfully
- ✅ Welcome screen displays
- ✅ WebGPU fallback UI (simulated unsupported browser)
- ✅ Webcam permission flow
- ✅ Mobile viewport responsive UI
- ✅ Loading screen progress
- ✅ Prompt input functionality
- ✅ Performance metrics (load time < 5s)

### Browser Support

Tests run against:
- Chromium (Desktop)
- Firefox (Desktop)
- WebKit (Desktop Safari)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

## Type Checking

This project uses JSDoc for type annotations with TypeScript in check-only mode.

### Run Type Check

```bash
npm run type-check
```

### Benefits

- IDE autocomplete and IntelliSense
- Type safety without compilation
- Better documentation
- Catches errors early

## Writing Tests

### Unit Test Example

```javascript
test('your test name', () => {
    const result = yourFunction();
    assertEqual(result, expectedValue, 'error message');
});
```

### E2E Test Example

```javascript
test('feature description', async ({ page }) => {
    await page.goto('http://localhost:8000/');
    const element = page.locator('.your-selector');
    await expect(element).toBeVisible();
});
```

## Continuous Integration

Tests can be integrated into CI/CD pipelines:

```yaml
# .github/workflows/test.yml example
- name: Run tests
  run: |
    npm install
    npx playwright install --with-deps
    npm test
```

## Debugging

### Debug Unit Tests

Add `console.log` statements or use Node.js debugger:

```bash
node --inspect-brk tests/state-manager.test.js
```

### Debug E2E Tests

```bash
# Visual debugging
npm run test:e2e:ui

# Browser DevTools
npm run test:e2e:headed
```

### Playwright Trace Viewer

When tests fail, check the trace:

```bash
npx playwright show-trace trace.zip
```

## Performance Testing

Monitor test execution time:

```bash
# With timing
time npm test

# Playwright reporter includes timing
npx playwright show-report
```

## Best Practices

1. **Keep tests isolated** - Each test should work independently
2. **Use descriptive names** - Test names should explain what they verify
3. **Avoid hardcoded waits** - Use Playwright's auto-waiting features
4. **Test user flows** - Focus on real-world scenarios
5. **Mock external dependencies** - Keep tests fast and reliable

## Troubleshooting

### "Cannot find module" errors

Make sure you're using ES modules:
```json
{
  "type": "module"
}
```

### WebGPU tests fail in headless

Expected behavior - WebGPU may not work in headless browsers. Use `--headed` flag.

### Port 8000 already in use

Change port in `playwright.config.js`:
```javascript
webServer: {
  command: 'http-server src -p 8001',
  url: 'http://localhost:8001'
}
```

## Code Coverage (Future)

To add code coverage:

```bash
npm install --save-dev c8
```

Update `package.json`:
```json
{
  "scripts": {
    "test:coverage": "c8 npm run test:unit"
  }
}
```
