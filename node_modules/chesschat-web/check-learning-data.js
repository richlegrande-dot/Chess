/**
 * Check Learning Database Size
 * Run this in browser console on chesschat.uk to see what's stored
 */

const STORAGE_KEY = 'chess_learning_database';

try {
  const stored = localStorage.getItem(STORAGE_KEY);
  
  if (!stored) {
    console.log('❌ No learning data found in localStorage');
  } else {
    const data = JSON.parse(stored);
    const sizeKB = (new Blob([stored]).size / 1024).toFixed(2);
    
    console.log('=== LEARNING DATABASE STATUS ===');
    console.log(`📦 Total size: ${sizeKB} KB`);
    console.log(`🎮 Total games: ${data.gameHistory?.length || 0}`);
    console.log(`🧠 Learned positions: ${Object.keys(data.learnedPositions || {}).length}`);
    console.log(`📖 Opening lines: ${Object.keys(data.openingLines || {}).length}`);
    console.log(`⚔️ Tactical patterns: ${data.tacticalPatterns?.length || 0}`);
    console.log('\n📊 Statistics:');
    console.log(`  Wins: ${data.statistics?.wins || 0}`);
    console.log(`  Losses: ${data.statistics?.losses || 0}`);
    console.log(`  Draws: ${data.statistics?.draws || 0}`);
    console.log(`  Last updated: ${data.statistics?.lastUpdated ? new Date(data.statistics.lastUpdated).toLocaleString() : 'Never'}`);
    
    // Check if any positions have very low win rates that might be causing deep searches
    if (data.learnedPositions) {
      const positions = Object.values(data.learnedPositions);
      const lowWinRate = positions.filter(p => p.winRate < 0.3 && p.timesPlayed > 3);
      if (lowWinRate.length > 0) {
        console.log(`\n⚠️ ${lowWinRate.length} positions with low win rate (< 30%) - might trigger deeper searches`);
      }
    }
    
    console.log('\n💡 To clear learning data:');
    console.log('localStorage.removeItem("chess_learning_database")');
  }
} catch (error) {
  console.error('❌ Error reading learning database:', error);
}
