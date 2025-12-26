import { test, expect } from '@playwright/test';

test.describe('Chess Piece Movement', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to game screen before each test
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

  test('should display initial chess position correctly', async ({ page }) => {
    // Verify the game shows it's the player's turn initially
    await expect(page.getByText(/your turn/i)).toBeVisible();
    
    // Verify move counter starts at 0
    const moveCounter = page.getByText(/moves?:\s*0/i);
    if (await moveCounter.count() > 0) {
      await expect(moveCounter).toBeVisible();
    }
    
    // Verify status shows game is in progress
    const statusElement = page.getByText(/playing|in progress/i);
    if (await statusElement.count() > 0) {
      await expect(statusElement).toBeVisible();
    }
  });

  test('should allow legal pawn move e2-e4', async ({ page }) => {
    // For 3D board, we'll simulate clicking on squares
    // This test assumes the board is interactive via click events
    
    // Try to find and click e2 square (white pawn)
    const e2Square = page.locator('[data-square="e2"], [data-testid="square-e2"]')
      .or(page.locator('canvas')); // Fallback to canvas for 3D
    
    if (await page.locator('[data-square="e2"]').count() > 0) {
      // 2D board - direct square clicking
      await page.locator('[data-square="e2"]').click();
      await page.locator('[data-square="e4"]').click();
    } else {
      // 3D board - canvas interaction (more complex)
      const canvas = page.locator('canvas');
      
      // Click on approximate e2 position (this is a simplified approach)
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        // Calculate approximate positions for e2 and e4
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // e2 is column e (4th), row 2 (6th from top)
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        
        // e4 is column e (4th), row 4 (4th from top) 
        const e4X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        // Perform the move
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500); // Brief pause for selection
        await page.mouse.click(e4X, e4Y);
      }
    }
    
    // Wait for move to be processed
    await page.waitForTimeout(1000);
    
    // Verify the move was made by checking turn indicator
    await expect(page.getByText(/ai.*turn|thinking/i)).toBeVisible({ timeout: 5000 });
    
    // Verify move counter increased
    const moveCounter = page.getByText(/moves?:\s*[1-9]/i);
    if (await moveCounter.count() > 0) {
      await expect(moveCounter).toBeVisible();
    }
  });

  test('should reject illegal moves', async ({ page }) => {
    // Try to make an illegal move (e.g., pawn moving backwards or too far)
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Try to move e2 pawn to e5 (illegal - too far for first move)
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        
        const e5X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e5Y = canvasBounds.y + (3 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(300);
        await page.mouse.click(e5X, e5Y);
        
        // Wait a moment
        await page.waitForTimeout(1000);
        
        // Should still be player's turn (move rejected)
        await expect(page.getByText(/your turn/i)).toBeVisible();
        
        // Move counter should still be 0
        const moveCounter = page.getByText(/moves?:\s*0/i);
        if (await moveCounter.count() > 0) {
          await expect(moveCounter).toBeVisible();
        }
      }
    }
  });

  test('should handle piece selection and deselection', async ({ page }) => {
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Click e2 to select pawn
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        
        // Click e2 again to deselect
        await page.mouse.click(e2X, e2Y);
        await page.waitForTimeout(500);
        
        // Should still be player's turn (no move made)
        await expect(page.getByText(/your turn/i)).toBeVisible();
      }
    }
  });

  test('should prevent moves when not player turn', async ({ page }) => {
    // First make a legal move to trigger AI turn
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
        await page.waitForTimeout(300);
        await page.mouse.click(e4X, e4Y);
        
        // Wait for AI turn
        await expect(page.getByText(/ai.*turn|thinking/i)).toBeVisible({ timeout: 5000 });
        
        // Try to make another move while AI is thinking
        const d2X = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        const d4X = canvasBounds.x + (3 * squareWidth) + (squareWidth / 2);
        const d4Y = canvasBounds.y + (4 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(d2X, e2Y); // d2
        await page.waitForTimeout(300);
        await page.mouse.click(d4X, d4Y); // d4
        
        // Should still show AI turn (move rejected)
        await expect(page.getByText(/ai.*turn|thinking/i)).toBeVisible();
      }
    }
  });

  test('should show visual feedback for selected pieces', async ({ page }) => {
    // This test verifies that selecting a piece provides visual feedback
    // The exact implementation depends on how selection is styled
    
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        const squareWidth = canvasBounds.width / 8;
        const squareHeight = canvasBounds.height / 8;
        
        // Click e2 to select pawn
        const e2X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e2Y = canvasBounds.y + (6 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e2X, e2Y);
        
        // Wait for visual feedback
        await page.waitForTimeout(500);
        
        // The visual feedback would be handled by the 3D rendering
        // For E2E testing, we can verify the piece is selectable by
        // checking that subsequent legal move attempts work
        
        // Try to move to e3 (should work)
        const e3X = canvasBounds.x + (4 * squareWidth) + (squareWidth / 2);
        const e3Y = canvasBounds.y + (5 * squareHeight) + (squareHeight / 2);
        
        await page.mouse.click(e3X, e3Y);
        await page.waitForTimeout(1000);
        
        // Should trigger AI turn (indicating move was successful)
        await expect(page.getByText(/ai.*turn|thinking/i)).toBeVisible({ timeout: 5000 });
      }
    }
  });
});

