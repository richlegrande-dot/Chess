/**
 * CoachingPanel Component
 * 
 * Displays coaching insights and quick action buttons
 * Integrates with CoachEngine for intelligent coaching
 */

import React, { useState, useEffect } from 'react';
import { useCoaching } from '../hooks/useCoaching';
import '../styles/CoachingPanel.css';

interface CoachingPanelProps {
  gamePhase: 'opening' | 'middlegame' | 'endgame';
  playerColor: 'white' | 'black';
  moveCount: number;
  isVisible: boolean;
  onClose: () => void;
}

export const CoachingPanel: React.FC<CoachingPanelProps> = ({
  gamePhase,
  playerColor,
  moveCount,
  isVisible,
  onClose,
}) => {
  const { searchKnowledge, getThematicGuidance, loading, error, lastResult } = useCoaching();
  const [activeInsight, setActiveInsight] = useState<any>(null);
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  // Auto-load relevant coaching on mount
  useEffect(() => {
    if (isVisible && !lastResult) {
      handleQuickAction(gamePhase);
    }
  }, [isVisible, gamePhase]);

  const handleQuickAction = async (theme: string) => {
    const result = await getThematicGuidance(theme);
    if (result) {
      setActiveInsight(result);
    }
  };

  const handleSearch = async (query: string) => {
    const result = await searchKnowledge(query);
    if (result) {
      setActiveInsight(result);
    }
  };

  const quickActions = {
    opening: [
      { label: '📚 Opening Principles', query: 'opening' },
      { label: '♔ King Safety', query: 'castling' },
      { label: '⚔️ Center Control', query: 'center' },
    ],
    middlegame: [
      { label: '🎯 Tactical Motifs', query: 'tactics' },
      { label: '🎭 Pin & Fork', query: 'pin' },
      { label: '⚡ Discovered Attacks', query: 'discovered' },
    ],
    endgame: [
      { label: '♚ King Activity', query: 'king-activity' },
      { label: '🏁 Passed Pawns', query: 'passed-pawns' },
      { label: '🎓 Opposition', query: 'opposition' },
    ],
  };

  if (!isVisible) return null;

  return (
    <div className="coaching-panel">
      <div className="coaching-header">
        <h3>🧠 Coaching Insights</h3>
        <button onClick={onClose} className="close-btn">×</button>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h4>Quick Topics for {gamePhase}</h4>
        <div className="action-buttons">
          {quickActions[gamePhase].map((action, idx) => (
            <button
              key={idx}
              onClick={() => handleSearch(action.query)}
              disabled={loading}
              className="action-btn"
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="coaching-loading">
          <div className="spinner"></div>
          <p>Getting coaching insights...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="coaching-error">
          <p>⚠️ {error}</p>
          <button onClick={() => handleSearch('tactics')}>Try Again</button>
        </div>
      )}

      {/* Coaching Results */}
      {activeInsight && !loading && (
        <div className="coaching-results">
          {activeInsight.coaching && (
            <div className="coaching-advice">
              <h4>{activeInsight.theme || 'Coaching Guidance'}</h4>
              <p>{activeInsight.coaching}</p>
            </div>
          )}

          {activeInsight.results && activeInsight.results.length > 0 && (
            <div className="knowledge-chunks">
              <h4>📚 Knowledge Base ({activeInsight.count || activeInsight.results.length})</h4>
              {activeInsight.results.map((chunk: any) => (
                <div key={chunk.id} className="chunk-card">
                  <div className="chunk-header">
                    <p className="chunk-text">{chunk.text}</p>
                    {chunk.fullText && (
                      <button
                        onClick={() => setExpandedChunk(
                          expandedChunk === chunk.id ? null : chunk.id
                        )}
                        className="expand-btn"
                      >
                        {expandedChunk === chunk.id ? '▲ Less' : '▼ More'}
                      </button>
                    )}
                  </div>

                  {expandedChunk === chunk.id && chunk.fullText && (
                    <div className="chunk-full-text">
                      <pre>{chunk.fullText}</pre>
                    </div>
                  )}

                  {chunk.source && (
                    <div className="chunk-footer">
                      <span className="source-badge">📖 {chunk.source}</span>
                      {chunk.tags && (
                        <span className="tags">
                          {JSON.parse(chunk.tags).join(', ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeInsight.advice && (
            <div className="generated-advice">
              <h4>💡 Generated Advice</h4>
              <p>{activeInsight.advice}</p>
              {activeInsight.confidence && (
                <div className="confidence">
                  Confidence: {Math.round(activeInsight.confidence * 100)}%
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!activeInsight && !loading && !error && (
        <div className="coaching-empty">
          <p>👋 Select a topic to get coaching insights</p>
        </div>
      )}
    </div>
  );
};
