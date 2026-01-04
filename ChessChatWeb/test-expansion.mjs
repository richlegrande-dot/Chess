// Simpler full match test focusing on component expansion
import { chromium } from 'playwright';

const TEST_URL = 'https://ba02fedf.chesschat.pages.dev'; // Use preview deployment
const TIMEOUT = 30000;

async function testComponentExpansion() {
  console.log('🎮 Testing Captured Pieces Component Expansion\n');
  
  const browser = await chromium.launch({ 
    headless: false,
    slowMo: 500  // Slower for visibility
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate
    console.log('1️⃣ Loading chesschat.uk...');
    await page.goto(TEST_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    await page.waitForTimeout(3000);
    console.log('   ✅ Loaded\n');
    
    // Go to Coaching Mode
    console.log('2️⃣ Opening Coaching Mode...');
    await page.getByRole('button', { name: /Coaching Mode/i }).click();
    await page.waitForTimeout(2000);
    console.log('   ✅ Coaching Mode opened\n');
    
    // Select 2-Player
    console.log('3️⃣ Selecting 2-Player mode...');
    await page.getByRole('button', { name: '2 Player' }).click();
    await page.waitForTimeout(1500);
    console.log('   ✅ 2-Player selected\n');
    
    // Find component
    console.log('4️⃣ Finding Captured Pieces component...');
    const component = page.locator('.captured-pieces-display');
    const isVisible = await component.isVisible({ timeout: 5000 });
    
    if (!isVisible) {
      throw new Error('Captured Pieces component not visible!');
    }
    console.log('   ✅ Component found and visible\n');
    
    // Measure initial size
    const initialBox = await component.boundingBox();
    console.log(`📏 Initial Size: ${Math.round(initialBox.width)}px × ${Math.round(initialBox.height)}px\n`);
    
    // Play a series of moves with captures
    console.log('5️⃣ Playing game with captures...\n');
    
    const gameMoves = [
      ['e2', 'e4', 'White pawn forward'],
      ['d7', 'd5', 'Black pawn forward'],
      ['e4', 'd5', '⚡ WHITE CAPTURES black pawn'],
      ['d8', 'd5', 'Black queen captures'],
      ['b1', 'c3', 'White knight out'],
      ['d5', 'd1', '⚡ BLACK CAPTURES white queen!'],
      ['e1', 'd1', 'White king captures'],
      ['c8', 'f5', 'Black bishop out'],
      ['c3', 'b5', 'White knight'],
      ['f5', 'c2', '⚡ BLACK CAPTURES white pawn'],
      ['b5', 'c7', '⚡ WHITE CAPTURES black pawn'],
      ['e8', 'd8', 'Black king moves'],
      ['c7', 'a8', '⚡ WHITE CAPTURES black rook!'],
    ];
    
    for (const [from, to, description] of gameMoves) {
      console.log(`   ${description}`);
      
      try {
        await clickSquare(page, from);
        await page.waitForTimeout(400);
        await clickSquare(page, to);
        await page.waitForTimeout(1200);
        
        // Check captured pieces after each capture
        if (description.includes('⚡')) {
          const redCount = await page.locator('.captured-row.red .captured-piece').count();
          const blackCount = await page.locator('.captured-row.black .captured-piece').count();
          const currentBox = await component.boundingBox();
          console.log(`      → Captured: RED=${redCount}, BLACK=${blackCount}, Height=${Math.round(currentBox.height)}px`);
        }
      } catch (e) {
        console.log(`      ⚠️ Move failed: ${e.message}`);
      }
    }
    
    // Final measurements
    console.log('\n📊 FINAL RESULTS:\n');
    
    const finalBox = await component.boundingBox();
    const heightChange = finalBox.height - initialBox.height;
    const widthChange = finalBox.width - initialBox.width;
    
    console.log(`📏 Final Size: ${Math.round(finalBox.width)}px × ${Math.round(finalBox.height)}px`);
    console.log(`📈 Height Change: ${heightChange > 0 ? '+' : ''}${Math.round(heightChange)}px`);
    console.log(`📈 Width Change: ${widthChange > 0 ? '+' : ''}${Math.round(widthChange)}px\n`);
    
    const redTotal = await page.locator('.captured-row.red .captured-piece').count();
    const blackTotal = await page.locator('.captured-row.black .captured-piece').count();
    
    console.log('═══════════════════════════════════════════════');
    console.log('✅ TEST COMPLETE - COMPONENT EXPANSION ANALYSIS');
    console.log('═══════════════════════════════════════════════');
    console.log(`🔴 RED Section: ${redTotal} captured pieces`);
    console.log(`⚫ BLACK Section: ${blackTotal} captured pieces`);
    console.log(`📦 Component Height: ${heightChange > 20 ? 'EXPANDED ✅' : heightChange > 0 ? 'Slight expansion' : 'NO CHANGE ❌'}`);
    console.log(`📦 Flex Wrap Working: ${widthChange === 0 ? 'YES ✅ (pieces wrap within container)' : 'Width changed'}`);
    console.log('═══════════════════════════════════════════════\n');
    
    // Take screenshot
    await page.screenshot({ path: 'expansion-test-final.png', fullPage: true });
    console.log('📸 Screenshot saved: expansion-test-final.png');
    
    // Keep browser open for visual inspection
    console.log('\n👀 Browser will stay open for 10 seconds for visual inspection...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    await page.screenshot({ path: 'expansion-test-error.png' });
  } finally {
    await browser.close();
    console.log('✅ Test complete\n');
  }
}

async function clickSquare(page, square) {
  // Try data attribute first
  let clicked = false;
  
  try {
    const selector = `[data-square="${square}"]`;
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      await element.click({ timeout: 2000 });
      return;
    }
  } catch {}
  
  // Fallback to coordinate-based clicking
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0-7
  const rank = parseInt(square[1]) - 1; // 0-7
  
  const board = page.locator('.chess-board-practice, .coaching-board-container').first();
  const box = await board.boundingBox();
  
  if (box) {
    const squareSize = box.width / 8;
    const x = box.x + (file * squareSize) + (squareSize / 2);
    const y = box.y + ((7 - rank) * squareSize) + (squareSize / 2);
    await page.mouse.click(x, y);
  }
}

// Run
testComponentExpansion().catch(console.error);
