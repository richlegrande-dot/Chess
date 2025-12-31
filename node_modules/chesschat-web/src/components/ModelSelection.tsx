import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { AIModelRegistry, AIModel } from '../lib/models';
import '../styles/ModelSelection.css';

interface ModelSelectionProps {
  onSelect: () => void;
  onBack: () => void;
}

// User-friendly model info (non-technical)
const modelInfo: Record<string, { label: string; description: string; badge?: string; strength: string }> = {
  'openai-gpt4o-mini': {
    label: 'GPT-4o Mini',
    description: 'Balanced and fast',
    badge: 'Recommended',
    strength: 'Perfect for learning chess basics',
  },
  'openai-gpt4o': {
    label: 'GPT-4o',
    description: 'Stronger reasoning, slower',
    strength: 'Best for advanced players',
  },
  'openai-gpt4-turbo': {
    label: 'GPT-4 Turbo',
    description: 'High performance',
    strength: 'Great for competitive play',
  },
  'openai-gpt35-turbo': {
    label: 'GPT-3.5 Turbo',
    description: 'Quick and economical',
    strength: 'Good for casual games',
  },
  // Upcoming models
  'anthropic-claude-sonnet': {
    label: 'Claude 3.5 Sonnet',
    description: 'Advanced reasoning',
    badge: 'Coming Soon',
    strength: 'Excellent chess analysis',
  },
  'anthropic-claude-haiku': {
    label: 'Claude 3 Haiku',
    description: 'Fast and efficient',
    badge: 'Coming Soon',
    strength: 'Quick responses',
  },
  'xai-grok-2': {
    label: 'Grok-2',
    description: 'Creative play style',
    badge: 'Coming Soon',
    strength: 'Unique chess strategies',
  },
  'google-gemini-pro': {
    label: 'Gemini 1.5 Pro',
    description: 'Multimodal reasoning',
    badge: 'Coming Soon',
    strength: 'Strong positional play',
  },
  'google-gemini-flash': {
    label: 'Gemini 1.5 Flash',
    description: 'Ultra-fast responses',
    badge: 'Coming Soon',
    strength: 'Quick casual games',
  },
  'mistral-large': {
    label: 'Mistral Large',
    description: 'European excellence',
    badge: 'Coming Soon',
    strength: 'Top-tier reasoning',
  },
};

export function ModelSelection({ onSelect, onBack }: ModelSelectionProps) {
  const { selectedModel, selectModel } = useGameStore();
  const [tempModel, setTempModel] = useState<AIModel>(selectedModel);

  const handleContinue = () => {
    selectModel(tempModel);
    onSelect();
  };

  return (
    <div className="model-selection">
      <div className="model-selection-container">
        <div className="model-selection-header">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h2>Choose Your AI Opponent</h2>
          <p className="header-subtitle">Select the AI model you'd like to play against</p>
        </div>

        <div className="model-options">
          {AIModelRegistry.implementedModels.map((model) => {
            const info = modelInfo[model.id] || {
              label: model.name,
              description: model.description,
              strength: '',
            };
            const isSelected = tempModel.id === model.id;

            return (
              <button
                key={model.id}
                className={`model-card ${isSelected ? 'selected' : ''}`}
                onClick={() => setTempModel(model)}
              >
                {info.badge && (
                  <div className="model-badge">{info.badge}</div>
                )}
                
                <div className="model-card-content">
                  <div className="model-header">
                    <h3 className="model-title">{info.label}</h3>
                    <div className={`model-radio ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <div className="radio-dot" />}
                    </div>
                  </div>
                  
                  <p className="model-description">{info.description}</p>
                  
                  {info.strength && (
                    <p className="model-strength">
                      <span className="strength-icon">🎯</span>
                      {info.strength}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Upcoming Models Section */}
        <div className="upcoming-section">
          <h3 className="upcoming-title">🚀 Coming Soon</h3>
          <div className="upcoming-models">
            {AIModelRegistry.upcomingModels.map((model) => {
              const info = modelInfo[model.id] || {
                label: model.name,
                description: model.description,
                strength: '',
              };

              return (
                <div key={model.id} className="model-card upcoming">
                  <div className="model-badge coming-soon">Coming Soon</div>
                  <div className="model-card-content">
                    <div className="model-header">
                      <h3 className="model-title">{info.label}</h3>
                      <span className="provider-tag">{model.provider}</span>
                    </div>
                    <p className="model-description">{info.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="model-selection-footer">
          <button className="btn-continue" onClick={handleContinue}>
            Start 3D Chess Game
          </button>
          <p className="footer-note">
            You can change the AI model anytime in Settings
          </p>
        </div>
      </div>
    </div>
  );
}
