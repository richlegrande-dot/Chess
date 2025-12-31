// Settings Component - Model selection + UX preferences

import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AIModelRegistry } from '../lib/models';
import { soundManager } from '../lib/sounds';
import '../styles/Settings.css';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { selectedModel, selectModel } = useGameStore();
  const [tempModel, setTempModel] = useState(selectedModel);
  const [soundsEnabled, setSoundsEnabled] = useState(soundManager.isEnabled());
  const [dragEnabled, setDragEnabled] = useState(
    localStorage.getItem('drag-enabled') !== 'false'
  );
  const [reducedMotion, setReducedMotion] = useState(
    localStorage.getItem('reduce-motion') === 'true'
  );
  const [analyticsEnabled, setAnalyticsEnabled] = useState(
    localStorage.getItem('analytics-enabled') !== 'false'
  );

  const handleSave = () => {
    selectModel(tempModel);
    soundManager.setEnabled(soundsEnabled);
    localStorage.setItem('drag-enabled', String(dragEnabled));
    localStorage.setItem('reduce-motion', String(reducedMotion));
    localStorage.setItem('analytics-enabled', String(analyticsEnabled));
    onClose();
  };

  return (
    <div className="settings-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="settings-title">
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2 id="settings-title">Settings</h2>
          <button onClick={onClose} className="btn-close" aria-label="Close settings">
            ✕
          </button>
        </div>

        <div className="settings-content">
          {/* AI Model Selection */}
          <section className="settings-section">
            <h3>AI Model Selection</h3>
            <p className="section-description">
              Choose which AI model to play against and chat with.
            </p>

            <div className="model-list">
              {AIModelRegistry.implementedModels.map((model) => (
                <label
                  key={model.id}
                  className={`model-option ${
                    tempModel.id === model.id ? 'selected' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="model"
                    value={model.id}
                    checked={tempModel.id === model.id}
                    onChange={() => setTempModel(model)}
                  />
                  <div className="model-info">
                    <div className="model-name">{model.displayName}</div>
                    <div className="model-description">{model.description}</div>
                  </div>
                  <div className="model-check">
                    {tempModel.id === model.id && '✓'}
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* UX Preferences */}
          <section className="settings-section">
            <h3>User Experience</h3>
            <p className="section-description">
              Customize visual and audio preferences for your comfort.
            </p>

            <div className="preference-list">
              <label className="preference-option">
                <div className="preference-info">
                  <div className="preference-name">🔊 Sound Effects</div>
                  <div className="preference-description">
                    Play subtle audio cues for moves, captures, and check
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={soundsEnabled}
                  onChange={(e) => setSoundsEnabled(e.target.checked)}
                  className="preference-toggle"
                />
              </label>

              <label className="preference-option">
                <div className="preference-info">
                  <div className="preference-name">🖱️ Drag & Drop Pieces</div>
                  <div className="preference-description">
                    Drag pieces to move (disable for click-to-move only)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={dragEnabled}
                  onChange={(e) => setDragEnabled(e.target.checked)}
                  className="preference-toggle"
                />
              </label>

              <label className="preference-option">
                <div className="preference-info">
                  <div className="preference-name">⚡ Reduce Animations</div>
                  <div className="preference-description">
                    Minimize motion for accessibility or performance
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => setReducedMotion(e.target.checked)}
                  className="preference-toggle"
                  aria-label="Reduce animations"
                />
              </label>

              <label className="preference-option">
                <div className="preference-info">
                  <div className="preference-name">📊 Anonymous Usage Stats</div>
                  <div className="preference-description">
                    Help improve ChessChat with anonymous usage counters (no personal data)
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={analyticsEnabled}
                  onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                  className="preference-toggle"
                  aria-label="Enable anonymous usage statistics"
                />
              </label>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h3>About ChessChat</h3>
            <p className="about-text">
              ChessChat lets you play chess against AI opponents powered by
              advanced language models. After the game, analyze your moves with
              intelligent chat analysis.
            </p>
            <div className="feature-list">
              <div className="feature">✓ Full chess rules and validation</div>
              <div className="feature">✓ Drag & drop or click-to-move</div>
              <div className="feature">✓ Multiple AI models to choose from</div>
              <div className="feature">✓ Post-game analysis chat</div>
              <div className="feature">✓ Self-healing retry logic</div>
              <div className="feature">✓ Sound effects and animations</div>
            </div>
          </section>

          {/* Privacy */}
          <section className="settings-section">
            <h3>Privacy & Security</h3>
            <p className="privacy-text">
              Your game data (moves, positions) is sent to the selected AI
              service only for gameplay and analysis. No game data is stored on
              our servers. API keys are configured via Cloudflare environment
              variables and are not accessible to clients.
            </p>
          </section>
        </div>

        <div className="settings-footer">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button onClick={handleSave} className="btn-save">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
