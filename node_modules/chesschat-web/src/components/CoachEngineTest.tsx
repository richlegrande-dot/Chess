/**
 * CoachEngineTest Component
 * 
 * Test interface for CoachEngine functionality:
 * - Generate coaching advice from game analysis
 * - Get thematic coaching (e.g., "tactics", "pins", "endgame")
 * - Search knowledge base
 */

import React, { useState } from 'react';
import { api } from '../lib/api';
import { useAdminStore } from '../store/adminStore';
import './CoachEngineTest.css';

interface CoachingResult {
  advice?: string;
  relevantKnowledge?: string[];
  sources?: string[];
  confidence?: number;
  coaching?: string;
  theme?: string;
  results?: any[];
  query?: string;
  count?: number;
}

export const CoachEngineTest: React.FC = () => {
  const sessionToken = useAdminStore((state) => state.sessionToken);
  const [activeTab, setActiveTab] = useState<'advice' | 'thematic' | 'search'>('advice');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Advice generation form
  const [gamePhase, setGamePhase] = useState<'opening' | 'middlegame' | 'endgame'>('endgame');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [skillLevel, setSkillLevel] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [themes, setThemes] = useState('tactics, pins');
  const [moveCount, setMoveCount] = useState(100);

  // Thematic coaching form
  const [thematicTheme, setThematicTheme] = useState('tactics');

  // Search form
  const [searchQuery, setSearchQuery] = useState('pin');

  const handleGenerateAdvice = async () => {
    if (!sessionToken) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Create mock game analysis
      const mockAnalysis = {
        overallRating: 75,
        gameStats: {
          blunders: 2,
          mistakes: 3,
          inaccuracies: 5,
          accuracyPercentage: 78,
        },
        takeaways: [
          {
            title: 'Missed Tactical Opportunity',
            description: 'You overlooked a pin that could have won material',
            category: 'tactics',
            priority: 'high',
          },
          {
            title: 'King Safety Issue',
            description: 'Your king was exposed in the middlegame',
            category: 'strategy',
            priority: 'medium',
          },
        ],
      };

      const context = {
        gamePhase,
        playerColor,
        skillLevel,
        themes: themes.split(',').map(t => t.trim()),
        moveCount,
      };

      const response = await api.admin.coach.generateAdvice(sessionToken, mockAnalysis, context);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to generate advice');
    } finally {
      setLoading(false);
    }
  };

  const handleThematicCoaching = async () => {
    if (!sessionToken) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.admin.coach.getThematicCoaching(sessionToken, thematicTheme, skillLevel);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to get thematic coaching');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!sessionToken) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await api.admin.coach.searchKnowledge(sessionToken, searchQuery);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to search knowledge');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="coach-engine-test">
      <div className="test-header">
        <h2>🧠 CoachEngine Testing</h2>
        <p>Test the self-created agent with knowledge retrieval</p>
      </div>

      <div className="tabs">
        <button
          className={activeTab === 'advice' ? 'active' : ''}
          onClick={() => setActiveTab('advice')}
        >
          Generate Advice
        </button>
        <button
          className={activeTab === 'thematic' ? 'active' : ''}
          onClick={() => setActiveTab('thematic')}
        >
          Thematic Coaching
        </button>
        <button
          className={activeTab === 'search' ? 'active' : ''}
          onClick={() => setActiveTab('search')}
        >
          Search Knowledge
        </button>
      </div>

      <div className="test-content">
        {activeTab === 'advice' && (
          <div className="form-section">
            <h3>Generate Coaching Advice</h3>
            <p className="help-text">Create advice based on game analysis + context</p>

            <div className="form-group">
              <label>Game Phase:</label>
              <select value={gamePhase} onChange={(e) => setGamePhase(e.target.value as any)}>
                <option value="opening">Opening</option>
                <option value="middlegame">Middlegame</option>
                <option value="endgame">Endgame</option>
              </select>
            </div>

            <div className="form-group">
              <label>Player Color:</label>
              <select value={playerColor} onChange={(e) => setPlayerColor(e.target.value as any)}>
                <option value="white">White</option>
                <option value="black">Black</option>
              </select>
            </div>

            <div className="form-group">
              <label>Skill Level:</label>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as any)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div className="form-group">
              <label>Themes (comma-separated):</label>
              <input
                type="text"
                value={themes}
                onChange={(e) => setThemes(e.target.value)}
                placeholder="tactics, pins, forks"
              />
            </div>

            <div className="form-group">
              <label>Move Count:</label>
              <input
                type="number"
                value={moveCount}
                onChange={(e) => setMoveCount(parseInt(e.target.value))}
                min="1"
                max="100"
              />
            </div>

            <button onClick={handleGenerateAdvice} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Advice'}
            </button>
          </div>
        )}

        {activeTab === 'thematic' && (
          <div className="form-section">
            <h3>Get Thematic Coaching</h3>
            <p className="help-text">Get coaching on a specific theme</p>

            <div className="form-group">
              <label>Theme:</label>
              <input
                type="text"
                value={thematicTheme}
                onChange={(e) => setThematicTheme(e.target.value)}
                placeholder="e.g., tactics, pins, endgame, opening"
              />
            </div>

            <div className="form-group">
              <label>Skill Level:</label>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as any)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <button onClick={handleThematicCoaching} disabled={loading}>
              {loading ? 'Getting Coaching...' : 'Get Coaching'}
            </button>
          </div>
        )}

        {activeTab === 'search' && (
          <div className="form-section">
            <h3>Search Knowledge Base</h3>
            <p className="help-text">Search for specific content in knowledge chunks</p>

            <div className="form-group">
              <label>Search Query:</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g., pin, fork, endgame"
              />
            </div>

            <button onClick={handleSearch} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        )}

        {error && <div className="error-message">❌ {error}</div>}

        {result && (
          <div className="result-section">
            <h3>Results</h3>

            {result.advice && (
              <div className="advice-result">
                <h4>Coaching Advice</h4>
                <pre className="advice-text">{result.advice}</pre>
                {result.confidence !== undefined && (
                  <p className="confidence">Confidence: {(result.confidence * 100).toFixed(0)}%</p>
                )}
                {result.sources && result.sources.length > 0 && (
                  <div className="sources">
                    <strong>Sources Used:</strong>
                    <ul>
                      {result.sources.map((source, i) => (
                        <li key={i}>{source}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {result.coaching && (
              <div className="coaching-result">
                <h4>Thematic Coaching: {result.theme}</h4>
                <pre className="coaching-text">{result.coaching}</pre>
              </div>
            )}

            {result.results && (
              <div className="search-results">
                <h4>Search Results ({result.count} found)</h4>
                {result.results.map((chunk: any, i: number) => (
                  <div key={i} className="search-result-item">
                    <div className="chunk-header">
                      <strong>{chunk.source}</strong>
                      <span className="tags">{chunk.tags}</span>
                    </div>
                    <p className="chunk-preview">{chunk.text}</p>
                    <details>
                      <summary>View Full Text</summary>
                      <pre className="chunk-full">{chunk.fullText}</pre>
                    </details>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
