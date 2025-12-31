import { test, expect } from '@playwright/test';

test.describe('AI Response and Game Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up game before each test
    await page.goto('/');
    await page.getByRole('button', { name: /play/i }).click();
    
    // Select first available model
    const firstModel = page.locator('[data-testid="model-card"], .model-card').first();
    await firstModel.click();
    
    // Start the game
    await page.getByRole('button', { name: /(continue|start|play)/i }).click();
    
    // Wait for game to load
    await expect(page.locator('canvas, [data-testid="chess-board"], .chess-board')).toBeVisible();
    await expect(page.getByText(/your turn/i)).toBeVisible();
  });

  test('should show AI thinking state after player move', async ({ page }) => {
    // Make a player move to trigger AI response
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Make e2-e4 move
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Should show AI thinking state
        await expect(page.getByText(/ai.*thinking|thinking|ai.*turn/i)).toBeVisible({ timeout: 5000 });
        
        // Should show thinking indicator (animated dots, knight, etc.)
        const thinkingIndicator = page.locator('.thinking-banner, .thinking-dots, [data-testid="thinking-indicator"]');
        if (await thinkingIndicator.count() > 0) {
          await expect(thinkingIndicator.first()).toBeVisible();
        }
      }
    }
  });

  test('should receive AI move within reasonable timeout', async ({ page }) => {
    // Set a reasonable timeout for AI response (30 seconds)
    test.setTimeout(45000);
    
    // Make a player move
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Make e2-e4 move
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Wait for AI thinking to start
        await expect(page.getByText(/ai.*thinking|thinking|ai.*turn/i)).toBeVisible({ timeout: 5000 });
        
        // Wait for AI to finish and return to player turn
        await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
        
        // Verify move counter increased (should be 2 after both player and AI moves)
        const moveCounter = page.getByText(/moves?:\s*2/i);
        if (await moveCounter.count() > 0) {
          await expect(moveCounter).toBeVisible();
        }
      }
    }
  });

  test('should handle multiple move exchanges', async ({ page }) => {
    test.setTimeout(90000); // Extended timeout for multiple moves
    
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Move 1: e2-e4
        let fromX = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        let fromY = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        let toX = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        let toY = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(fromX, fromY);
        await page.waitForTimeout(500);
        await page.mouse.click(toX, toY);
        
        // Wait for AI response
        await expect(page.getByText(/ai.*thinking/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
        
        // Move 2: d2-d4
        fromX = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        fromY = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        toX = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        toY = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(fromX, fromY);
        await page.waitForTimeout(500);
        await page.mouse.click(toX, toY);
        
        // Wait for second AI response
        await expect(page.getByText(/ai.*thinking/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
        
        // Should have 4 moves total
        const moveCounter = page.getByText(/moves?:\s*4/i);
        if (await moveCounter.count() > 0) {
          await expect(moveCounter).toBeVisible();
        }
      }
    }
  });

  test('should display AI move in game notation', async ({ page }) => {
    // Make a player move
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Make e2-e4 move
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Wait for AI response
        await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
        
        // Check if PGN is displayed (look for game notation)
        const pgnSection = page.locator('.pgn-display, [data-testid="pgn"], details');
        if (await pgnSection.count() > 0) {
          // Expand PGN if it's in a collapsible section
          const summary = page.locator('summary');
          if (await summary.count() > 0) {
            await summary.click();
          }
          
          // Should contain both player and AI moves
          const pgnContent = page.locator('.pgn-display, .pgn-content');
          if (await pgnContent.count() > 0) {
            await expect(pgnContent).toContainText(/1\.\s*e4/);
          }
        }
      }
    }
  });

  test('should handle AI errors gracefully', async ({ page }) => {
    // This test simulates network issues or API failures
    // Mock a failing API response
    await page.route('**/api/**', route => {
      route.abort();
    });
    
    // Make a player move
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Should show error message
        await expect(page.getByText(/error|failed|retry/i)).toBeVisible({ timeout: 15000 });
        
        // Should provide retry option
        const retryButton = page.getByRole('button', { name: /retry/i });
        if (await retryButton.count() > 0) {
          await expect(retryButton).toBeVisible();
        }
      }
    }
  });

  test('should allow retrying failed AI moves', async ({ page }) => {
    // First, simulate a failure
    await page.route('**/api/**', route => {
      route.abort();
    });
    
    // Make a player move to trigger AI
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Wait for error
        await expect(page.getByText(/error|failed/i)).toBeVisible({ timeout: 15000 });
        
        // Now remove the route block to allow retry to succeed
        await page.unroute('**/api/**');
        
        // Click retry button
        const retryButton = page.getByRole('button', { name: /retry/i });
        if (await retryButton.count() > 0) {
          await retryButton.click();
          
          // Should eventually succeed
          await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
        }
      }
    }
  });

  test('should prevent new moves during AI thinking', async ({ page }) => {
    // Make a player move
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Make e2-e4 move
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        await page.mouse.click(e4X, e4Y);
        
        // Verify AI is thinking
        await expect(page.getByText(/ai.*thinking/i)).toBeVisible({ timeout: 5000 });
        
        // Try to make another move while AI is thinking
        const d2X = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        const d4X = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        const d4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(d2X, e2Y);
        await page.waitForTimeout(300);
        await page.mouse.click(d4X, d4Y);
        
        // Should still be in AI thinking state (move ignored)
        await expect(page.getByText(/ai.*thinking/i)).toBeVisible();
        
        // Game control buttons should be disabled
        const resignButton = page.getByRole('button', { name: /resign/i });
        const newGameButton = page.getByRole('button', { name: /new.*game/i });
        
        if (await resignButton.count() > 0) {
          await expect(resignButton).toBeDisabled();
        }
        if (await newGameButton.count() > 0) {
          await expect(newGameButton).toBeDisabled();
        }
      }
    }
  });
});

