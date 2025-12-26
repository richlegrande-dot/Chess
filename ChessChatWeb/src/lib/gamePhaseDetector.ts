/**
 * Utility function to determine game phase based on move count and piece count
 */

export function detectGamePhase(moveCount: number, pieceCount: number): 'opening' | 'middlegame' | 'endgame' {
  // Opening: First 15 moves
  if (moveCount < 15) {
    return 'opening';
  }
  
  // Endgame: 10 or fewer pieces remaining
  if (pieceCount <= 10) {
    return 'endgame';
  }
  
  // Middlegame: Everything else
  return 'middlegame';
}
