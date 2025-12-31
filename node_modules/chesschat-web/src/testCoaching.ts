/**
 * Demo/Test file for Rule-Based Coaching System
 * Run this to see example coaching analysis
 */

import { coachingEngine } from './lib/coaching';

// Example game with several mistakes (Scholar's Mate trap)
const testGame = [
  { move: 'e4', fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' },
  { move: 'e5', fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2' },
  { move: 'Bc4', fen: 'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2' },
  { move: 'Nc6', fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR w KQkq - 2 3' },
  { move: 'Qh5', fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3' },
  { move: 'Nf6??', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4' }, // Blunder - allows Scholar's Mate
  { move: 'Qxf7#', fen: 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4' },
];

async function runTest() {
  console.log('🧪 Testing Rule-Based Coaching System\n');
  console.log('Analyzing Scholar\'s Mate game...\n');

  const report = await coachingEngine.analyzeGame(testGame, 'b');

  console.log('='.repeat(60));
  console.log('📊 GAME STATISTICS');
  console.log('='.repeat(60));
  console.log(`Total Moves: ${report.statistics.totalMoves}`);
  console.log(`Blunders: ${report.statistics.blunders}`);
  console.log(`Mistakes: ${report.statistics.mistakes}`);
  console.log(`Inaccuracies: ${report.statistics.inaccuracies}`);
  console.log(`Missed Wins: ${report.statistics.missedWins}`);
  console.log(`Principle Violations: ${report.statistics.principleViolations}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('🎯 TOP 3 IMPROVEMENTS');
  console.log('='.repeat(60));
  report.improvements.forEach((improvement, i) => {
    console.log(`\n${i + 1}. ${improvement.title} (Severity: ${improvement.severity}/10)`);
    console.log(`   Category: ${improvement.category}`);
    if (improvement.moveNumber) {
      console.log(`   Occurred at move: ${improvement.moveNumber}`);
    }
    console.log(`   ${improvement.description}`);
  });
  console.log('');

  console.log('='.repeat(60));
  console.log('📈 GAME PHASE ANALYSIS');
  console.log('='.repeat(60));
  console.log(`Opening: ${report.gamePhaseAnalysis.opening}`);
  console.log(`Middlegame: ${report.gamePhaseAnalysis.middlegame}`);
  console.log(`Endgame: ${report.gamePhaseAnalysis.endgame}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('🎓 FOCUS AREAS');
  console.log('='.repeat(60));
  console.log(`⚔️ Tactical: ${report.tacticalFocus}`);
  console.log(`♟️ Strategic: ${report.strategicFocus}`);
  console.log('');

  console.log('='.repeat(60));
  console.log('💪 ENCOURAGEMENT');
  console.log('='.repeat(60));
  console.log(report.encouragement);
  console.log('');

  console.log('='.repeat(60));
  console.log(`✅ Analysis completed in ${report.metadata?.analysisTime}ms`);
  console.log('='.repeat(60));
}

// Run the test if this file is executed directly
if (typeof window === 'undefined') {
  runTest().catch(console.error);
}

export { runTest };