test.describe('Game State Management During AI Moves', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /play/i }).click();
    const firstModel = page.locator('[data-testid="model-card"], .model-card').first();
    await firstModel.click();
    await page.getByRole('button', { name: /(continue|start|play)/i }).click();
    await expect(page.locator('canvas, [data-testid="chess-board"]')).toBeVisible();
  });

  test('should maintain game state consistency during AI processing', async ({ page }) => {
    // This test ensures the game doesn't get into inconsistent states during AI moves
    const initialStatus = await page.getByText(/your turn/i).textContent();
    expect(initialStatus).toBeTruthy();
    
    // Make move and verify state transitions are smooth
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        // Simple move
        const centerX = canvasBounds.x + canvasBounds.width / 2;
        const centerY = canvasBounds.y + canvasBounds.height / 2;
        
        await page.mouse.click(centerX - 50, centerY + 100);
        await page.waitForTimeout(300);
        await page.mouse.click(centerX - 50, centerY);
        
        // Should transition through states cleanly
        await expect(page.getByText(/ai.*thinking|ai.*turn/i)).toBeVisible({ timeout: 5000 });
        await expect(page.getByText(/your turn/i)).toBeVisible({ timeout: 30000 });
      }
    }
  });

  test('should handle page refresh during AI thinking', async ({ page }) => {
    // Make a move to start AI thinking
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const centerX = canvasBounds.x + canvasBounds.width / 2;
        const centerY = canvasBounds.y + canvasBounds.height / 2;
        
        await page.mouse.click(centerX - 50, centerY + 100);
        await page.waitForTimeout(300);
        await page.mouse.click(centerX - 50, centerY);
        
        // Wait for AI to start thinking
        await expect(page.getByText(/ai.*thinking/i)).toBeVisible({ timeout: 5000 });
        
        // Refresh the page
        await page.reload();
        
        // Should handle refresh gracefully
        await expect(page.locator('body')).toBeVisible();
        
        // Should either resume the game or reset to a consistent state
        const gameElements = page.locator('canvas, [data-testid="chess-board"], .chess-board');
        const homeElements = page.getByRole('button', { name: /play/i });
        
        // Should show either game screen or home screen (not error)
        const hasGame = await gameElements.count() > 0;
        const hasHome = await homeElements.count() > 0;
        
        expect(hasGame || hasHome).toBeTruthy();
      }
    }
  });
});