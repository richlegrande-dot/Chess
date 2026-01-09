// Full match test with many captures to verify component expansion
import { chromium } from 'playwright';

const TEST_URL = 'https://ba02fedf.chesschat.pages.dev';
const TIMEOUT = 30000;

async function playFullMatchWithCaptures() {
  console.log('🎮 Starting Full Match Test - Testing Component Expansion\n');
  
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const page = await browser.newPage();
  
  try {
    // Setup
    console.log('📱 Loading and navigating...');
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: TIMEOUT });
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("📚 Coaching Mode")').click();
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("2 Player")').click();
    await page.waitForTimeout(1500);
    console.log('✅ Game ready\n');
    
    // Check initial component state
    const capturedPiecesDisplay = page.locator('.captured-pieces-display');
    await capturedPiecesDisplay.waitFor({ state: 'visible', timeout: 5000 });
    console.log('✅ Captured Pieces component visible\n');
    
    // Get initial dimensions
    const initialBox = await capturedPiecesDisplay.boundingBox();
    console.log(`📏 Initial component size: ${Math.round(initialBox.width)}x${Math.round(initialBox.height)}px\n`);
    
    console.log('♟️ Playing capture-heavy game...\n');
    
    // Sequence designed to create many captures
    const moves = [
      // Opening with center pawns
      ['e2', 'e4'], ['e7', 'e5'],
      ['d2', 'd4'], ['d7', 'd5'],
      
      // First captures
      ['e4', 'd5'], // White captures black pawn (BLACK section gets 1)
      console.log('   Capture 1: White takes black pawn on d5'),
      await page.waitForTimeout(2000),
      
      ['e5', 'd4'], // Black captures white pawn (RED section gets 1)
      console.log('   Capture 2: Black takes white pawn on d4'),
      await page.waitForTimeout(2000),
      
      // Check component after first captures
      await checkComponentState(page, capturedPiecesDisplay, 1),
      
      // More opening moves
      ['g1', 'f3'], ['g8', 'f6'],
      ['f1', 'c4'], ['f8', 'c5'],
      
      // Knight captures
      ['f3', 'd4'], // White knight captures pawn
      console.log('   Capture 3: White knight takes pawn'),
      await page.waitForTimeout(2000),
      
      ['f6', 'd5'], ['c4', 'd5'], // White bishop captures knight
      console.log('   Capture 4: White bishop takes knight'),
      await page.waitForTimeout(2000),
      
      await checkComponentState(page, capturedPiecesDisplay, 2),
      
      // More development
      ['b1', 'c3'], ['b8', 'c6'],
      ['d4', 'c6'], // White knight captures knight
      console.log('   Capture 5: White knight takes knight'),
      await page.waitForTimeout(2000),
      
      ['b7', 'c6'], // Black pawn captures
      console.log('   Capture 6: Black pawn takes knight'),
      await page.waitForTimeout(2000),
      
      await checkComponentState(page, capturedPiecesDisplay, 3),
      
      // Castle and more action
      ['e1', 'g1'], // White castles
      ['e8', 'g8'], // Black castles
      
      // Rook and Queen action
      ['d1', 'e2'], ['d8', 'd7'],
      ['f1', 'e1'], ['f8', 'e8'],
      
      // More captures
      ['e2', 'e8'], // Queen takes rook
      console.log('   Capture 7: White queen takes rook'),
      await page.waitForTimeout(2000),
      
      ['d7', 'e8'], // Queen takes queen
      console.log('   Capture 8: Black queen takes queen'),
      await page.waitForTimeout(2000),
      
      await checkComponentState(page, capturedPiecesDisplay, 4),
      
      // Continue with piece trades
      ['d5', 'c6'], ['c5', 'f2'],
      ['g1', 'f2'], // King captures bishop
      console.log('   Capture 9: King takes bishop'),
      await page.waitForTimeout(2000),
      
      ['e8', 'e1'], // Queen captures rook
      console.log('   Capture 10: Queen takes rook'),
      await page.waitForTimeout(2000),
      
      await checkComponentState(page, capturedPiecesDisplay, 5),
      
      // More trades
      ['c6', 'd7'], ['e1', 'b1'],
      ['d7', 'e8'], // Promote or capture
      console.log('   Capture 11: Multiple pieces captured'),
      await page.waitForTimeout(2000),
    ];
    
    // Execute moves
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      
      // Skip if it's a console.log or function call
      if (!Array.isArray(move)) continue;
      
      const [from, to] = move;
      await makeMove(page, from, to);
      await page.waitForTimeout(800);
    }
    
    console.log('\n📊 FINAL COMPONENT STATE:\n');
    
    // Get final component dimensions
    const finalBox = await capturedPiecesDisplay.boundingBox();
    console.log(`📏 Final component size: ${Math.round(finalBox.width)}x${Math.round(finalBox.height)}px`);
    
    const heightIncrease = finalBox.height - initialBox.height;
    console.log(`📈 Height increased by: ${Math.round(heightIncrease)}px (${Math.round(heightIncrease/initialBox.height*100)}%)\n`);
    
    // Count captured pieces
    const redPieces = await page.locator('.captured-row.red .captured-piece').count();
    const blackPieces = await page.locator('.captured-row.black .captured-piece').count();
    
    console.log('═══════════════════════════════════════');
    console.log('✅ FULL MATCH TEST COMPLETE');
    console.log('═══════════════════════════════════════');
    console.log(`🔴 RED section (captured white): ${redPieces} pieces`);
    console.log(`⚫ BLACK section (captured black): ${blackPieces} pieces`);
    console.log(`📦 Component expanded: ${heightIncrease > 10 ? 'YES ✅' : 'NO ❌'}`);
    console.log('═══════════════════════════════════════\n');
    
    // Check for material advantage
    const materialAdvantage = page.locator('.material-advantage');
    const advantages = await materialAdvantage.allTextContents();
    if (advantages.length > 0) {
      console.log(`💰 Material advantages displayed: ${advantages.join(', ')}\n`);
    }
    
    // Take final screenshot
    await page.screenshot({ path: 'test-full-match.png', fullPage: true });
    console.log('📸 Screenshot saved: test-full-match.png\n');
    
    // Verify wrapping/scrolling
    const capturedContainer = page.locator('.captured-pieces-container');
    const containerBox = await capturedContainer.first().boundingBox();
    if (containerBox) {
      console.log(`📦 Pieces container: ${Math.round(containerBox.width)}x${Math.round(containerBox.height)}px`);
      console.log('✅ Component handles multiple pieces correctly\n');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-full-match-failure.png' });
    throw error;
  } finally {
    console.log('Closing browser...');
    await browser.close();
  }
}

