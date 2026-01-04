/**
 * Post-Game Coaching Report Component
 * Displays coaching analysis after a game ends
 */

import React, { useState, useEffect } from 'react';
import { CoachingAnalysisModal } from './CoachingAnalysisModal';
import { coachingEngine, CoachingReport } from '../lib/coaching';
import { getEnhancedLearningSystem } from '../lib/coaching/enhancedLearningSystem';
import { GameplayMetrics } from '../lib/coaching/types';
import { Chess } from 'chess.js';
import { api } from '../lib/api';
import '../styles/CoachingReport.css';

interface PostGameCoachingProps {
  moveHistory: Array<{ move: string; fen: string }>;
  playerColor: 'w' | 'b';
  gameResult: string;
  onClose: () => void;
}

export const PostGameCoaching: React.FC<PostGameCoachingProps> = ({
  moveHistory,
  playerColor,
  gameResult,
  onClose,
}) => {
  const [showInsightsChat, setShowInsightsChat] = useState(false);
  const [report, setReport] = useState<CoachingReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerInsights, setPlayerInsights] = useState<any>(null);
  
  // Learning V3 ingestion state
  const [learningStatus, setLearningStatus] = useState<{
    attempted: boolean;
    success: boolean;
    degraded: boolean;
    stockfishWarm: boolean;
    message: string;
    canRetry: boolean;
  }>({ attempted: false, success: false, degraded: false, stockfishWarm: true, message: '', canRetry: false });

  useEffect(() => {
    analyzeGame();
  }, [moveHistory, playerColor]);

  const analyzeGame = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      // Generate coaching report
      const coachingReport = await coachingEngine.analyzeGame(
        moveHistory, 
        playerColor,
        {
          gameId: `game_${Date.now()}`,
          playerLevel: 5, // Default level, could be dynamic
          gameResult,
          collectTrainingData: true, // Enable data collection
        }
      );
      setReport(coachingReport);

      // Record game in enhanced learning system
      const learningSystem = getEnhancedLearningSystem();
      
      // Convert coaching report to simple metrics for learning system
      const simpleMetrics: GameplayMetrics[] = moveHistory.map((move, index) => ({
        moveNumber: index + 1,
        move: move.move,
        fen: move.fen,
        evaluation: 0,
        isBlunder: false,
        isMissedTactic: false,
        player: index % 2 === 0 ? 'w' : 'b'
      }));
      
      await learningSystem.recordGame(
        simpleMetrics,
        moveHistory,
        gameResult,
        playerColor
      );

      // Get updated player insights
      const insights = learningSystem.getPlayerInsights();
      setPlayerInsights(insights);
      
      console.log('[PostGameCoaching] Player insights:', insights);

      // LEARNING V3: Ingest game for server-side analysis
      await ingestGameToLearningV3();
      
    } catch (err) {
      console.error('Coaching analysis error:', err);
      setError('Failed to analyze game. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const ingestGameToLearningV3 = async () => {
    try {
      setLearningStatus(prev => ({ ...prev, attempted: true }));
      
      // Generate PGN from move history
      const chess = new Chess();
      moveHistory.forEach(move => {
        try {
          chess.move(move.move);
        } catch (e) {
          console.warn('[Learning V3] Invalid move in history:', move.move);
        }
      });
      const pgn = chess.pgn();
      
      const userId = localStorage.getItem('userId') || `guest-${Date.now()}`;
      const gameId = `game-${Date.now()}`;
      
      console.log('[Learning V3] Ingesting game:', { userId, gameId, moveCount: moveHistory.length });
      
      const result = await api.ingestGameForLearning(
        userId,
        gameId,
        pgn,
        `${gameResult} - ${moveHistory.length} moves`
      );
      
      // Handle async mode (Architecture Change #3)
      if (result.analysisMode === 'async') {
        console.log('[Learning V3] Game queued for async analysis:', result.requestId);
        setLearningStatus({
          attempted: true,
          success: true,
          degraded: false,
          stockfishWarm: true,
          message: 'Game sent for analysis! Check Training Portal for progress.',
          canRetry: false
        });
        return;
      }
      
      // Handle synchronous modes (legacy or degraded)
      if (result.partial && result.analysisMode === 'degraded') {
        // Stockfish was cold, degraded mode
        console.log('[Learning V3] Degraded mode:', result.message);
        setLearningStatus({
          attempted: true,
          success: true,
          degraded: true,
          stockfishWarm: false,
          message: result.message || 'Analysis queued - Stockfish is warming up',
          canRetry: true
        });
      } else if (result.success) {
        // Full analysis completed
        const conceptCount = result.conceptsUpdated || 0;
        console.log('[Learning V3] Analysis completed:', conceptCount, 'concepts updated');
        setLearningStatus({
          attempted: true,
          success: true,
          degraded: false,
          stockfishWarm: true,
          message: conceptCount > 0 
            ? `Server analysis complete! ${conceptCount} concepts updated.`
            : 'Server analysis complete! Local coaching remains active.',
          canRetry: false
        });
      } else {
        // Error occurred
        setLearningStatus({
          attempted: true,
          success: false,
          degraded: false,
          stockfishWarm: true,
          message: result.error || 'Analysis failed',
          canRetry: true
        });
      }
    } catch (err) {
      console.error('[Learning V3] Ingestion error:', err);
      setLearningStatus({
        attempted: true,
        success: false,
        degraded: false,
        stockfishWarm: true,
        message: err instanceof Error ? err.message : 'Network error',
        canRetry: true
      });
    }
  };


  if (showInsightsChat) {
    // Use CoachingAnalysisModal's chat view for consistency
    return (
      <CoachingAnalysisModal
        gameResult={gameResult}
        moveHistory={moveHistory.map((m, i) => ({ moveNum: i + 1, player: playerColor === 'w' ? 'White' : 'Black', move: m.move, fen: m.fen }))}
        pgn={''}
        playerColor={playerColor === 'w' ? 'White' : 'Black'}
        onClose={() => setShowInsightsChat(false)}
        onMoreInsights={() => setShowInsightsChat(true)}
      />
    );
  }

  if (isAnalyzing) {
    return (
      <div className="coaching-modal">
        <div className="coaching-content analyzing">
          <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'bounce 1s infinite' }}>🤖</div>
          <div className="spinner"></div>
          <h2>Wall-E is studying your game...</h2>
          <p>🔍 Reviewing {moveHistory.length} moves for patterns and insights!</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.7, marginTop: '0.5rem' }}>
            "Hmm, interesting moves! Wall-E is taking notes..." 📝
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="coaching-modal">
        <div className="coaching-content error">
          <h2>Analysis Error</h2>
          <p>{error}</p>
          <button onClick={onClose} className="close-button">Close</button>
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="coaching-modal" onClick={onClose}>
      <div className="coaching-content" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="close-button-x">×</button>
        
        {/* Header */}
        <div className="coaching-header">
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🤖</div>
          <h1>Wall-E's Coaching Report</h1>
          <p style={{ fontSize: '1rem', opacity: 0.8, marginTop: '0.5rem' }}>
            "Great game, friend! Wall-E found some interesting things to share!"
          </p>
          <div className="game-result">{gameResult}</div>
          
          {/* Learning V3 Status Banner */}
          {learningStatus.attempted && learningStatus.degraded && (
            <div style={{
              marginTop: '1rem',
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>⏳</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#f59e0b' }}>Deep Analysis Pending</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '2px' }}>
                  {learningStatus.message}
                </div>
              </div>
            </div>
          )}
          
          {learningStatus.attempted && !learningStatus.degraded && learningStatus.success && (
            <div style={{
              marginTop: '1rem',
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}>
              <span style={{ fontSize: '1.5rem' }}>✅</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: '#10b981' }}>Deep Analysis Complete</div>
                <div style={{ fontSize: '0.85rem', opacity: 0.8, marginTop: '2px' }}>
                  {learningStatus.message}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistics Overview */}
        <div className="statistics-card">
          <h3>Game Statistics</h3>
          <div className="stats-grid">
            <div className="stat-item">
              <span className="stat-label">Total Moves</span>
              <span className="stat-value">{report.statistics.totalMoves}</span>
            </div>
            <div className="stat-item blunders">
              <span className="stat-label">Blunders</span>
              <span className="stat-value">{report.statistics.blunders}</span>
            </div>
            <div className="stat-item mistakes">
              <span className="stat-label">Mistakes</span>
              <span className="stat-value">{report.statistics.mistakes}</span>
            </div>
            <div className="stat-item inaccuracies">
              <span className="stat-label">Inaccuracies</span>
              <span className="stat-value">{report.statistics.inaccuracies}</span>
            </div>
            <div className="stat-item missed">
              <span className="stat-label">Missed Wins</span>
              <span className="stat-value">{report.statistics.missedWins}</span>
            </div>
            <div className="stat-item violations">
              <span className="stat-label">Principle Violations</span>
              <span className="stat-value">{report.statistics.principleViolations}</span>
            </div>
          </div>
        </div>

        {/* Top 3 Improvements */}
        <div className="improvements-section">
          <h2>🎯 Top 3 Areas to Improve</h2>
          {report.improvements.map((improvement, index) => (
            <div key={index} className={`improvement-card priority-${Math.floor(improvement.severity / 3)}`}>
              <div className="improvement-header">
                <h3>
                  {index + 1}. {improvement.title}
                </h3>
                {improvement.moveNumber && (
                  <span className="move-badge">Move {improvement.moveNumber}</span>
                )}
              </div>
              <p className="improvement-description">{improvement.description}</p>
              <span className={`category-badge ${improvement.category}`}>
                {improvement.category === 'tactical' ? '⚔️ Tactical' : '♟️ Strategic'}
              </span>
            </div>
          ))}
        </div>

        {/* Game Phase Analysis */}
        <div className="phase-analysis-section">
          <h2>📊 Performance by Game Phase</h2>
          <div className="phase-grid">
            <div className="phase-card">
              <h4>Opening (Moves 1-15)</h4>
              <p>{report.gamePhaseAnalysis.opening}</p>
            </div>
            <div className="phase-card">
              <h4>Middlegame (Moves 16-30)</h4>
              <p>{report.gamePhaseAnalysis.middlegame}</p>
            </div>
            <div className="phase-card">
              <h4>Endgame (Moves 31+)</h4>
              <p>{report.gamePhaseAnalysis.endgame}</p>
            </div>
          </div>
        </div>

        {/* Focus Areas */}
        <div className="focus-section">
          <div className="focus-card tactical">
            <h3>⚔️ Tactical Focus</h3>
            <p>{report.tacticalFocus}</p>
          </div>
          <div className="focus-card strategic">
            <h3>♟️ Strategic Focus</h3>
            <p>{report.strategicFocus}</p>
          </div>
        </div>

        {/* Encouragement */}
        <div className="encouragement-section">
          <h2>💪 What You Did Well</h2>
          <p className="encouragement-text">{report.encouragement}</p>
        </div>

        {/* Enhanced Player Progress Section */}
        {playerInsights && playerInsights.profile && (
          <div className="player-progress-section">
            <h2>📊 Your Chess Journey - Personalized Insights</h2>
            
            {/* Skills Overview */}
            <div className="skills-overview">
              <div className="skill-item">
                <div className="skill-bar">
                  <div className="skill-fill" style={{ width: `${playerInsights.profile.tacticalRating}%` }}></div>
                </div>
                <span>⚔️ Tactical: {playerInsights.profile.tacticalRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-item">
                <div className="skill-bar">
                  <div className="skill-fill" style={{ width: `${playerInsights.profile.positionalRating}%` }}></div>
                </div>
                <span>♟️ Positional: {playerInsights.profile.positionalRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-item">
                <div className="skill-bar">
                  <div className="skill-fill" style={{ width: `${playerInsights.profile.endgameRating}%` }}></div>
                </div>
                <span>👑 Endgame: {playerInsights.profile.endgameRating.toFixed(0)}/100</span>
              </div>
              <div className="skill-item">
                <div className="skill-bar">
                  <div className="skill-fill" style={{ width: `${playerInsights.profile.openingRating}%` }}></div>
                </div>
                <span>📚 Opening: {playerInsights.profile.openingRating.toFixed(0)}/100</span>
              </div>
            </div>

            {/* Games Played & Improvement Rate */}
            <div className="player-stats">
              <div className="stat-box">
                <span className="stat-number">{playerInsights.profile.gamesPlayed}</span>
                <span className="stat-label">Games Analyzed</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{playerInsights.profile.improvementRate > 0 ? '+' : ''}{playerInsights.profile.improvementRate.toFixed(1)}</span>
                <span className="stat-label">Points/10 Games</span>
              </div>
              <div className="stat-box">
                <span className="stat-number">{playerInsights.profile.playStyle}</span>
                <span className="stat-label">Play Style</span>
              </div>
            </div>

            {/* Strengths and Weaknesses */}
            {(playerInsights.strengthsAndWeaknesses.strengths.length > 0 || 
              playerInsights.strengthsAndWeaknesses.weaknesses.length > 0) && (
              <div className="strengths-weaknesses">
                {playerInsights.strengthsAndWeaknesses.strengths.length > 0 && (
                  <div className="strengths">
                    <h3>💪 Your Strengths</h3>
                    <ul>
                      {playerInsights.strengthsAndWeaknesses.strengths.map((s: string, i: number) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {playerInsights.strengthsAndWeaknesses.weaknesses.length > 0 && (
                  <div className="weaknesses">
                    <h3>🎯 Areas to Improve</h3>
                    <ul>
                      {playerInsights.strengthsAndWeaknesses.weaknesses.map((w: string, i: number) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Recurring Patterns */}
            {playerInsights.profile.commonMistakes && playerInsights.profile.commonMistakes.length > 0 && (
              <div className="recurring-patterns">
                <h3>🔁 Recurring Patterns Wall-E Noticed</h3>
                <p className="pattern-intro">Wall-E has been analyzing your games and noticed these patterns:</p>
                <ul>
                  {playerInsights.profile.commonMistakes.map((mistake: string, i: number) => (
                    <li key={i}>{mistake}</li>
                  ))}
                </ul>
                <p className="pattern-advice">Focus on these areas in your next games to break old habits!</p>
              </div>
            )}

            {/* Recent Progress */}
            {playerInsights.recentProgress && playerInsights.recentProgress.length > 0 && (
              <div className="recent-progress">
                <h3>📈 Recent Progress</h3>
                {playerInsights.recentProgress.map((progress: string, i: number) => (
                  <p key={i}>{progress}</p>
                ))}
              </div>
            )}

            {/* Adaptive Coaching Plan */}
            {playerInsights.coachingPlan && playerInsights.coachingPlan.focus.length > 0 && (
              <div className="coaching-plan">
                <h3>🎓 Your Personalized Training Plan</h3>
                <div className="plan-focus">
                  <strong>Focus Areas:</strong>
                  <ul>
                    {playerInsights.coachingPlan.focus.map((area: string, i: number) => (
                      <li key={i}>{area}</li>
                    ))}
                  </ul>
                </div>
                {playerInsights.coachingPlan.exercises && playerInsights.coachingPlan.exercises.length > 0 && (
                  <div className="plan-exercises">
                    <strong>Recommended Exercises:</strong>
                    <ul>
                      {playerInsights.coachingPlan.exercises.map((ex: any, i: number) => (
                        <li key={i}>
                          <span className="exercise-type">{ex.type}</span>: {ex.description}
                          {ex.difficulty && <span className="difficulty"> (Difficulty: {ex.difficulty}/10)</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="plan-timeline">
                  <p><strong>Timeline:</strong> {playerInsights.coachingPlan.timeframe}</p>
                  <p><strong>Expected Growth:</strong> +{playerInsights.coachingPlan.expectedImprovement.toFixed(0)} rating points</p>
                </div>
              </div>
            )}

            {/* Next Milestone */}
            {playerInsights.nextMilestone && (
              <div className="next-milestone">
                <p><strong>🎯 Next Milestone:</strong> {playerInsights.nextMilestone}</p>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Learning System V2 - What Wall-E Learned */}
        {report && 'learningData' in report && report.learningData && (
          <div className="walle-learning-section">
            <h2>🤖 What Wall-E Learned This Game</h2>
            <p className="learning-intro">
              Wall-E analyzed {report.learningData.events.length} mistake patterns and updated your mastery tracker.
            </p>

            {/* Next Game Focus */}
            {report.learningData.coachingPlan && (
              <div className="next-game-focus">
                <h3>🎯 Focus for Next Game</h3>
                <div className="focus-card-primary">
                  <h4>{report.learningData.coachingPlan.primaryFocus.title}</h4>
                  <p>{report.learningData.coachingPlan.primaryFocus.description}</p>
                  <p className="next-objective">
                    <strong>Your Objective:</strong> {report.learningData.coachingPlan.nextGameObjective}
                  </p>
                  <span className="expected-games">
                    Focus for {report.learningData.coachingPlan.primaryFocus.expectedGames} games
                  </span>
                </div>
              </div>
            )}

            {/* Mistake Signatures with Mastery Scores */}
            {report.learningData.signatures && report.learningData.signatures.length > 0 && (
              <div className="mistake-signatures">
                <h3>🔄 Recurring Patterns & Mastery</h3>
                <div className="signatures-grid">
                  {report.learningData.signatures.slice(0, 5).map((sig: any) => {
                    const masteryPercent = sig.masteryScore.toFixed(0);
                    const masteryColor = sig.masteryScore >= 70 ? '#4ade80' : 
                                        sig.masteryScore >= 40 ? '#fbbf24' : '#ef4444';
                    
                    return (
                      <div key={sig.signatureId} className="signature-card">
                        <div className="signature-header">
                          <span className="signature-title">{sig.title}</span>
                          <span className="signature-category">{sig.category}</span>
                        </div>
                        <div className="mastery-bar">
                          <div 
                            className="mastery-fill" 
                            style={{ width: `${masteryPercent}%`, backgroundColor: masteryColor }}
                          ></div>
                          <span className="mastery-label">{masteryPercent}% Mastery</span>
                        </div>
                        <p className="signature-desc">{sig.description}</p>
                        <div className="signature-meta">
                          <span>{sig.occurrences} occurrences</span>
                          <span>{(sig.successRate * 100).toFixed(0)}% success rate</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Training Recommendations */}
            {report.learningData.coachingPlan && report.learningData.coachingPlan.recommendations.length > 0 && (
              <div className="training-recommendations">
                <h3>💡 Recommended Drills</h3>
                <div className="recommendations-list">
                  {report.learningData.coachingPlan.recommendations.slice(0, 3).map((rec: any, i: number) => (
                    <div key={i} className="recommendation-card">
                      <span className="rec-type">{rec.type}</span>
                      <h4>{rec.title}</h4>
                      <p>{rec.description}</p>
                      <div className="rec-meta">
                        <span>⏱️ {rec.estimatedTime} min</span>
                        <span>📊 Priority: {rec.priority.toFixed(1)}/10</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rotation Schedule */}
            {report.learningData.coachingPlan && report.learningData.coachingPlan.rotationSchedule.length > 0 && (
              <div className="rotation-schedule">
                <h3>📅 Next 5 Games Plan</h3>
                <div className="schedule-list">
                  {report.learningData.coachingPlan.rotationSchedule.map((item: any) => (
                    <div key={item.game} className="schedule-item">
                      <span className="game-number">Game {item.game}</span>
                      <p className="game-objective">{item.objective}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Mastery Streaks */}
            {report.learningData.coachingPlan && report.learningData.coachingPlan.streaks.length > 0 && (
              <div className="mastery-streaks">
                <h3>🔥 Improvement Streaks</h3>
                <div className="streaks-list">
                  {report.learningData.coachingPlan.streaks.map((streak: any) => (
                    <div key={streak.signatureId} className="streak-card">
                      <span className="streak-count">{streak.count}x</span>
                      <span className="streak-title">{streak.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug Info (Collapsible) */}
            {report.learningData.debugInfo && (
              <details className="learning-debug">
                <summary>🔍 Learning Pipeline Debug</summary>
                <div className="debug-content">
                  <p><strong>Detected Events:</strong> {report.learningData.debugInfo.detectedEvents.length}</p>
                  <p><strong>Signature Updates:</strong> {report.learningData.debugInfo.signatureUpdates.length}</p>
                  <p><strong>Planner Rationale:</strong> {report.learningData.debugInfo.plannerRationale}</p>
                  <p><strong>Applied Heuristics:</strong></p>
                  <ul>
                    {report.learningData.debugInfo.appliedHeuristics.map((h: string, i: number) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              </details>
            )}
          </div>
        )}

        {/* Footer Actions */}

        <div className="coaching-footer">
          {learningStatus.canRetry && learningStatus.degraded ? (
            <button 
              onClick={ingestGameToLearningV3} 
              className="primary-button"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
            >
              🔄 Retry Deep Analysis
            </button>
          ) : (
            <button onClick={onClose} className="primary-button">Got it! Start New Game</button>
          )}
          <button onClick={analyzeGame} className="secondary-button">Refresh Analysis</button>
          <button
            className="secondary-button insights-chat-button"
            onClick={() => setShowInsightsChat(true)}
          >
            💬 More Insights Chat
          </button>
        </div>

        {/* Metadata (for debugging) */}
        {report.metadata && (
          <div className="metadata-debug">
            <small>
              Analysis: {report.metadata.source} | Time: {report.metadata.analysisTime}ms
            </small>
          </div>
        )}
      </div>
    </div>
  );
};
