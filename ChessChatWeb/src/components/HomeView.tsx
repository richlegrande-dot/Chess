import { useState } from 'react';
import '../styles/HomeView.css';

interface HomeViewProps {
  onPlayChess: () => void;
  onSettings: () => void;
  onAbout: () => void;
}

export function HomeView({ onPlayChess, onSettings, onAbout }: HomeViewProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handlePlayClick = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onPlayChess();
    }, 300);
  };

  return (
    <div className="home-view" role="main" aria-label="ChessChat home page">
      <div className="home-container">
        <header className="home-header">
          <h1 className="home-title">
            <span className="chess-icon" aria-hidden="true">♟️</span>
            ChessChat
          </h1>
          <p className="home-subtitle">
            Play chess against AI and learn from your games
          </p>
        </header>

        <nav className="home-actions" role="navigation" aria-label="Main navigation">
          <button
            className={`home-button primary ${isAnimating ? 'animating' : ''}`}
            onClick={handlePlayClick}
            aria-label="Play Chess vs AI - Start a new game"
          >
            <span className="button-icon" aria-hidden="true">🎮</span>
            <span className="button-text">
              <span className="button-label">Play Chess vs AI</span>
              <span className="button-sublabel">Start a new game</span>
            </span>
          </button>

          <button className="home-button secondary" onClick={onSettings} aria-label="Settings - Choose AI model">
            <span className="button-icon" aria-hidden="true">⚙️</span>
            <span className="button-text">
              <span className="button-label">Settings</span>
              <span className="button-sublabel">Choose AI model</span>
            </span>
          </button>

          <button className="home-button secondary" onClick={onAbout} aria-label="About - Learn more about ChessChat">
            <span className="button-icon" aria-hidden="true">ℹ️</span>
            <span className="button-text">
              <span className="button-label">About</span>
              <span className="button-sublabel">Learn more</span>
            </span>
          </button>
        </nav>

        <div className="home-features" role="list" aria-label="Features">
          <div className="feature" role="listitem">
            <span className="feature-icon" aria-hidden="true">🤖</span>
            <span className="feature-text">Multiple AI opponents</span>
          </div>
          <div className="feature" role="listitem">
            <span className="feature-icon" aria-hidden="true">💬</span>
            <span className="feature-text">Post-game analysis</span>
          </div>
          <div className="feature" role="listitem">
            <span className="feature-icon" aria-hidden="true">📊</span>
            <span className="feature-text">Learn from mistakes</span>
          </div>
        </div>

        <footer className="home-footer">
          <p className="version-info">Version 1.2.0</p>
        </footer>
      </div>
    </div>
  );
}