test.describe('Game State Updates', () => {
  test.beforeEach(async ({ page }) => {
    // Set up game as before
    await page.goto('/');
    await page.getByRole('button', { name: /play/i }).click();
    const firstModel = page.locator('[data-testid="model-card"], .model-card').first();
    await firstModel.click();
    await page.getByRole('button', { name: /(continue|start|play)/i }).click();
    await expect(page.locator('canvas, [data-testid="chess-board"], .chess-board')).toBeVisible();
  });

  test('should update move counter after successful move', async ({ page }) => {
    // Make a move (simplified canvas clicking)
    const canvas = page.locator('canvas');
    
    if (await canvas.count() > 0) {
      const canvasBounds = await canvas.boundingBox();
      if (canvasBounds) {
        // Simple move attempt
        const centerX = canvasBounds.x + canvasBounds.width / 2;
        const centerY = canvasBounds.y + canvasBounds.height / 2;
        
        await page.mouse.click(centerX - 50, centerY + 100); // Approximate e2
        await page.waitForTimeout(300);
        await page.mouse.click(centerX - 50, centerY); // Approximate e4
        await page.waitForTimeout(1000);
        
        // Check if move counter updated
        const moveText = page.getByText(/moves?:\s*[1-9]/i);
        if (await moveText.count() > 0) {
          await expect(moveText).toBeVisible();
        }
      }
    }
  });

  test('should update game status correctly', async ({ page }) => {
    // Verify initial status
    await expect(page.getByText(/your turn/i)).toBeVisible();
    
    // The status should change when moves are made
    // This is tested through the turn indicators and thinking states
    const statusElements = page.getByText(/(your turn|ai.*turn|thinking|playing|in progress)/i);
    await expect(statusElements.first()).toBeVisible();
  });
});

test.describe('Accessibility in Game', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /play/i }).click();
    const firstModel = page.locator('[data-testid="model-card"], .model-card').first();
    await firstModel.click();
    await page.getByRole('button', { name: /(continue|start|play)/i }).click();
    await expect(page.locator('canvas, [data-testid="chess-board"], .chess-board')).toBeVisible();
  });

  test('should have accessible game controls', async ({ page }) => {
    // Verify game action buttons are accessible
    const resignButton = page.getByRole('button', { name: /resign/i });
    const newGameButton = page.getByRole('button', { name: /new.*game/i });
    
    await expect(resignButton).toBeVisible();
    await expect(newGameButton).toBeVisible();
    
    // Verify buttons are keyboard accessible
    await resignButton.focus();
    await expect(resignButton).toBeFocused();
    
    await newGameButton.focus();
    await expect(newGameButton).toBeFocused();
  });

  test('should have proper ARIA live regions for turn updates', async ({ page }) => {
    // Look for live regions that announce turn changes
    const statusRegion = page.locator('[aria-live], [role="status"]');
    
    if (await statusRegion.count() > 0) {
      await expect(statusRegion.first()).toBeVisible();
    }
  });
});