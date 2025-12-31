import '../styles/AboutView.css';

interface AboutViewProps {
  onBack: () => void;
}

export function AboutView({ onBack }: AboutViewProps) {
  return (
    <div className="about-view">
      <div className="about-container">
        <div className="about-header">
          <button className="back-button" onClick={onBack}>
            ← Back to Home
          </button>
        </div>

        <div className="about-content">
          <div className="about-hero">
            <div className="hero-icon">♟️</div>
            <h1 className="hero-title">ChessChat</h1>
            <p className="hero-subtitle">Your AI-Powered Chess Coach</p>
          </div>

          <section className="about-section">
            <h2>What is ChessChat?</h2>
            <p>
              ChessChat is an interactive chess learning platform where you play against AI opponents
              and receive personalized coaching after every game. Whether you're a beginner learning
              the basics or an experienced player refining your strategy, ChessChat helps you improve.
            </p>
          </section>

          <section className="about-section">
            <h2>How It Works</h2>
            <div className="steps">
              <div className="step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h3>Choose Your AI Opponent</h3>
                  <p>Select from multiple AI models with different playing styles and strengths</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h3>Play a Full Chess Game</h3>
                  <p>Play as White against the AI. All standard chess rules apply</p>
                </div>
              </div>
              <div className="step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h3>Analyze with AI Coach</h3>
                  <p>After the game, ask questions and get detailed analysis of your moves</p>
                </div>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Features</h2>
            <div className="features-grid">
              <div className="feature-item">
                <span className="feature-icon">♟️</span>
                <h3>Full Chess Rules</h3>
                <p>Complete implementation of all chess rules and move validation</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🤖</span>
                <h3>Multiple AI Models</h3>
                <p>Choose from different AI opponents to match your skill level</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">💬</span>
                <h3>Interactive Analysis</h3>
                <p>Ask specific questions about your game and get detailed explanations</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">📊</span>
                <h3>Game Summaries</h3>
                <p>Review statistics and insights after each game</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🔄</span>
                <h3>Self-Healing</h3>
                <p>Automatic error recovery ensures smooth gameplay</p>
              </div>
              <div className="feature-item">
                <span className="feature-icon">🌐</span>
                <h3>Web-Based</h3>
                <p>Play anywhere on any device with a modern browser</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Privacy & Data</h2>
            <p>
              Your privacy matters. ChessChat sends your game moves to the AI service only for
              gameplay and analysis purposes. We don't store your games on our servers, and no
              personal information is collected. All API communication is encrypted and secure.
            </p>
          </section>

          <section className="about-section">
            <h2>Technology</h2>
            <p>
              ChessChat is built with modern web technologies and powered by advanced AI language
              models from OpenAI. The platform runs on Cloudflare's global network for fast,
              reliable performance worldwide.
            </p>
            <div className="tech-stack">
              <span className="tech-badge">React</span>
              <span className="tech-badge">TypeScript</span>
              <span className="tech-badge">Chess.js</span>
              <span className="tech-badge">Cloudflare</span>
              <span className="tech-badge">OpenAI</span>
            </div>
          </section>

          <section className="about-section version-section">
            <h2>Version Information</h2>
            <div className="version-info">
              <div className="version-item">
                <span className="version-label">Version:</span>
                <span className="version-value">1.0.0 RC</span>
              </div>
              <div className="version-item">
                <span className="version-label">Release Date:</span>
                <span className="version-value">December 2025</span>
              </div>
              <div className="version-item">
                <span className="version-label">Platform:</span>
                <span className="version-value">Cloudflare Pages</span>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Get Started</h2>
            <p>
              Ready to improve your chess skills? Head back to the home screen and start your first
              game! Choose an AI opponent, play through a complete game, and discover insights you
              never knew about your playing style.
            </p>
            <button className="btn-get-started" onClick={onBack}>
              Start Playing
            </button>
          </section>
        </div>

        <div className="about-footer">
          <p>© 2025 ChessChat. Built with ♟️ and AI.</p>
        </div>
      </div>
    </div>
  );
}
