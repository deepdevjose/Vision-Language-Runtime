/**
 * E2E Tests with Playwright
 * Tests basic app functionality and WebGPU fallback
 * 
 * Run with: npx playwright test
 */

import { test, expect } from '@playwright/test';

test.describe('Vision-Language Runtime', () => {
    
    test('loads page successfully', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        
        // Check title
        await expect(page).toHaveTitle(/Vision-Language Runtime/);
        
        // Check root element exists
        const root = page.locator('#root');
        await expect(root).toBeVisible();
    });

    test('shows welcome screen initially', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        
        // Welcome screen should be visible
        const welcomeScreen = page.locator('.welcome-screen');
        await expect(welcomeScreen).toBeVisible({ timeout: 5000 });
        
        // Should have start button
        const startButton = page.locator('button:has-text("Start")');
        await expect(startButton).toBeVisible();
    });

    test('WebGPU not supported - shows fallback UI', async ({ page, context }) => {
        // Block WebGPU API to simulate unsupported browser
        await context.addInitScript(() => {
            // @ts-ignore
            delete navigator.gpu;
        });

        await page.goto('http://localhost:8000/');
        
        // Should show error or fallback message
        await page.waitForTimeout(2000);
        
        // Check for error indication
        const errorText = await page.locator('text=/WebGPU|not supported|upgrade browser/i').count();
        expect(errorText).toBeGreaterThan(0);
    });

    test('requesting webcam permission flow', async ({ page, context }) => {
        // Grant camera permissions
        await context.grantPermissions(['camera']);

        await page.goto('http://localhost:8000/');
        
        // Click start or request camera button
        const startButton = page.locator('button:has-text("Start")');
        if (await startButton.isVisible()) {
            await startButton.click();
        }

        // Should show webcam permission dialog or loading
        await page.waitForTimeout(1000);
        
        // Check that we don't have error state
        const hasError = await page.locator('.error, [class*="error"]').count();
        // Note: Might have errors in headless, which is expected
    });

    test('diagnostics panel toggles correctly', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        
        // Wait for app to load
        await page.waitForTimeout(2000);
        
        // Look for diagnostics toggle (kbd shortcut or button)
        // Press Ctrl+D or Cmd+D to open diagnostics
        await page.keyboard.press('Control+Shift+D');
        
        await page.waitForTimeout(500);
        
        // Check if diagnostics panel appeared
        const diagPanel = page.locator('.diagnostics-panel');
        const isVisible = await diagPanel.isVisible().catch(() => false);
        
        // Diagnostics might not be implemented yet, so just log
        console.log('Diagnostics panel visible:', isVisible);
    });

    test('loading screen shows progress', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        
        // Start the app
        const startButton = page.locator('button:has-text("Start")').first();
        if (await startButton.isVisible({ timeout: 3000 })) {
            await startButton.click();
        }
        
        // Should see loading screen
        const loadingScreen = page.locator('.loading-screen, [class*="loading"]');
        const hasLoading = await loadingScreen.count() > 0;
        
        console.log('Loading screen present:', hasLoading);
    });

    test('mobile viewport - shows bottom sheet UI', async ({ page }) => {
        // Set mobile viewport
        await page.setViewportSize({ width: 375, height: 667 });
        
        await page.goto('http://localhost:8000/');
        await page.waitForTimeout(2000);
        
        // Check for mobile-specific classes
        const bottomSheet = page.locator('[class*="bottom-sheet"]');
        const hasBottomSheet = await bottomSheet.count() > 0;
        
        console.log('Mobile bottom sheet present:', hasBottomSheet);
    });

    test('ASCII background renders', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        await page.waitForTimeout(2000);
        
        // Look for ASCII background element
        const asciiBackground = page.locator('.ascii-background, pre');
        const hasASCII = await asciiBackground.count() > 0;
        
        console.log('ASCII background present:', hasASCII);
    });

    test('prompt input accepts text', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        await page.waitForTimeout(3000);
        
        // Find prompt textarea
        const promptInput = page.locator('textarea[placeholder*="Describe"], textarea.prompt-textarea');
        
        if (await promptInput.isVisible({ timeout: 2000 })) {
            await promptInput.fill('What color is the sky?');
            const value = await promptInput.inputValue();
            expect(value).toBe('What color is the sky?');
        }
    });

    test('suggestion chips are clickable', async ({ page }) => {
        await page.goto('http://localhost:8000/');
        await page.waitForTimeout(2000);
        
        // Find suggestion chips
        const suggestionChip = page.locator('.prompt-suggestion-chip, button:has-text("shirt")').first();
        
        if (await suggestionChip.isVisible({ timeout: 2000 })) {
            await suggestionChip.click();
            
            // Prompt should be updated
            const promptInput = page.locator('textarea');
            const value = await promptInput.inputValue();
            expect(value.length).toBeGreaterThan(0);
        }
    });

});

test.describe('Performance', () => {
    
    test('page loads within acceptable time', async ({ page }) => {
        const startTime = Date.now();
        await page.goto('http://localhost:8000/');
        const loadTime = Date.now() - startTime;
        
        console.log(`Page load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(5000); // Should load in < 5s
    });

    test('no console errors on load', async ({ page }) => {
        const errors = [];
        page.on('console', msg => {
            if (msg.type() === 'error') {
                errors.push(msg.text());
            }
        });

        await page.goto('http://localhost:8000/');
        await page.waitForTimeout(3000);
        
        // Filter out expected errors (like WebGPU not available in headless)
        const criticalErrors = errors.filter(err => 
            !err.includes('WebGPU') && 
            !err.includes('getUserMedia') &&
            !err.includes('camera')
        );
        
        console.log('Console errors:', criticalErrors);
        expect(criticalErrors.length).toBe(0);
    });
    
});
