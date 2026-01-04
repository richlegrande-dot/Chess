/**
 * Training Data Manager Component
 * Displays real learning progress from Wall-E's learning system
 */

import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { trainingCollector, TrainingExample } from '../lib/coaching';
import '../styles/TrainingDataManager.css';

interface LearningProgress {
  success: boolean;
  userId: string;
  gamesAnalyzed: number;
  lastIngestedAt: string | null;
  topWeakConcepts: Array<{ name: string; mastery: number; lastSeen: string | null }>;
  topStrongConcepts: Array<{ name: string; mastery: number; lastSeen: string | null }>;
  recentKeyMoments: Array<any>;
  totalConcepts: number;
  avgMastery: number;
}

export const TrainingDataManager: React.FC = () => {
  const [examples, setExamples] = useState<TrainingExample[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [selectedExample, setSelectedExample] = useState<TrainingExample | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Real server progress
  const [serverProgress, setServerProgress] = useState<LearningProgress | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);

  useEffect(() => {
    refreshData();
    loadServerProgress();
  }, []);

  const refreshData = () => {
    setExamples(trainingCollector.getExamples());
    setStatistics(trainingCollector.getStatistics());
  };
  
  const loadServerProgress = async () => {
    try {
      setLoadingProgress(true);
      setProgressError(null);
      
      const userId = localStorage.getItem('userId') || `guest-${Date.now()}`;
      const progress = await api.learning.progress(userId);
      
      setServerProgress(progress);
    } catch (error) {
      console.error('[TrainingPortal] Failed to load progress:', error);
      setProgressError(error instanceof Error ? error.message : 'Failed to load progress');
    } finally {
      setLoadingProgress(false);
    }
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
          "I learn from every game you play!"
        </p>
        <p style={{ fontSize: '0.95rem', opacity: 0.8 }}>
          🎓 Wall-E tracks your chess concepts and builds personalized coaching
        </p>
      </div>

      {/* Server Learning Progress (Real Data) */}
      <div className="server-progress-section">
        <h2>📊 Server Learning Progress</h2>
        
        {loadingProgress && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading learning progress...</p>
          </div>
        )}
        
        {progressError && (
          <div className="error-state">
            <p>⚠️ Could not load server progress: {progressError}</p>
            <button onClick={loadServerProgress} className="retry-button">🔄 Retry</button>
          </div>
        )}
        
        {serverProgress && !loadingProgress && (
          <div className="server-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{serverProgress.gamesAnalyzed}</div>
                <div className="stat-label">Games Analyzed by Server</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{serverProgress.totalConcepts}</div>
                <div className="stat-label">Concepts Tracked</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{(serverProgress.avgMastery * 100).toFixed(0)}%</div>
                <div className="stat-label">Average Mastery</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {serverProgress.lastIngestedAt 
                    ? new Date(serverProgress.lastIngestedAt).toLocaleDateString()
                    : 'Never'}
                </div>
                <div className="stat-label">Last Game Analyzed</div>
              </div>
            </div>
            
            {/* Weak Concepts */}
            {serverProgress.topWeakConcepts.length > 0 && (
              <div className="concepts-section">
                <h3>🎯 Areas to Improve</h3>
                <div className="concepts-list">
                  {serverProgress.topWeakConcepts.map((concept, i) => (
                    <div key={i} className="concept-item weak">
                      <span className="concept-name">{concept.name}</span>
                      <div className="mastery-bar">
                        <div 
                          className="mastery-fill weak" 
                          style={{ width: `${concept.mastery * 100}%` }}
                        />
                      </div>
                      <span className="mastery-value">{(concept.mastery * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Strong Concepts */}
            {serverProgress.topStrongConcepts.length > 0 && (
              <div className="concepts-section">
                <h3>💪 Your Strengths</h3>
                <div className="concepts-list">
                  {serverProgress.topStrongConcepts.map((concept, i) => (
                    <div key={i} className="concept-item strong">
                      <span className="concept-name">{concept.name}</span>
                      <div className="mastery-bar">
                        <div 
                          className="mastery-fill strong" 
                          style={{ width: `${concept.mastery * 100}%` }}
                        />
                      </div>
                      <span className="mastery-value">{(concept.mastery * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Recent Key Moments */}
            {serverProgress.recentKeyMoments.length > 0 && (
              <div className="key-moments-section">
                <h3>🔑 Recent Key Moments</h3>
                <div className="moments-list">
                  {serverProgress.recentKeyMoments.map((moment, i) => (
                    <div key={i} className="moment-card">
                      <div className="moment-header">
                        <span className="moment-game">Game {serverProgress.gamesAnalyzed - i}</span>
                        <span className="moment-date">
                          {new Date(moment.timestamp).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="moment-stats">
                        <span>Blunders: {moment.blunders}</span>
                        <span>Mistakes: {moment.mistakes}</span>
                        <span>Accuracy: {moment.accuracy.toFixed(0)}%</span>
                        <span className="concepts-updated">
                          {moment.conceptsUpdated} concepts updated
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button onClick={loadServerProgress} className="refresh-button">
              🔄 Refresh Progress
            </button>
          </div>
        )}
        
        {serverProgress && serverProgress.gamesAnalyzed === 0 && (
          <div className="empty-state">
            <p>🌱 No games analyzed yet. Play a game to start learning!</p>
          </div>
        )}
      </div>

      {/* Local Browser Cache (Legacy) */}
      {statistics && examples.length > 0 && (
        <div className="local-cache-section">
          <h2>💾 Local Browser Cache</h2>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginBottom: '1rem' }}>
            Note: This is local browser storage only. Server learning progress is shown above.
          </p>
          
          <div className="statistics-overview">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{statistics.totalGames}</div>
                <div className="stat-label">Games in Cache</div>
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
          </div>
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
