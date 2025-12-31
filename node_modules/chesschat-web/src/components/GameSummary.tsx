import { useMemo, useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import '../styles/GameSummary.css';

interface GameSummaryProps {
  finalFEN: string;
  pgn: string;
  result: string;
  onAnalyze: () => void;
  onNewGame: () => void;
}

export function GameSummary({ pgn, result, onAnalyze, onNewGame }: GameSummaryProps) {
  const gameAnalysis = useMemo(() => {
    const chess = new Chess();
    const moves = pgn.split(/\d+\./).filter(m => m.trim());
    let moveCount = 0;
    let materialSwings = 0;
    let captureCount = 0;
    
    // Simplified blunder detection via material changes
    let previousMaterial = 39; // Starting material (pawns=8, pieces=31)
    
    moves.forEach((movePair) => {
      const movesInPair = movePair.trim().split(/\s+/);
      movesInPair.forEach((moveStr) => {
        if (moveStr && !moveStr.includes('{') && !moveStr.includes('}')) {
          try {
            const move = chess.move(moveStr.replace(/[+#!?]/g, ''));
            if (move) {
              moveCount++;
              if (move.captured) {
                captureCount++;
              }
              
              // Calculate current material
              const board = chess.board();
              let currentMaterial = 0;
              const pieceValues: Record<string, number> = {
                p: 1, n: 3, b: 3, r: 5, q: 9, k: 0
              };
              
              board.forEach(row => {
                row.forEach(square => {
                  if (square) {
                    currentMaterial += pieceValues[square.type] || 0;
                  }
                });
              });
              
              // Detect significant material swings (potential blunders)
              const materialDiff = Math.abs(currentMaterial - previousMaterial);
              if (materialDiff >= 3) {
                materialSwings++;
              }
              previousMaterial = currentMaterial;
            }
          } catch (e) {
            // Skip invalid moves
          }
        }
      });
    });
    
    // Determine opening (first 4 moves)
    const firstMoves = moves.slice(0, 2).join(' ').trim();
    let openingName = 'Unknown Opening';
    
    if (firstMoves.includes('e4 e5')) {
      openingName = 'King\'s Pawn Opening';
    } else if (firstMoves.includes('d4 d5')) {
      openingName = 'Queen\'s Pawn Opening';
    } else if (firstMoves.includes('e4 c5')) {
      openingName = 'Sicilian Defense';
    } else if (firstMoves.includes('e4 e6')) {
      openingName = 'French Defense';
    } else if (firstMoves.includes('d4 Nf6')) {
      openingName = 'Indian Defense';
    } else if (firstMoves.includes('Nf3')) {
      openingName = 'Réti Opening';
    } else if (firstMoves.includes('c4')) {
      openingName = 'English Opening';
    }
    
    return {
      totalMoves: moveCount,
      blunderEstimate: materialSwings,
      captureCount,
      openingName,
    };
  }, [pgn]);

  // Determine outcome for player (playing as White)
  const outcome = useMemo(() => {
    if (result.includes('White wins')) return 'victory';
    if (result.includes('Black wins')) return 'defeat';
    return 'draw';
  }, [result]);

  const outcomeConfig = {
    victory: {
      icon: '🏆',
      title: 'You Won!',
      color: 'victory',
      message: 'Congratulations on your victory!',
    },
    defeat: {
      icon: '😔',
      title: 'You Lost',
      color: 'defeat',
      message: 'Don\'t worry, every loss is a learning opportunity.',
    },
    draw: {
      icon: '🤝',
      title: 'Draw',
      color: 'draw',
      message: 'A fair result for both players.',
    },
  };

  const config = outcomeConfig[outcome];

  // Animated stats counting
  const [displayedMoves, setDisplayedMoves] = useState(0);
  const [displayedCaptures, setDisplayedCaptures] = useState(0);
  const [displayedBlunders, setDisplayedBlunders] = useState(0);

  useEffect(() => {
    const animateStat = (target: number, setter: (val: number) => void, duration: number = 800) => {
      const start = 0;
      const increment = target / (duration / 16);
      let current = start;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          setter(target);
          clearInterval(timer);
        } else {
          setter(Math.floor(current));
        }
      }, 16);

      return timer;
    };

    const timers = [
      animateStat(gameAnalysis.totalMoves, setDisplayedMoves, 800),
      animateStat(gameAnalysis.captureCount, setDisplayedCaptures, 1000),
      animateStat(gameAnalysis.blunderEstimate, setDisplayedBlunders, 1200),
    ];

    return () => timers.forEach(clearInterval);
  }, [gameAnalysis]);

  return (
    <div className="game-summary">
      <div className="game-summary-container slide-up">
        <div className={`summary-header ${config.color}`}>
          <div className="outcome-icon">{config.icon}</div>
          <h2 className="outcome-title">{config.title}</h2>
          <p className="outcome-message">{config.message}</p>
        </div>

        <div className="summary-stats">
          <div className="stat-card stat-animate" style={{ animationDelay: '0.1s' }}>
            <div className="stat-icon">♟️</div>
            <div className="stat-content">
              <div className="stat-value">{displayedMoves}</div>
              <div className="stat-label">Total Moves</div>
            </div>
          </div>

          <div className="stat-card stat-animate" style={{ animationDelay: '0.2s' }}>
            <div className="stat-icon">📚</div>
            <div className="stat-content">
              <div className="stat-value">{gameAnalysis.openingName}</div>
              <div className="stat-label">Opening Played</div>
            </div>
          </div>

          <div className="stat-card stat-animate" style={{ animationDelay: '0.3s' }}>
            <div className="stat-icon">⚠️</div>
            <div className="stat-content">
              <div className="stat-value">{displayedBlunders}</div>
              <div className="stat-label">Potential Blunders</div>
            </div>
          </div>

          <div className="stat-card stat-animate" style={{ animationDelay: '0.4s' }}>
            <div className="stat-icon">⚔️</div>
            <div className="stat-content">
              <div className="stat-value">{displayedCaptures}</div>
              <div className="stat-label">Pieces Captured</div>
            </div>
          </div>
        </div>

        <div className="summary-actions">
          <button className="btn-analyze primary" onClick={onAnalyze}>
            <span className="btn-icon">💬</span>
            <span className="btn-text">
              <span className="btn-label">Analyze with AI</span>
              <span className="btn-sublabel">Get detailed insights</span>
            </span>
          </button>

          <button className="btn-new-game secondary" onClick={onNewGame}>
            <span className="btn-icon">🔄</span>
            <span className="btn-text">
              <span className="btn-label">Play Again</span>
              <span className="btn-sublabel">Start a new game</span>
            </span>
          </button>
        </div>

        <div className="summary-footer">
          <p className="footer-note">
            💡 Tip: Ask the AI specific questions about moves you're unsure about
          </p>
        </div>
      </div>
    </div>
  );
}
