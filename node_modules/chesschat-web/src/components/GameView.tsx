// GameView Component - Main chess game interface

import React, { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { ChessBoardPremium } from './ChessBoardPremium';
import { DebugPanel } from './DebugPanel';
import '../styles/GameView.css';
import '../styles/ChessBoardEnhanced.css';

export const GameView: React.FC = () => {
  const { resign, newGame, errorMessage, chess, selectedModel, goToPostGame, isThinking, isPlayerTurn, retryAIMove, setError, selectModel } = useGameStore();

  // Initialize game with stored model selection
  useEffect(() => {
    const storedModelStr = localStorage.getItem('selectedModel');
    if (storedModelStr && !selectedModel) {
      try {
        const storedModel = JSON.parse(storedModelStr);
        console.log('[GameView] Initializing with stored model:', storedModel);
        selectModel(storedModel);
        newGame();
        // Clear the stored selection after use
        localStorage.removeItem('selectedModel');
      } catch (error) {
        console.error('[GameView] Failed to parse stored model:', error);
      }
    }
  }, [selectModel, newGame, selectedModel]);

  // Safety check for required dependencies
  if (!chess || !selectedModel) {
    console.log('[GameView] Waiting for initialization...', { chess: !!chess, selectedModel: !!selectedModel });
    return (
      <div className="game-view" style={{ 
        textAlign: 'center', 
        padding: '2rem',
        background: '#000',
        color: 'white',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '3rem' }}>♟️</div>
        <p>Initializing game...</p>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          Chess: {chess ? '✓' : '✗'} | Model: {selectedModel ? '✓' : '✗'}
        </div>
      </div>
    );
  }

  return (
    <div className="game-view" role="main" aria-label="Chess game interface">
      {/* Header */}
      <div className="game-header">
        <div className="game-info">
          <h2>ChessChat</h2>
          <div className="model-badge" aria-label={`Playing against ${selectedModel.name}`}>
            <span className="model-icon" aria-hidden="true">🤖</span>
            <span>{selectedModel.name}</span>
          </div>
        </div>
        <div className="game-actions" role="group" aria-label="Game actions">
          <button onClick={resign} className="btn btn-resign" disabled={isThinking} aria-label="Resign the game">
            Resign
          </button>
          <button onClick={newGame} className="btn btn-new" disabled={isThinking} aria-label="Start a new game">
            New Game
          </button>
        </div>
      </div>

      {/* AI Thinking Indicator */}
      {isThinking && (
        <div className="thinking-banner" role="status" aria-live="polite" aria-label="AI is thinking">
          <div className="thinking-knight" aria-hidden="true">♞</div>
          <div className="thinking-dots" aria-hidden="true">
            <span className="dot"></span>
            <span className="dot"></span>
            <span className="dot"></span>
          </div>
          <span>AI is thinking</span>
        </div>
      )}

      {/* Turn Indicator */}
      {!isThinking && !chess.isGameOver() && (
        <div 
          className={`turn-indicator ${isPlayerTurn ? 'player-turn' : 'ai-turn'}`}
          role="status"
          aria-live="polite"
          aria-label={isPlayerTurn ? 'Your turn to move' : 'AI\'s turn'}
        >
          {isPlayerTurn ? '▶️ Your turn' : '⏳ AI\'s turn'}
        </div>
      )}

      {/* Error message with retry button */}
      {errorMessage && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{errorMessage}</span>
          <div className="error-actions">
            <button 
              className="btn-retry" 
              onClick={() => {
                setError(null);
                retryAIMove();
              }}
              disabled={isThinking}
            >
              🔄 Retry
            </button>
            <button 
              className="error-dismiss" 
              onClick={() => setError(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Premium 2D Chess board */}
      <ChessBoardPremium />

      {/* Game stats */}
      <div className="game-stats">
        <div className="stat">
          <span className="stat-label">Moves:</span>
          <span className="stat-value">{chess.getMoveHistory().length}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Status:</span>
          <span className="stat-value">
            {chess.isCheck() && '⚠️ Check! '}
            {chess.isCheckmate() && '🏆 Checkmate!'}
            {chess.isStalemate() && '🤝 Stalemate'}
            {!chess.isGameOver() && !chess.isCheck() && '▶️ Playing'}
          </span>
        </div>
      </div>

      {/* PGN Display */}
      <details className="pgn-details">
        <summary>View Game Notation (PGN)</summary>
        <pre className="pgn-display">{chess.getPGN() || 'No moves yet'}</pre>
      </details>

      {/* Post-game button (shown after game ends) */}
      {chess.isGameOver() && (
        <button onClick={goToPostGame} className="btn btn-primary btn-analyze">
          Analyze Game with AI 💬
        </button>
      )}

      {/* Debug Panel */}
      <DebugPanel />
    </div>
  );
};
