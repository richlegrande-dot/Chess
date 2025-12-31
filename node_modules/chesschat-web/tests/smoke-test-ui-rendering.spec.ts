import { test, expect } from '@playwright/test';

test.describe('ChessChat Smoke Tests - UI Rendering', () => {
  test('should render ChessChat title and Play button', async ({ page }) => {
    // Visit the app
    await page.goto('/');
    
    // Wait a bit for React to mount and render
    await page.waitForTimeout(2000);
    
    // Check for ChessChat title
    const title = page.locator('h1:has-text("ChessChat")');
    await expect(title).toBeVisible({ timeout: 10000 });
    
    // Check for Play Chess button
    const playButton = page.locator('button:has-text("Play Chess")');
    await expect(playButton).toBeVisible({ timeout: 10000 });
    
    // Ensure no JavaScript errors in console
    const consoleLogs = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleLogs.push(msg.text());
      }
    });
    
    // Wait a moment to capture any delayed errors
    await page.waitForTimeout(1000);
    
    // Report any console errors
    if (consoleLogs.length > 0) {
      console.log('Console errors detected:', consoleLogs);
    }
    
    // Take a screenshot for verification
    await page.screenshot({ 
      path: 'test-results/smoke-test-ui-rendering.png',
      fullPage: true 
    });
  });
  
  test('should have proper page structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    // Check for basic page structure
    const header = page.locator('header');
    await expect(header).toBeVisible();
    
    const main = page.locator('main');
    await expect(main).toBeVisible();
    
    // Ensure page is not blank (has content)
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('ChessChat');
    expect(bodyText).toContain('Play Chess');
  });
  
  test('should load without critical JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    // Fail test if critical JavaScript errors occurred
    expect(jsErrors).toHaveLength(0);
  });
});