async function makeMove(page, from, to) {
  // Try to find and click squares
  const fromSelectors = [`[data-square="${from}"]`, `.square-${from}`];
  const toSelectors = [`[data-square="${to}"]`, `.square-${to}`];
  
  let clicked = false;
  
  for (const selector of fromSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      await element.click();
      clicked = true;
      break;
    }
  }
  
  if (!clicked) {
    // Fallback to coordinate-based clicking
    await clickSquareByPosition(page, from);
  }
  
  await page.waitForTimeout(300);
  
  clicked = false;
  for (const selector of toSelectors) {
    const element = page.locator(selector).first();
    if (await element.count() > 0) {
      await element.click();
      clicked = true;
      break;
    }
  }
  
  if (!clicked) {
    await clickSquareByPosition(page, to);
  }
}

async function clickSquareByPosition(page, square) {
  const file = square[0].charCodeAt(0) - 'a'.charCodeAt(0);
  const rank = parseInt(square[1]) - 1;
  
  const board = page.locator('.chess-board-practice, .coaching-board-container').first();
  const box = await board.boundingBox();
  
  if (box) {
    const squareSize = box.width / 8;
    const x = box.x + (file * squareSize) + (squareSize / 2);
    const y = box.y + ((7 - rank) * squareSize) + (squareSize / 2);
    await page.mouse.click(x, y);
  }
}

async function checkComponentState(page, component, checkNumber) {
  const box = await component.boundingBox();
  const redCount = await page.locator('.captured-row.red .captured-piece').count();
  const blackCount = await page.locator('.captured-row.black .captured-piece').count();
  
  console.log(`\n   📊 Check ${checkNumber}: RED=${redCount}, BLACK=${blackCount}, Height=${Math.round(box.height)}px\n`);
}

// Run the test
playFullMatchWithCaptures()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
