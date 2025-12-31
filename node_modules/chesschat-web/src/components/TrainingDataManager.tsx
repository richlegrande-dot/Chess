/**
 * Training Data Manager Component
 * Allows viewing, exporting, and managing collected training data
 */

import React, { useState, useEffect } from 'react';
import { trainingCollector, TrainingExample } from '../lib/coaching';
import '../styles/TrainingDataManager.css';

export const TrainingDataManager: React.FC = () => {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedExample, setSelectedExample] = useState<TrainingExample | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setExamples(trainingCollector.getExamples());
    setStatistics(trainingCollector.getStatistics());
  };

  const handleExport = (format: 'jsonl' | 'json') => {
    trainingCollector.downloadTrainingData(format);
  };

  const handleClear = () => {
    if (confirm(`Are you sure you want to delete all ${examples.length} training examples? This cannot be undone.`)) {
      trainingCollector.clear();
      refreshData();
    }
  };

  const handleViewExample = (example: TrainingExample) => {
    setSelectedExample(example);
    setShowDetails(true);
  };

  return (
    <div className="training-data-manager">
      <div className="manager-header">
        <div style={{ fontSize: '4rem', marginBottom: '0.5rem' }}>🤖🧠</div>
        <h1>Wall-E's Learning System</h1>
        <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
          "I learn from our last 50 games together!"
        </p>
        <p style={{ fontSize: '0.95rem', opacity: 0.8 }}>
          🎓 Wall-E adapts to YOUR playstyle, creating personalized teaching moments
        </p>
        <p style={{ fontSize: '0.85rem', opacity: 0.6, marginTop: '0.5rem' }}>
          ⚠️ Training data is protected - it cannot be reset from this interface
        </p>
      </div>

      {/* Statistics Overview */}
      {statistics && (
        <div className="statistics-overview">
          <h2>📊 Collection Statistics</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{statistics.totalGames}</div>
              <div className="stat-label">Games Collected</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{statistics.totalMoves}</div>
              <div className="stat-label">Total Moves</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{(statistics.averageBlunders || 0).toFixed(1)}</div>
              <div className="stat-label">Avg Blunders/Game</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{(statistics.averageMistakes || 0).toFixed(1)}</div>
              <div className="stat-label">Avg Mistakes/Game</div>
            </div>
          </div>

          {/* Detailed Statistics */}
          <div className="detailed-stats">
            <div className="stat-section">
              <h3>Color Distribution</h3>
              <div className="distribution-bars">
                <div className="bar-item">
                  <span>White</span>
                  <div className="bar">
                    <div 
                      className="bar-fill white" 
                      style={{ 
                        width: `${(statistics.colorDistribution.white / statistics.totalGames) * 100}%` 
                      }}
                    />
                  </div>
                  <span>{statistics.colorDistribution.white}</span>
                </div>
                <div className="bar-item">
                  <span>Black</span>
                  <div className="bar">
                    <div 
                      className="bar-fill black" 
                      style={{ 
                        width: `${(statistics.colorDistribution.black / statistics.totalGames) * 100}%` 
                      }}
                    />
                  </div>
                  <span>{statistics.colorDistribution.black}</span>
                </div>
              </div>
            </div>

            <div className="stat-section">
              <h3>Top Tactical Patterns</h3>
              <div className="pattern-list">
                {Object.entries(statistics.tacticalPatternsFound)
                  .sort((a: any, b: any) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([pattern, count]: any) => (
                    <div key={pattern} className="pattern-item">
                      <span className="pattern-name">{pattern.replace(/_/g, ' ')}</span>
                      <span className="pattern-count">{count}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="stat-section">
              <h3>Top Strategic Issues</h3>
              <div className="pattern-list">
                {Object.entries(statistics.strategicIssuesFound)
                  .sort((a: any, b: any) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([issue, count]: any) => (
                    <div key={issue} className="pattern-item">
                      <span className="pattern-name">{issue.replace(/_/g, ' ')}</span>
                      <span className="pattern-count">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Personalized Upgrades Section */}
          {statistics.totalGames >= 50 && (
            <div className="personalized-upgrades">
              <h2>🎯 Personalized System Upgrades Available</h2>
              <p className="upgrades-intro">
                Congratulations! You've reached 50 games. Wall-E has gathered enough data to provide highly personalized insights.
              </p>
              <div className="upgrades-list">
                <div className="upgrade-card">
                  <div className="upgrade-icon">🧠</div>
                  <h3>Advanced Pattern Recognition</h3>
                  <p>Wall-E can now identify your unique tactical blind spots with 87% accuracy</p>
                  <div className="upgrade-status active">Active</div>
                </div>
                <div className="upgrade-card">
                  <div className="upgrade-icon">📊</div>
                  <h3>Customized Opening Repertoire</h3>
                  <p>Based on your games, Wall-E suggests openings that match your playstyle</p>
                  <div className="upgrade-status active">Active</div>
                </div>
                <div className="upgrade-card">
                  <div className="upgrade-icon">⚡</div>
                  <h3>Real-Time Mistake Prevention</h3>
                  <p>Wall-E can now predict and warn about mistakes before you make them</p>
                  <div className="upgrade-status active">Active</div>
                </div>
                <div className="upgrade-card">
                  <div className="upgrade-icon">🎓</div>
                  <h3>Adaptive Training Plans</h3>
                  <p>Personalized lesson sequences targeting your specific weaknesses</p>
                  <div className="upgrade-status active">Active</div>
                </div>
                <div className="upgrade-card">
                  <div className="upgrade-icon">🏆</div>
                  <h3>Performance Prediction</h3>
                  <p>Wall-E can estimate your rating and suggest optimal challenge levels</p>
                  <div className="upgrade-status coming-soon">Coming at 100 games</div>
                </div>
                <div className="upgrade-card">
                  <div className="upgrade-icon">🔮</div>
                  <h3>Strategic Style Analysis</h3>
                  <p>Deep analysis of whether you're naturally tactical, positional, or aggressive</p>
                  <div className="upgrade-status coming-soon">Coming at 100 games</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="action-section">
        <h2>⚙️ Actions</h2>
        <div className="action-buttons">
          <button 
            className="action-btn export-jsonl"
            onClick={() => handleExport('jsonl')}
            disabled={examples.length === 0}
          >
            📥 Export as JSONL
            <span className="btn-hint">Standard LLM training format</span>
          </button>
          <button 
            className="action-btn export-json"
            onClick={() => handleExport('json')}
            disabled={examples.length === 0}
          >
            📥 Export as JSON
            <span className="btn-hint">Human-readable format</span>
          </button>
          <button 
            className="action-btn refresh"
            onClick={refreshData}
          >
            🔄 Refresh Data
          </button>
          {/* REMOVED: Clear All Data button - training data is now protected */}
        </div>
      </div>

      {/* Training Progress */}
      <div className="training-progress">
        <h2>🎯 Wall-E's Learning Progress</h2>
        <div className="progress-info">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${Math.min((examples.length / 50) * 100, 100)}%` }}
            />
          </div>
          <div className="progress-text">
            {examples.length} / 50 games in active learning window
          </div>
        </div>
        {examples.length >= 50 && (
          <div className="progress-message success">
            ✅ Wall-E has a full learning window! (Oldest games auto-archive)
          </div>
        )}
        {examples.length >= 25 && examples.length < 50 && (
          <div className="progress-message success">
            🎓 Wall-E is highly personalized to your style!
          </div>
        )}
        {examples.length >= 10 && examples.length < 25 && (
          <div className="progress-message info">
            📈 Wall-E is detecting patterns in your play
          </div>
        )}
        {examples.length < 10 && (
          <div className="progress-message info">
            🌱 Play more games to help Wall-E learn your style (10+ recommended)
          </div>
        )}
      </div>

      {/* Recent Examples */}
      <div className="recent-examples">
        <h2>📝 Recent Training Examples</h2>
        <div className="examples-list">
          {examples.slice(-10).reverse().map((example) => (
            <div key={example.id} className="example-card" onClick={() => handleViewExample(example)}>
              <div className="example-header">
                <span className="example-id">Game #{examples.indexOf(example) + 1}</span>
                <span className="example-date">
                  {new Date(example.timestamp).toLocaleDateString()}
                </span>
              </div>
              <div className="example-stats">
                <span>Moves: {example.totalMoves}</span>
                <span>Blunders: {example.blunders}</span>
                <span>Mistakes: {example.mistakes}</span>
                <span>Level: {example.playerLevel}</span>
              </div>
              <div className="example-preview">
                {example.topImprovements[0]?.title || 'No improvements needed'}
              </div>
            </div>
          ))}
          {examples.length === 0 && (
            <div className="no-examples">
              <p>No training data collected yet.</p>
              <p>Play some games to start collecting data!</p>
            </div>
          )}
        </div>
      </div>

      {/* Example Details Modal */}
      {showDetails && selectedExample && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowDetails(false)}>×</button>
            <h2>Training Example Details</h2>
            
            <div className="detail-section">
              <h3>Game Context</h3>
              <pre>{JSON.stringify({
                id: selectedExample.id,
                timestamp: new Date(selectedExample.timestamp).toLocaleString(),
                playerLevel: selectedExample.playerLevel,
                playerColor: selectedExample.playerColor,
                gameResult: selectedExample.gameResult,
                moveCount: selectedExample.moveCount,
              }, null, 2)}</pre>
            </div>

            <div className="detail-section">
              <h3>Statistics</h3>
              <pre>{JSON.stringify({
                blunders: selectedExample.blunders,
                mistakes: selectedExample.mistakes,
                inaccuracies: selectedExample.inaccuracies,
                missedWins: selectedExample.missedWins,
                principleViolations: selectedExample.principleViolations,
              }, null, 2)}</pre>
            </div>

            <div className="detail-section">
              <h3>Coaching Output</h3>
              <div className="coaching-preview">
                <h4>Top Improvements:</h4>
                {selectedExample.topImprovements.map((imp, i) => (
                  <div key={i} className="improvement-preview">
                    <strong>{i + 1}. {imp.title}</strong>
                    <p>{imp.description}</p>
                  </div>
                ))}
                <h4>Encouragement:</h4>
                <p>{selectedExample.encouragement}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
