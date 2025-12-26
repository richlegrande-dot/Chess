import { test, expect } from '@playwright/test';

test.describe('ChessChat App Loading Smoke Tests', () => {
  test('app root renders with UI elements (not blank page)', async ({ page }) => {
    // Go to the app
    await page.goto('/');

    // Wait for the app to load
    await page.waitForTimeout(3000);

    // Check that the page is not blank - should contain the main title
    const title = await page.textContent('h1, h2');
    expect(title).toBeTruthy();
    expect(title).toMatch(/ChessChat/i);

    // Check for the main action button
    const playButton = page.locator('button', { hasText: /play|start|new game/i });
    await expect(playButton.first()).toBeVisible({ timeout: 10000 });

    // Ensure no JavaScript errors are thrown
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Wait a bit more to catch any delayed errors
    await page.waitForTimeout(2000);

    // Fail the test if any JavaScript errors occurred
    if (errors.length > 0) {
      console.error('JavaScript errors detected:', errors);
      expect(errors.length).toBe(0);
    }
  });

  test('app displays background gradient (not completely blank)', async ({ page }) => {
    await page.goto('/');
    
    // Check that body has some styling applied
    const bodyStyles = await page.evaluate(() => {
      const body = document.body;
      const styles = window.getComputedStyle(body);
      return {
        background: styles.background,
        backgroundColor: styles.backgroundColor,
        backgroundImage: styles.backgroundImage,
      };
    });

    // Should have some kind of background styling
    const hasBackground = bodyStyles.background !== 'rgba(0, 0, 0, 0)' || 
                         bodyStyles.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
                         bodyStyles.backgroundImage !== 'none';
    
    expect(hasBackground).toBe(true);
  });

  test('navigation works from home to model selection', async ({ page }) => {
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Find and click the play button
    const playButton = page.locator('button', { hasText: /play/i }).first();
    await expect(playButton).toBeVisible({ timeout: 10000 });
    await playButton.click();
    
    // Should navigate to model selection or show model selection UI
    await page.waitForTimeout(1000);
    
    // Look for model selection elements
    const modelText = await page.textContent('body');
    expect(modelText).toMatch(/model|ai|gpt|choose|select/i);
  });
});