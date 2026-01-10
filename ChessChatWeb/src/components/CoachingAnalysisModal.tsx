// Simple Coaching Analysis Modal for CoachingMode
// Generates basic takeaways based on game performance

import React, { useState } from 'react';
import '../styles/CoachingAnalysisModal.css';

interface MoveRecord {
  moveNum: number;
  player: 'White' | 'Black';
  move: string;
  fen: string;
  captured?: string; // Type of piece captured (p, n, b, r, q)
}

interface CoachingAnalysisProps {
  gameResult: string;
  moveHistory: MoveRecord[];
  pgn: string;
  playerColor: 'White' | 'Black';
  onClose: () => void;
  onMoreInsights: () => void;
}

interface Takeaway {
  title: string;
  description: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
}

export const CoachingAnalysisModal: React.FC<CoachingAnalysisProps> = ({
  gameResult,
  moveHistory,
  pgn,
  playerColor,
  onClose,
  onMoreInsights
}) => {
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{text: string, isUser: boolean}>>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Helper function to determine if a move at a given index was made by the player
  // In vs-CPU mode, moveHistory.player represents PIECE COLOR, not who made the move
  // White always moves first (even indices), Black moves second (odd indices)
  const isPlayerMove = (moveIndex: number): boolean => {
    if (playerColor === 'White') {
      return moveIndex % 2 === 0; // Player is White, moves on even indices
    } else {
      return moveIndex % 2 === 1; // Player is Black, moves on odd indices
    }
  };
  
  const generateTakeaways = (): Takeaway[] => {
    const takeaways: Takeaway[] = [];
    const totalMoves = moveHistory.filter((m, idx) => isPlayerMove(idx)).length;
    const allMoves = moveHistory.length;
    const isWin = gameResult.toLowerCase().includes('win') || gameResult.toLowerCase().includes(playerColor.toLowerCase());
    const isQuickGame = totalMoves < 10;
    const isMidGame = totalMoves >= 10 && totalMoves < 25;
    const isLongGame = totalMoves >= 25;
    
    // Get actual moves for context
    const openingMoves = moveHistory.slice(0, Math.min(6, moveHistory.length));
    const recentMoves = moveHistory.slice(-4);
    
    // Takeaway 1: Result-specific analysis
    if (isWin && isQuickGame) {
      takeaways.push({
        title: 'Quick Victory - Exploit Opponent Errors',
        description: `Excellent! You won in just ${totalMoves} moves. Your opponent made critical early mistakes. Study this game to recognize similar patterns where opponents weaken their position early.`,
        icon: '⚡',
        priority: 'high'
      });
    } else if (isWin && isLongGame) {
      takeaways.push({
        title: 'Endgame Mastery - Converting Advantages',
        description: `Great endurance! You converted a long game (${totalMoves} moves) into a win. This shows strong endgame technique. Continue practicing converting small advantages into full points.`,
        icon: '👑',
        priority: 'high'
      });
    } else if (isWin) {
      takeaways.push({
        title: 'Tactical Execution - Well Done!',
        description: `Solid win in ${totalMoves} moves! You capitalized on opportunities in the middlegame. Keep this momentum by analyzing what tactical themes worked best for you.`,
        icon: '🏆',
        priority: 'high'
      });
    } else if (isQuickGame) {
      takeaways.push({
        title: 'Opening Principles Need Work',
        description: `Game ended after ${totalMoves} moves. Focus on: (1) Control center with e4/d4 or e5/d5, (2) Develop knights and bishops, (3) Castle by move 8-10. Your opening: ${openingMoves.map(m => m.move).join(', ')}`,
        icon: '🎯',
        priority: 'high'
      });
    } else {
      takeaways.push({
        title: 'Find the Turning Point',
        description: `In this ${totalMoves}-move game, there was a key moment where the advantage shifted. Review moves ${Math.floor(totalMoves * 0.4)}-${Math.floor(totalMoves * 0.6)} carefully to find it.`,
        icon: '🔍',
        priority: 'high'
      });
    }
    
    // Takeaway 2: Phase-specific advice
    if (isQuickGame) {
      takeaways.push({
        title: 'Opening Study Priority',
        description: `With ${allMoves} total moves, this stayed in the opening. Memorize 10-15 moves of 2-3 solid openings. For Black (${openingMoves.map(m => m.move).join(', ')}), consider studying the main line responses.`,
        icon: '📖',
        priority: 'high'
      });
    } else if (isMidGame) {
      takeaways.push({
        title: 'Middlegame Tactics Are Key',
        description: `Game peaked in the middlegame (${allMoves} moves total). This is where most games are decided. Practice 15 tactical puzzles daily focusing on: forks, pins, discovered attacks, and removing defenders.`,
        icon: '⚔️',
        priority: 'high'
      });
    } else {
      takeaways.push({
        title: 'Endgame Knowledge Crucial',
        description: `This ${allMoves}-move game reached a complex endgame. Essential to master: (1) King+Pawn vs King, (2) Rook endgames (Lucena/Philidor), (3) Opposition and triangulation. These win/save games!`,
        icon: '♟️',
        priority: 'high'
      });
    }
    
    // Takeaway 3: Move quality analysis
    const avgMovesPerTurn = allMoves / 2;
    if (avgMovesPerTurn > 20) {
      takeaways.push({
        title: 'Calculate Candidate Moves',
        description: `With ${allMoves} total moves, both players struggled. Before moving: (1) List 2-3 candidate moves, (2) Calculate each 2-3 moves deep, (3) Check for tactics against you, (4) Verify your move doesn't hang pieces.`,
        icon: '🧮',
        priority: 'medium'
      });
    } else {
      takeaways.push({
        title: 'Tactical Sharpness',
        description: `This was a sharp game! Recent moves: ${recentMoves.map(m => m.move).join(' → ')}. You're finding tactics quickly. Now focus on accuracy: double-check forcing moves (checks, captures, threats) before playing them.`,
        icon: '🎯',
        priority: 'medium'
      });
    }
    
    // Takeaway 4: Pattern recognition (varies by game length)
    if (totalMoves < 15) {
      takeaways.push({
        title: 'Learn Opening Traps',
        description: `Short games often involve opening traps. Study common traps in your openings (Scholar's Mate, Fried Liver, etc.). Know both how to set them AND how to avoid falling for them!`,
        icon: '🪤',
        priority: 'medium'
      });
    } else if (totalMoves < 30) {
      takeaways.push({
        title: 'Middlegame Pattern Library',
        description: `Build your pattern recognition by solving themed tactical problems: knight forks, back rank mates, pin breakers, and deflection. Spend 10 minutes daily - you'll spot these in your games!`,
        icon: '🧩',
        priority: 'medium'
      });
    } else {
      takeaways.push({
        title: 'Endgame Pattern Recognition',
        description: `Long games require endgame knowledge. Study: passed pawn races, active king play, rook activity behind passed pawns, and opposition. Recognize these patterns to convert advantages.`,
        icon: '🔑',
        priority: 'medium'
      });
    }
    
    // Takeaway 5: Specific improvement path
    if (isWin) {
      takeaways.push({
        title: 'Consistency Through Repetition',
        description: `You won this time - great! Now play 10 more games at this level and aim for 70%+ win rate. Consistency matters more than one win. Analyze every game to find improvement areas even in victories.`,
        icon: '📈',
        priority: 'low'
      });
    } else {
      takeaways.push({
        title: 'Post-Game Analysis Ritual',
        description: `After each loss: (1) Copy the PGN, (2) Paste into Lichess analysis board or Stockfish, (3) Find your 3 worst moves, (4) Understand WHY the engine's suggestion was better. Do this for every game!`,
        icon: '🔬',
        priority: 'low'
      });
    }
    
    return takeaways.slice(0, 5);
  };

  const takeaways = generateTakeaways();

  const analyzeGameMoves = () => {
    // CRITICAL FIX: In vs-CPU mode, moveHistory.player represents the PIECE COLOR that moved,
    // not whether it was the human or CPU. We need to determine actual player/opponent moves correctly.
    // When human plays Black, their moves are recorded as player:'Black' 
    // When CPU plays Black, CPU moves are ALSO recorded as player:'Black'
    // So we must use move index (odd/even) to determine who actually made each move.
    
    // In vs-CPU: Human always moves first if they're White, or second if they're Black
    // Move indices: 0,1,2,3,4,5...
    // If playerColor is 'White': human moves are even indices (0,2,4...), CPU moves are odd (1,3,5...)
    // If playerColor is 'Black': human moves are odd indices (1,3,5...), CPU moves are even (0,2,4...)
    
    const playerMoves = moveHistory.filter((m, index) => {
      // playerColor is 'White' or 'Black' representing which color the human plays
      if (playerColor === 'White') {
        // Human is White, moves on even indices (starts at 0)
        return index % 2 === 0;
      } else {
        // Human is Black, moves on odd indices (starts at 1)
        return index % 2 === 1;
      }
    });
    
    const opponentMoves = moveHistory.filter((m, index) => {
      if (playerColor === 'White') {
        // CPU is Black, moves on odd indices
        return index % 2 === 1;
      } else {
        // CPU is White, moves on even indices
        return index % 2 === 0;
      }
    });
    
    // Debug: Log move history to see captured field
    console.log('[CoachingAnalysis] Full move history:', moveHistory);
    console.log('[CoachingAnalysis] Captured fields:', moveHistory.map(m => ({ move: m.move, captured: m.captured })));
    
    // Analyze move patterns
    const longMoves = moveHistory.filter(m => m.move.length > 4); // Complex moves
    const captures = moveHistory.filter(m => m.captured); // Check if captured property exists
    const capturesAlternate = moveHistory.filter(m => m.move.includes('x')); // Also check SAN notation
    const checks = moveHistory.filter(m => m.move.includes('+'));
    const castling = moveHistory.filter(m => m.move.includes('O-O'));
    
    // Identify critical phases
    const openingPhase = moveHistory.slice(0, Math.min(10, moveHistory.length));
    const middlegamePhase = moveHistory.slice(10, Math.min(30, moveHistory.length));
    const endgamePhase = moveHistory.slice(30);
    
    // Use both methods to detect captures - either captured field or 'x' in SAN notation
    const allCaptures = captures.length > 0 ? captures : capturesAlternate;
    console.log('[CoachingAnalysis] Captures detected:', captures.length, 'Alternate method:', capturesAlternate.length, 'Using:', allCaptures.length);
    
    // Count player/opponent captures and checks using the same index logic
    const playerCaptures = allCaptures.filter((m, origIndex) => {
      // Need to find this move's original index in full moveHistory
      const idx = moveHistory.findIndex(move => move === m);
      if (playerColor === 'White') return idx % 2 === 0;
      else return idx % 2 === 1;
    }).length;
    
    const opponentCaptures = allCaptures.filter((m, origIndex) => {
      const idx = moveHistory.findIndex(move => move === m);
      if (playerColor === 'White') return idx % 2 === 1;
      else return idx % 2 === 0;
    }).length;
    
    const playerChecks = checks.filter((m, origIndex) => {
      const idx = moveHistory.findIndex(move => move === m);
      if (playerColor === 'White') return idx % 2 === 0;
      else return idx % 2 === 1;
    }).length;
    
    const opponentChecks = checks.filter((m, origIndex) => {
      const idx = moveHistory.findIndex(move => move === m);
      if (playerColor === 'White') return idx % 2 === 1;
      else return idx % 2 === 0;
    }).length;
    
    return {
      playerMoves,
      opponentMoves,
      captures: allCaptures,
      checks,
      castling,
      longMoves,
      openingPhase,
      middlegamePhase,
      endgamePhase,
      playerCaptures,
      opponentCaptures,
      playerChecks,
      opponentChecks,
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = inputText.trim();
    if (!message || isLoading) return;

    // Add user message
    setChatMessages(prev => [...prev, { text: message, isUser: true }]);
    setInputText('');
    setIsLoading(true);

    // Analyze the game deeply
    const analysis = analyzeGameMoves();
    const totalMoves = moveHistory.length;
    const playerMoves = analysis.playerMoves;
    const isWin = gameResult.toLowerCase().includes('win') || gameResult.toLowerCase().includes(playerColor.toLowerCase());
    const messageLower = message.toLowerCase();
    
    setTimeout(() => {
      let response = '';
      
      // Analyze what they're asking about
      if (messageLower.includes('mistake') || messageLower.includes('error') || messageLower.includes('blunder')) {
        const yourMoves = playerMoves.map((m, idx) => `${idx + 1}. ${m.move} (turn ${m.moveNum})`).join(', ');
        const opponentMoves = analysis.opponentMoves.map((m, idx) => `${idx + 1}. ${m.move} (turn ${m.moveNum})`).join(', ');
        
        response = `**Detailed Move Analysis:**\n\n` +
          `**Your Moves (${playerColor}):** ${yourMoves}\n\n` +
          `**Opponent Moves:** ${opponentMoves}\n\n` +
          `**Key Statistics:**\n` +
          `• You made ${analysis.playerCaptures} capture(s) vs opponent's ${analysis.opponentCaptures}\n` +
          `• You gave ${analysis.playerChecks} check(s) vs opponent's ${analysis.opponentChecks}\n` +
          `• Castling: ${analysis.castling.filter(c => c.player === playerColor).length > 0 ? `Yes (${analysis.castling.filter(c => c.player === playerColor).map(m => `turn ${m.moveNum}`).join(', ')})` : 'No castling by you'}\n\n` +
          `**Critical Moments:**\n`;
        
        if (analysis.middlegamePhase.length > 0) {
          const midCaptures = analysis.captures.filter(c => c.moveNum > 10 && c.moveNum <= 30);
          response += `• Middlegame (moves 10-30): ${midCaptures.length} exchanges - ${midCaptures.map(m => `Move ${m.moveNum}: ${m.move}`).join(', ')}\n`;
        }
        
        if (analysis.checks.length > 0) {
          response += `• Checks played: ${analysis.checks.map(m => `Move ${m.moveNum} (${m.player}): ${m.move}`).join('; ')}\n`;
        }
        
        response += `\n**Likely Mistakes:**\n`;
        if (!isWin && playerMoves.length < analysis.opponentMoves.length) {
          response += `1. You were checkmated - your king safety was compromised around move ${Math.max(1, totalMoves - 5)}\n`;
        }
        
        if (analysis.playerCaptures < analysis.opponentCaptures - 2) {
          response += `${isWin ? '1' : '2'}. Opponent won the material battle (${analysis.opponentCaptures} vs ${analysis.playerCaptures} captures) - look for hanging pieces\n`;
        }
        
        if (analysis.castling.filter(c => c.player === playerColor).length === 0 && totalMoves > 15) {
          response += `${response.includes('2.') ? '3' : isWin ? '1' : '2'}. You never castled - king safety is crucial! Castle by move 8-12 in most games\n`;
        }
        
        response += `\n💡 Copy the PGN and analyze with Stockfish to see exact evaluation swings!`;
        
      } else if (messageLower.includes('opening')) {
        response = `**Move-by-Move Opening Analysis:**\n\n`;
        
        analysis.openingPhase.forEach((move, idx) => {
          const moveIndex = moveHistory.findIndex(m => m === move);
          const isYourMove = isPlayerMove(moveIndex);
          response += `${move.moveNum}. ${isYourMove ? '**You' : 'Opponent'} (${move.player}):** ${move.move}`;
          
          // Analyze each opening move
          if (idx < 4) {
            if (move.move.match(/^[e|d]4/) || move.move.match(/^[e|d]5/)) {
              response += ` ✓ *Center control*`;
            } else if (move.move.match(/^N[a-h]/)) {
              response += ` ✓ *Knight development*`;
            } else if (move.move.includes('O-O')) {
              response += ` ✓ *Castling - king safety secured!*`;
            } else if (idx > 0 && move.move.match(/^[NBRQ][a-h]/)) {
              response += ` ⚠ *Developing pieces*`;
            }
          }
          response += `\n`;
        });
        
        response += `\n**Opening Evaluation:**\n`;
        const yourOpeningMoves = analysis.openingPhase.filter((m, idx) => {
          const moveIndex = moveHistory.findIndex(move => move === m);
          return isPlayerMove(moveIndex);
        });
        const centerMoves = yourOpeningMoves.filter(m => m.move.match(/^[e|d]4/) || m.move.match(/^[e|d]5/));
        const development = yourOpeningMoves.filter(m => m.move.match(/^[NBR]/));
        const castled = analysis.castling.filter((m, idx) => {
          const moveIndex = moveHistory.findIndex(move => move === m);
          return isPlayerMove(moveIndex) && m.moveNum <= 10;
        });
        
        response += `• Center control: ${centerMoves.length > 0 ? '✓ Yes' : '✗ Needs work'}\n`;
        response += `• Piece development: ${development.length}/${yourOpeningMoves.length} moves\n`;
        response += `• Early castling: ${castled.length > 0 ? `✓ Move ${castled[0].moveNum}` : '✗ Delayed or never'}\n\n`;
        
        if (totalMoves < 15) {
          response += `⚠️ Game ended in opening - study this opening line for 10-15 more moves!`;
        } else {
          response += `✓ Successfully transitioned to middlegame!`;
        }
        
      } else if (messageLower.includes('tactic') || messageLower.includes('pattern')) {
        response = `**Tactical Patterns in Your Game:**\n\n`;
        
        response += `**Captures Made:**\n`;
        analysis.captures.forEach(c => {
          response += `• Move ${c.moveNum} (${c.player === playerColor ? 'YOU' : 'Opponent'}): ${c.move}`;
          if (c.move.match(/x[QRBN]/)) {
            response += ` 🎯 *Major piece captured!*`;
          }
          response += `\n`;
        });
        
        response += `\n**Checks Given:**\n`;
        if (analysis.checks.length > 0) {
          analysis.checks.forEach(c => {
            response += `• Move ${c.moveNum} (${c.player === playerColor ? 'YOU' : 'Opponent'}): ${c.move}`;
            if (c.move.includes('#')) {
              response += ` ⚔️ *Checkmate!*`;
            } else if (c.move.includes('++')) {
              response += ` ⚡ *Double check!*`;
            }
            response += `\n`;
          });
        } else {
          response += `• No checks were given by either side\n`;
        }
        
        response += `\n**Tactical Patterns Detected:**\n`;
        const knightMoves = moveHistory.filter(m => m.move.startsWith('N'));
        
        if (knightMoves.length > 3) {
          response += `• **Knight activity**: ${knightMoves.length} knight moves - look for fork opportunities\n`;
        }
        if (analysis.captures.length > 5) {
          response += `• **Tactical game**: ${analysis.captures.length} captures - lots of material exchanges\n`;
        }
        if (analysis.checks.length > 3) {
          response += `• **Aggressive play**: ${analysis.checks.length} checks - forcing moves to pressure opponent\n`;
        }
        
        response += `\n**Improvement Focus:**\n`;
        response += `Based on ${analysis.playerCaptures} captures and ${analysis.playerChecks} checks:\n`;
        if (analysis.playerCaptures < 2) {
          response += `• Practice **hanging piece detection** - look for undefended pieces\n`;
        }
        if (analysis.playerChecks === 0 && totalMoves > 15) {
          response += `• Look for **forcing moves** - checks, captures, threats\n`;
        }
        response += `• Solve 15 tactical puzzles daily focusing on: ${analysis.playerCaptures > 3 ? 'calculation accuracy' : 'pattern recognition'}\n`;
        
      } else if (messageLower.includes('endgame')) {
        if (totalMoves > 30) {
          response = `**Endgame in Your Game** (${totalMoves} moves total):\n\n` +
            `Your game reached the endgame phase. Key endgame principles:\n\n` +
            `1. **King Activity** - In the endgame, the king becomes a powerful piece. Centralize it!\n` +
            `2. **Pawn Promotion** - Push passed pawns aggressively\n` +
            `3. **Rook Activity** - Rooks belong behind passed pawns (yours or opponent's)\n` +
            `4. **Opposition** - Control key squares to restrict the enemy king\n\n` +
            `**Study These Basic Endgames:**\n` +
            `• King + Pawn vs King (understanding opposition)\n` +
            `• Rook endgames (Lucena and Philidor positions)\n` +
            `• Queen vs Pawn endgames\n\n` +
            `Review moves ${Math.floor(totalMoves * 0.7)}-${totalMoves} to see if you maximized your piece activity.`;
        } else {
          response = `This game ended before reaching a true endgame (${totalMoves} moves). However, endgame knowledge is crucial!\n\n` +
            `**Essential Endgames to Learn:**\n` +
            `1. King + Pawn vs King (must-know)\n` +
            `2. Two Rooks checkmate\n` +
            `3. Queen checkmate\n` +
            `4. Basic rook endgames\n\n` +
            `Even though this game ended earlier, study endgames for 10 minutes daily - it will help you convert winning positions and save difficult ones.`;
        }
      } else if (messageLower.includes('improve') || messageLower.includes('better') || messageLower.includes('practice')) {
        response = `**Improvement Plan Based on This Game:**\n\n` +
          `**Immediate Actions:**\n` +
          `1. Analyze this PGN with Stockfish or Lichess analysis board\n` +
          `2. Find the 3 key moments where evaluation changed significantly\n` +
          `3. Understand why the suggested moves were better\n\n` +
          `**Daily Training (30 minutes):**\n` +
          `• 15 min: Tactical puzzles (your weakest area)\n` +
          `• 10 min: Study one opening line deeply\n` +
          `• 5 min: Review one of your recent games\n\n` +
          `**Weekly Goals:**\n` +
          `• Play 10-15 games at this difficulty level\n` +
          `• Review every game to find mistakes\n` +
          `• Learn one new tactical pattern\n\n` +
          `${isWin ? 'You won this time - excellent! Now focus on consistency.' : 'Learn from this loss - each game makes you stronger!'}`;
      } else {
        // Default helpful response
        response = `**About Your Game:**\n` +
          `• Result: ${gameResult}\n` +
          `• Your color: ${playerColor}\n` +
          `• Total moves: ${totalMoves} (you played ${playerMoves.length})\n` +
          `• Game phase: ${totalMoves < 15 ? 'Opening' : totalMoves < 35 ? 'Middlegame' : 'Endgame'}\n\n` +
          `${isWin ? '**Congratulations on the win!** 🎉' : '**Good effort!**'}\n\n` +
          `To get specific insights, ask me about:\n` +
          `• "What were my biggest mistakes?"\n` +
          `• "How can I improve my opening?"\n` +
          `• "What tactical patterns should I study?"\n` +
          `• "Analyze my endgame technique"\n\n` +
          `I'll provide detailed analysis based on your actual game data!`;
      }
      
      setChatMessages(prev => [...prev, { text: response, isUser: false }]);
      setIsLoading(false);
    }, 1000);
  };

  const suggestedQuestions = [
    'What were my biggest mistakes?',
    'How can I improve my opening?',
    'What tactical patterns should I study?',
    'Analyze my endgame technique'
  ];

  if (showChat) {
    return (
      <div className="coaching-modal-overlay" onClick={onClose}>
        <div className="coaching-modal-content coaching-chat-view" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
          
          <div className="chat-header">
            <button 
              onClick={() => setShowChat(false)}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                color: '#fff',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Back to Takeaways
            </button>
            <h2 style={{ margin: '0 auto', fontSize: '20px', color: '#fff' }}>💬 Coaching Chat</h2>
          </div>

          <div className="chat-messages" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '16px'
          }}>
            {chatMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', padding: '40px 20px' }}>
                <p style={{ fontSize: '16px', marginBottom: '24px' }}>Ask me anything about your game!</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '400px', margin: '0 auto' }}>
                  {suggestedQuestions.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInputText(q)}
                      style={{
                        background: 'rgba(102, 126, 234, 0.2)',
                        border: '1px solid rgba(102, 126, 234, 0.4)',
                        color: '#fff',
                        padding: '12px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        textAlign: 'left',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.3)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(102, 126, 234, 0.2)';
                        e.currentTarget.style.transform = 'translateX(0)';
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                style={{
                  alignSelf: msg.isUser ? 'flex-end' : 'flex-start',
                  background: msg.isUser 
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'rgba(255,255,255,0.1)',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  color: '#fff',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  border: msg.isUser ? 'none' : '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {msg.text}
              </div>
            ))}
            
            {isLoading && (
              <div style={{
                alignSelf: 'flex-start',
                background: 'rgba(255,255,255,0.1)',
                padding: '12px 16px',
                borderRadius: '12px',
                maxWidth: '80%',
                color: 'rgba(255,255,255,0.7)',
                fontSize: '14px',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                Thinking...
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} style={{
            padding: '20px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            gap: '12px'
          }}>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask about your game..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: '8px',
                padding: '12px 16px',
                color: '#fff',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                color: '#fff',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: inputText.trim() && !isLoading ? 'pointer' : 'not-allowed',
                opacity: inputText.trim() && !isLoading ? 1 : 0.5
              }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="coaching-modal-overlay" onClick={onClose}>
      <div className="coaching-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close-btn" onClick={onClose}>✕</button>
        
        <h2 className="modal-title">
          🎓 Post-Game Coaching Analysis
        </h2>
        
        <div className="game-summary">
          <p><strong>Result:</strong> {gameResult}</p>
          <p><strong>Your Color:</strong> {playerColor}</p>
          <p><strong>Total Moves:</strong> {moveHistory.filter((m, idx) => isPlayerMove(idx)).length}</p>
        </div>

        <h3 className="section-title">📌 Key Takeaways (Top 5 of 50+)</h3>
        
        <div className="takeaways-list">
          {takeaways.map((takeaway, index) => (
            <div key={index} className={`takeaway-card priority-${takeaway.priority}`}>
              <div className="takeaway-header">
                <span className="takeaway-icon">{takeaway.icon}</span>
                <span className="takeaway-number">#{index + 1}</span>
              </div>
              <h4 className="takeaway-title">{takeaway.title}</h4>
              <p className="takeaway-description">{takeaway.description}</p>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn-primary" onClick={() => setShowChat(true)}>
            💬 Get More Insights
          </button>
        </div>
      </div>
    </div>
  );
};
