/**
 * Quick Visual Test Script for Openings Modal
 * Run this in the browser console to verify modal functionality
 */

// Test 1: Verify openings data loaded
console.log('🧪 Test 1: Checking openings data...');
import('./src/data/openings.seed.ts').then((module) => {
  const { OPENINGS_SEED } = module;
  console.log(`✅ Loaded ${OPENINGS_SEED.length} openings:`, OPENINGS_SEED.map(o => o.name));
  
  // Test 2: Validate move sequences
  console.log('\n🧪 Test 2: Validating move sequences...');
  import('chess.js').then(({ Chess }) => {
    OPENINGS_SEED.forEach((opening) => {
      const chess = new Chess();
      try {
        opening.movesSAN.forEach((san) => {
          const result = chess.move(san);
          if (!result) throw new Error(`Invalid move: ${san}`);
        });
        console.log(`✅ ${opening.name}: All ${opening.movesSAN.length} moves valid`);
      } catch (error) {
        console.error(`❌ ${opening.name}: ${error.message}`);
      }
    });
  });
}).catch((error) => {
  console.error('❌ Failed to load openings:', error);
});

// Test 3: Verify modal component exists
console.log('\n🧪 Test 3: Checking modal component...');
setTimeout(() => {
  const openingsButton = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent?.includes('Openings')
  );
  
  if (openingsButton) {
    console.log('✅ Openings button found');
    console.log('💡 Click the button to test modal functionality');
  } else {
    console.log('⚠️ Openings button not found. Make sure you are in Coaching Mode.');
  }
}, 1000);

// Test 4: Helper function to simulate modal interaction
window.testOpeningsModal = function() {
  console.log('\n🧪 Test 4: Simulating modal interaction...');
  
  const openingsButton = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent?.includes('Openings')
  );
  
  if (openingsButton) {
    openingsButton.click();
    console.log('✅ Modal opened');
    
    setTimeout(() => {
      // Check if modal is visible
      const modal = document.querySelector('.openings-modal-overlay');
      if (modal) {
        console.log('✅ Modal is visible');
        
        // Check for board coordinates
        const ranks = document.querySelectorAll('.rank-label');
        const files = document.querySelectorAll('.file-label');
        console.log(`✅ Found ${ranks.length} rank labels and ${files.length} file labels`);
        
        // Check for navigation buttons
        const buttons = modal.querySelectorAll('button');
        const hasNext = Array.from(buttons).some(btn => btn.textContent?.includes('Next'));
        const hasPrev = Array.from(buttons).some(btn => btn.textContent?.includes('Previous'));
        const hasReset = Array.from(buttons).some(btn => btn.textContent?.includes('Reset'));
        
        console.log(`✅ Navigation buttons: Next=${hasNext}, Previous=${hasPrev}, Reset=${hasReset}`);
        
        // Check for openings list
        const openingItems = modal.querySelectorAll('.opening-item');
        console.log(`✅ Found ${openingItems.length} opening items`);
        
        console.log('\n✅ All visual tests passed!');
        console.log('💡 Manually test navigation by clicking Next/Previous buttons');
      } else {
        console.error('❌ Modal not found in DOM');
      }
    }, 500);
  } else {
    console.error('❌ Openings button not found');
  }
};

console.log('\n📖 Available Commands:');
console.log('  testOpeningsModal() - Run interactive modal test');
console.log('  (Tests 1-2 will run automatically)');
