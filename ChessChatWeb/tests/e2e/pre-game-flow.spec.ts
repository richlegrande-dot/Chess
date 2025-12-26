import { test, expect } from '@playwright/test';

test.describe('Pre-Game Navigation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the home page before each test
    await page.goto('/');
  });

  test('should load home page correctly', async ({ page }) => {
    // Verify the home page loads
    await expect(page).toHaveTitle(/ChessChat/i);
    
    // Check for main heading
    await expect(page.getByRole('heading', { name: /chesschat/i })).toBeVisible();
    
    // Verify play button is present and clickable
    const playButton = page.getByRole('button', { name: /play/i });
    await expect(playButton).toBeVisible();
    await expect(playButton).toBeEnabled();
  });

  test('should navigate from home to model selection', async ({ page }) => {
    // Click the play button
    await page.getByRole('button', { name: /play/i }).click();
    
    // Verify we're on the model selection page
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
    
    // Verify at least one model card is visible
    const modelCards = page.locator('[data-testid="model-card"], .model-card').first();
    await expect(modelCards).toBeVisible();
    
    // Verify back button exists
    const backButton = page.getByRole('button', { name: /back/i });
    await expect(backButton).toBeVisible();
  });

  test('should complete full navigation: Home → Model Selection → Game', async ({ page }) => {
    // Step 1: Home to Model Selection
    await page.getByRole('button', { name: /play/i }).click();
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
    
    // Step 2: Select a model (find first available model)
    const firstModelCard = page.locator('[data-testid="model-card"], .model-card').first();
    await expect(firstModelCard).toBeVisible();
    await firstModelCard.click();
    
    // Step 3: Continue to game (look for continue/start button)
    const continueButton = page.getByRole('button', { name: /(continue|start|play)/i });
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    
    // Step 4: Verify game screen loads
    // Look for chess board indicators
    await expect(page.locator('canvas, [data-testid="chess-board"], .chess-board')).toBeVisible();
    
    // Verify game UI elements
    await expect(page.getByText(/your turn|ai.*turn/i)).toBeVisible();
    
    // Verify game actions are available
    const resignButton = page.getByRole('button', { name: /resign/i });
    const newGameButton = page.getByRole('button', { name: /new.*game/i });
    
    await expect(resignButton).toBeVisible();
    await expect(newGameButton).toBeVisible();
  });

  test('should handle back navigation correctly', async ({ page }) => {
    // Navigate to model selection
    await page.getByRole('button', { name: /play/i }).click();
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
    
    // Click back button
    await page.getByRole('button', { name: /back/i }).click();
    
    // Verify we're back on home page
    await expect(page.getByRole('heading', { name: /chesschat/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
  });
});

test.describe('Settings and Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should access settings from home page', async ({ page }) => {
    // Look for settings button (gear icon, menu, etc.)
    const settingsButton = page.getByRole('button', { name: /settings/i })
      .or(page.locator('[aria-label="Settings"]'))
      .or(page.locator('.settings-button'));
    
    if (await settingsButton.count() > 0) {
      await settingsButton.click();
      
      // Verify settings modal/page opens
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
      
      // Look for model selection in settings
      const modelSettings = page.getByText(/model|ai|gpt/i);
      await expect(modelSettings.first()).toBeVisible();
      
      // Close settings
      const closeButton = page.getByRole('button', { name: /(close|×)/i });
      if (await closeButton.count() > 0) {
        await closeButton.click();
      }
    }
  });

  test('should handle 3D toggle if available', async ({ page }) => {
    // Navigate to settings
    const settingsButton = page.getByRole('button', { name: /settings/i })
      .or(page.locator('[aria-label="Settings"]'));
    
    if (await settingsButton.count() > 0) {
      await settingsButton.click();
      
      // Look for 3D toggle
      const threeDToggle = page.getByRole('checkbox', { name: /3d/i })
        .or(page.getByText(/3d.*board/i));
      
      if (await threeDToggle.count() > 0) {
        // Test toggling 3D mode
        await threeDToggle.click();
        
        // Close settings and start a game to test 3D
        await page.getByRole('button', { name: /(close|×)/i }).click();
        await page.getByRole('button', { name: /play/i }).click();
        
        // Select model and start game
        const firstModel = page.locator('[data-testid="model-card"], .model-card').first();
        await firstModel.click();
        await page.getByRole('button', { name: /(continue|start)/i }).click();
        
        // Verify 3D canvas appears
        await expect(page.locator('canvas')).toBeVisible();
      }
    }
  });
});

test.describe('Responsive Design and Accessibility', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Verify main elements are still visible and clickable
    await expect(page.getByRole('heading', { name: /chesschat/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
    
    // Test navigation still works
    await page.getByRole('button', { name: /play/i }).click();
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
  });

  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through main elements
    await page.keyboard.press('Tab');
    
    // Verify focus is visible (the play button should be focusable)
    const playButton = page.getByRole('button', { name: /play/i });
    await expect(playButton).toBeFocused();
    
    // Activate with Enter or Space
    await page.keyboard.press('Enter');
    
    // Should navigate to model selection
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper heading hierarchy
    const mainHeading = page.getByRole('heading', { level: 1 });
    await expect(mainHeading).toBeVisible();
    
    // Check for proper button roles
    const playButton = page.getByRole('button', { name: /play/i });
    await expect(playButton).toHaveAttribute('type', 'button');
    
    // Navigate to model selection and check accessibility
    await playButton.click();
    
    // Verify model cards have proper labels
    const modelCards = page.locator('[data-testid="model-card"], .model-card');
    const firstCard = modelCards.first();
    
    if (await firstCard.count() > 0) {
      // Should have accessible name
      await expect(firstCard).toHaveAttribute('role', /button|article/);
    }
  });
});

test.describe('Error Handling and Edge Cases', () => {
  test('should handle slow network conditions gracefully', async ({ page }) => {
    // Simulate slow network
    await page.route('**/*', route => {
      setTimeout(() => route.continue(), 100);
    });
    
    await page.goto('/');
    
    // Should still load eventually
    await expect(page.getByRole('heading', { name: /chesschat/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /play/i })).toBeVisible();
  });

  test('should handle page refresh during navigation', async ({ page }) => {
    await page.goto('/');
    
    // Navigate to model selection
    await page.getByRole('button', { name: /play/i }).click();
    await expect(page.getByRole('heading', { name: /choose.*ai.*model/i })).toBeVisible();
    
    // Refresh the page
    await page.reload();
    
    // Should handle refresh gracefully (either stay on model selection or redirect appropriately)
    await expect(page.locator('body')).toBeVisible();
    
    // At minimum, should not show error page
    const errorText = page.getByText(/error|crash|broken/i);
    await expect(errorText).not.toBeVisible();
  });
});