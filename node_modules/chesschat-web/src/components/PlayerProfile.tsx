/**
 * Player Profile Component
 * Shows comprehensive player statistics, progress, and insights
 */

import React, { useState, useEffect } from 'react';
import { getEnhancedLearningSystem } from '../lib/coaching/enhancedLearningSystem';
import '../styles/PlayerProfile.css';

export const PlayerProfile: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlayerData();
  }, []);

  const loadPlayerData = () => {
    try {
      const learningSystem = getEnhancedLearningSystem();
      const playerInsights = learningSystem.getPlayerInsights();
      setInsights(playerInsights);
      setLoading(false);
    } catch (error) {
      console.error('Error loading player profile:', error);
      setLoading(false);
    }
  };

  const handleResetProfile = () => {
    if (window.confirm('Are you sure you want to reset your player profile? This will delete all your progress data!')) {
      const learningSystem = getEnhancedLearningSystem();
      learningSystem.resetProfile();
      loadPlayerData();
    }
  };

  const handleExportData = () => {
    const learningSystem = getEnhancedLearningSystem();
    const data = learningSystem.exportPlayerData();
    
    // Create download link
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chesschat-profile-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="player-profile-modal">
        <div className="player-profile-content">
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading your chess profile...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!insights || !insights.profile) {
    return (
      <div className="player-profile-modal" onClick={onClose}>
        <div className="player-profile-content" onClick={(e) => e.stopPropagation()}>
          <button onClick={onClose} className="close-button-x">×</button>
          <div className="empty-state">
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤖</div>
            <h2>No Profile Data Yet</h2>
            <p>Wall-E needs you to play a few games first!</p>
            <p>Once you complete some games in Coaching Mode, Wall-E will start building your personalized chess profile.</p>
            <button onClick={onClose} className="primary-button">Start Playing</button>
          </div>
        </div>
      </div>
    );
  }

  const { profile, recentProgress, nextMilestone, strengthsAndWeaknesses, coachingPlan } = insights;

  return (
    <div className="player-profile-modal" onClick={onClose}>
      <div className="player-profile-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button-x">×</button>
        
        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar">🤖</div>
          <div className="profile-info">
            <h1>Your Chess Profile</h1>
            <p className="profile-subtitle">Wall-E's Personalized Analysis</p>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="profile-stats">
          <div className="stat-card">
            <div className="stat-icon">🎮</div>
            <div className="stat-value">{profile.gamesPlayed}</div>
            <div className="stat-label">Games Analyzed</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-value">{profile.improvementRate > 0 ? '+' : ''}{profile.improvementRate.toFixed(1)}</div>
            <div className="stat-label">Points/10 Games</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚔️</div>
            <div className="stat-value">{profile.playStyle}</div>
            <div className="stat-label">Play Style</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-value">{profile.milestones.length}</div>
            <div className="stat-label">Milestones</div>
          </div>
        </div>

        {/* Skill Ratings */}
        <div className="skills-section">
          <h2>📊 Chess Skills</h2>
          <div className="skill-bars">
            <div className="skill-bar-item">
              <div className="skill-header">
                <span className="skill-name">⚔️ Tactical Awareness</span>
                <span className="skill-rating">{profile.tacticalRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-bar-bg">
                <div className="skill-bar-fill tactical" style={{ width: `${profile.tacticalRating}%` }}></div>
              </div>
            </div>
            
            <div className="skill-bar-item">
              <div className="skill-header">
                <span className="skill-name">♟️ Positional Play</span>
                <span className="skill-rating">{profile.positionalRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-bar-bg">
                <div className="skill-bar-fill positional" style={{ width: `${profile.positionalRating}%` }}></div>
              </div>
            </div>
            
            <div className="skill-bar-item">
              <div className="skill-header">
                <span className="skill-name">👑 Endgame Technique</span>
                <span className="skill-rating">{profile.endgameRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-bar-bg">
                <div className="skill-bar-fill endgame" style={{ width: `${profile.endgameRating}%` }}></div>
              </div>
            </div>
            
            <div className="skill-bar-item">
              <div className="skill-header">
                <span className="skill-name">📚 Opening Knowledge</span>
                <span className="skill-rating">{profile.openingRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-bar-bg">
                <div className="skill-bar-fill opening" style={{ width: `${profile.openingRating}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Strengths and Weaknesses */}
        <div className="strengths-weaknesses-grid">
          <div className="strengths-card">
            <h3>💪 Your Strengths</h3>
            {strengthsAndWeaknesses.strengths.length > 0 ? (
              <ul>
                {strengthsAndWeaknesses.strengths.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">Keep playing to discover your strengths!</p>
            )}
          </div>
          
          <div className="weaknesses-card">
            <h3>🎯 Growth Areas</h3>
            {strengthsAndWeaknesses.weaknesses.length > 0 ? (
              <ul>
                {strengthsAndWeaknesses.weaknesses.map((w: string, i: number) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">You're doing great in all areas!</p>
            )}
          </div>
        </div>

        {/* Recurring Patterns */}
        {profile.commonMistakes && profile.commonMistakes.length > 0 && (
          <div className="patterns-section">
            <h2>🔁 Recurring Patterns</h2>
            <p className="section-subtitle">Wall-E has noticed these patterns in your games:</p>
            <div className="patterns-grid">
              {profile.commonMistakes.map((mistake: string, i: number) => (
                <div key={i} className="pattern-card">
                  <div className="pattern-icon">🔁</div>
                  <div className="pattern-text">{mistake}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Progress */}
        {recentProgress && recentProgress.length > 0 && (
          <div className="progress-section">
            <h2>📈 Recent Progress</h2>
            <div className="progress-list">
              {recentProgress.map((progress: string, i: number) => (
                <div key={i} className="progress-item">{progress}</div>
              ))}
            </div>
          </div>
        )}

        {/* Coaching Plan */}
        {coachingPlan && coachingPlan.focus.length > 0 && (
          <div className="coaching-plan-section">
            <h2>🎓 Your Personalized Training Plan</h2>
            
            <div className="plan-focus">
              <h3>Focus Areas</h3>
              <ul>
                {coachingPlan.focus.map((area: string, i: number) => (
                  <li key={i}>{area}</li>
                ))}
              </ul>
            </div>
            
            {coachingPlan.exercises && coachingPlan.exercises.length > 0 && (
              <div className="plan-exercises">
                <h3>Recommended Exercises</h3>
                <div className="exercises-grid">
                  {coachingPlan.exercises.map((ex: any, i: number) => (
                    <div key={i} className="exercise-card">
                      <div className="exercise-type-badge">{ex.type}</div>
                      <p>{ex.description}</p>
                      {ex.difficulty && <div className="exercise-difficulty">Difficulty: {ex.difficulty}/10</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="plan-summary">
              <div className="summary-item">
                <span className="summary-label">Timeline:</span>
                <span className="summary-value">{coachingPlan.timeframe}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Expected Growth:</span>
                <span className="summary-value">+{coachingPlan.expectedImprovement.toFixed(0)} rating points</span>
              </div>
            </div>
          </div>
        )}

        {/* Next Milestone */}
        {nextMilestone && (
          <div className="milestone-section">
            <h3>🎯 Next Milestone</h3>
            <p>{nextMilestone}</p>
          </div>
        )}

        {/* Milestones History */}
        {profile.milestones && profile.milestones.length > 0 && (
          <div className="milestones-history">
            <h2>🏆 Achievements</h2>
            <div className="milestones-list">
              {profile.milestones.slice(-10).reverse().map((milestone: any, i: number) => (
                <div key={i} className="milestone-item">
                  <div className="milestone-icon">🏆</div>
                  <div className="milestone-info">
                    <div className="milestone-achievement">{milestone.achievement}</div>
                    <div className="milestone-date">{new Date(milestone.date).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="profile-actions">
          <button onClick={onClose} className="primary-button">Back to Game</button>
          <button onClick={handleExportData} className="secondary-button">📥 Export Data</button>
          <button onClick={handleResetProfile} className="danger-button">🗑️ Reset Profile</button>
        </div>
      </div>
    </div>
  );
};
