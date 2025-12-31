/**
 * Wall-E Confidence Dashboard
 * 
 * Displays learning progress, high-confidence patterns, and teaching status
 */

import React, { useState, useEffect } from 'react';
import { getProtectedTrainingCore } from '../lib/coaching/protectedTrainingCore';
import { getLearningStatistics } from '../lib/cpu/learningIntegration';

interface ConfidenceDashboardProps {
  compact?: boolean;
}

export const ConfidenceDashboard: React.FC<ConfidenceDashboardProps> = ({ compact = false }) => {
  const [learningStats, setLearningStats] = useState<any>(null);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [totalGames, setTotalGames] = useState(0);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 3000); // Refresh every 3 seconds
    return () => clearInterval(interval);
  }, []);

  const refreshData = () => {
    try {
      const stats = getLearningStatistics();
      setLearningStats(stats);
      
      const core = getProtectedTrainingCore();
      setTotalGames(core.getTotalGamesPlayed());
      
      const allSignatures = core.getSignatures();
      const highConfidence = allSignatures
        .filter(sig => sig.confidenceScore >= 0.5)
        .sort((a, b) => b.confidenceScore - a.confidenceScore)
        .slice(0, 5);
      
      setSignatures(highConfidence);
    } catch (error) {
      console.log('[ConfidenceDashboard] Not available yet:', error);
    }
  };

  if (!learningStats || !learningStats.available) {
    return (
      <div className="confidence-dashboard">
        <div className="dashboard-header">
          <h3>🧠 Learning Status</h3>
        </div>
        <div className="not-ready">
          <p>🌱 Wall-E is collecting data...</p>
          <p>Play {10 - (learningStats?.gamesPlayed || 0)} more games to start learning!</p>
        </div>
      </div>
    );
  }

  const getMilestoneMessage = () => {
    if (totalGames >= 50) {
      return { emoji: '🎓', text: 'Master Coach', color: '#9c27b0' };
    } else if (totalGames >= 25) {
      return { emoji: '🌟', text: 'Advanced Learning', color: '#2196f3' };
    } else if (totalGames >= 10) {
      return { emoji: '📈', text: 'Pattern Detection', color: '#4caf50' };
    }
    return { emoji: '🌱', text: 'Building Data', color: '#ff9800' };
  };

  const milestone = getMilestoneMessage();

  if (compact) {
    return (
      <div className="confidence-dashboard compact">
        <div className="dashboard-compact-content">
          <span className="milestone-badge" style={{ backgroundColor: milestone.color }}>
            {milestone.emoji} {milestone.text}
          </span>
          <span className="stats-summary">
            {totalGames} games | {learningStats.confirmedPatterns} patterns
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="confidence-dashboard">
      <div className="dashboard-header">
        <h3>🧠 Wall-E's Learning Progress</h3>
        <div className="milestone-indicator" style={{ backgroundColor: milestone.color }}>
          {milestone.emoji} {milestone.text}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{totalGames}</div>
          <div className="stat-label">Games Played</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{learningStats.confirmedPatterns}</div>
          <div className="stat-label">Patterns Detected</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{learningStats.teachablePatterns}</div>
          <div className="stat-label">Teaching Active</div>
        </div>
      </div>

      {signatures.length > 0 && (
        <div className="high-confidence-patterns">
          <h4>🎯 High-Confidence Patterns</h4>
          <div className="patterns-list">
            {signatures.map((sig, i) => (
              <div key={i} className="pattern-item">
                <div className="pattern-header">
                  <span className="pattern-title">{sig.title}</span>
                  <span className="confidence-badge" style={{
                    backgroundColor: sig.confidenceScore >= 0.85 ? '#4caf50' : 
                                   sig.confidenceScore >= 0.7 ? '#2196f3' : '#ff9800'
                  }}>
                    {(sig.confidenceScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="pattern-stats">
                  <span>Seen {sig.occurrences}x</span>
                  <span>•</span>
                  <span>Mastery: {sig.masteryScore}%</span>
                  {sig.isHighConfidence && <span className="badge-high">🎓 Stable</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {learningStats.readyForTeaching && (
        <div className="teaching-status active">
          <p>✅ Wall-E is actively teaching based on your patterns!</p>
        </div>
      )}

      <div className="next-milestone">
        {totalGames < 10 && (
          <p>Play {10 - totalGames} more games to unlock pattern detection!</p>
        )}
        {totalGames >= 10 && totalGames < 25 && (
          <p>Play {25 - totalGames} more games for advanced personalization!</p>
        )}
        {totalGames >= 25 && totalGames < 50 && (
          <p>Play {50 - totalGames} more games to reach master coach level!</p>
        )}
        {totalGames >= 50 && (
          <p>🎉 Wall-E knows your habits deeply and provides expert coaching!</p>
        )}
      </div>
    </div>
  );
};

// CSS for the dashboard (to be added to a separate CSS file)
const dashboardStyles = `
.confidence-dashboard {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 1.5rem;
  color: white;
  margin-bottom: 1.5rem;
}

.confidence-dashboard.compact {
  padding: 0.75rem;
}

.dashboard-compact-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.dashboard-header h3 {
  margin: 0;
  font-size: 1.3rem;
}

.milestone-indicator,
.milestone-badge {
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.9rem;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.15);
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 0.25rem;
}

.stat-label {
  font-size: 0.85rem;
  opacity: 0.9;
}

.high-confidence-patterns {
  margin-bottom: 1rem;
}

.high-confidence-patterns h4 {
  margin: 0 0 0.75rem 0;
  font-size: 1.1rem;
}

.patterns-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.pattern-item {
  background: rgba(255, 255, 255, 0.15);
  padding: 0.75rem;
  border-radius: 8px;
}

.pattern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.pattern-title {
  font-weight: 600;
}

.confidence-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: bold;
}

.pattern-stats {
  font-size: 0.85rem;
  opacity: 0.9;
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.badge-high {
  background: rgba(255, 255, 255, 0.3);
  padding: 0.15rem 0.5rem;
  border-radius: 10px;
  font-size: 0.75rem;
}

.teaching-status {
  background: rgba(76, 175, 80, 0.3);
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
  text-align: center;
  font-weight: 500;
}

.next-milestone {
  background: rgba(255, 255, 255, 0.1);
  padding: 0.75rem;
  border-radius: 8px;
  text-align: center;
  font-size: 0.9rem;
  font-weight: 500;
}

.not-ready {
  text-align: center;
  padding: 2rem 1rem;
}

.not-ready p {
  margin: 0.5rem 0;
  font-size: 1.1rem;
}

.stats-summary {
  font-size: 0.9rem;
  opacity: 0.9;
}
`;

export default ConfidenceDashboard;
