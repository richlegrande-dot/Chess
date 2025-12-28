import React, { useState, useEffect } from 'react';
import './styles/global.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProductionDiagnostics } from './components/ProductionDiagnostics';
import { autoSyncOnStartViaAPI } from './lib/api/walleApiSync';
import './utils/diagnostics'; // Load frontend diagnostics
import { useGameStore } from './store/gameStore';

// Expose gameStore to window for debugging and logging
if (typeof window !== 'undefined') {
  (window as any).gameStore = useGameStore;
}

// Import types
type AppView = 'home' | 'model-selection' | 'game' | 'coaching' | 'admin' | 'training-data';

// Import GameView directly - ErrorBoundary will catch any errors
import { GameView } from './components/GameView';
import { CoachingMode } from './components/CoachingMode';
import { AdminPortal } from './components/AdminPortal';
import { TrainingDataManager } from './components/TrainingDataManager';
import { useAdminStore } from './store/adminStore';
import { AdminUnlockModal } from './components/admin/AdminUnlockModal';

// Lazy load models to prevent import crashes
const loadModels = async () => {
  try {
    const { AIProvider } = await import('./lib/models');
    const { useGameStore } = await import('./store/gameStore');
    return { AIProvider, useGameStore };
  } catch (error) {
    console.error('Failed to load models/store:', error);
    return null;
  }
};

// Safe GameView wrapper with ErrorBoundary
const SafeGameView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div style={{ background: '#000', minHeight: '100vh', position: 'relative' }}>
      <ErrorBoundary fallback={
        <div style={{ 
          minHeight: '100vh', 
          color: 'white',
          background: '#000',
          padding: '2rem',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '4rem' }}>⚠️</div>
          <div>Chess Game Error</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>The 3D chess components failed to initialize</div>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: '#fff',
              color: '#333',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              marginTop: '1rem'
            }}
          >
            🔄 Reload
          </button>
        </div>
      }>
        <GameView />
      </ErrorBoundary>
      
      {/* Always show back button */}
      <button 
        onClick={onBack} 
        style={{
          position: 'fixed',
          top: '20px',
          left: '20px',
          background: 'rgba(0,0,0,0.9)',
          color: 'white',
          border: '1px solid #333',
          padding: '12px 20px',
          borderRadius: '8px',
          cursor: 'pointer',
          zIndex: 1000,
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        ← Back to Home
      </button>
    </div>
  );
};

function App() {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [isLoading, setIsLoading] = useState(false);
  
  // Auto-sync Wall-E data on startup via API
  useEffect(() => {
    autoSyncOnStartViaAPI().catch(err => {
      console.error('Wall-E auto-sync failed:', err);
    });
  }, []);
  
  const handlePlayChess = () => {
    setCurrentView('model-selection');
  };

  const handleCoachingMode = () => {
    console.log('App: Starting coaching mode');
    setCurrentView('coaching');
  };

  const handleTrainingDataManager = () => {
    console.log('App: Opening training data manager');
    setCurrentView('training-data');
  };

  const TrainingDataManagerWithAuth: React.FC = () => {
    const { isAuthenticated, isSessionValid, clearSession } = useAdminStore();
    const [showUnlock, setShowUnlock] = React.useState(true);

    React.useEffect(() => {
      // Check if session is still valid
      if (isAuthenticated && !isSessionValid()) {
        clearSession();
        setShowUnlock(true);
      }
    }, [isAuthenticated, isSessionValid, clearSession]);

    const handleUnlocked = () => {
      setShowUnlock(false);
    };

    if (showUnlock || !isAuthenticated) {
      return <AdminUnlockModal onUnlocked={handleUnlocked} />;
    }

    return <TrainingDataManager />;
  };

  const handleAdminPortal = () => {
    console.log('App: Opening admin portal');
    setCurrentView('admin');
  };
  
  const handleBackToHome = () => {
    setCurrentView('home');
  };
  
  const handleModelSelect = async (modelName: string) => {
    console.log('App: Selecting model:', modelName);
    setIsLoading(true);
    
    try {
      // Load models and store dynamically to prevent initialization crashes
      const modules = await loadModels();
      
      if (!modules) {
        throw new Error('Failed to load game modules');
      }
      
      // Just navigate to game - GameView will handle model selection internally
      console.log('App: Modules loaded, navigating to game with model:', modelName);
      
      // Store model selection in localStorage for GameView to pick up
      localStorage.setItem('selectedModel', JSON.stringify({
        id: modelName.toLowerCase().replace(' ', '-'),
        name: modelName,
        provider: 'openai',
        modelIdentifier: modelName.toLowerCase().replace(' ', '-'),
        description: `${modelName} AI model`,
        displayName: modelName
      }));
      
      setCurrentView('game');
      
    } catch (error) {
      console.error('App: Error starting game:', error);
      alert(`Error starting game: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  if (currentView === 'model-selection') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        color: 'white',
        background: '#000',
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>Select AI Model</h1>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ marginBottom: '1.5rem' }}>Choose your AI opponent:</p>
          
          {isLoading ? (
            <div style={{ padding: '2rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚙️</div>
              <div>Initializing game modules...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: '0 auto' }}>
              {['GPT-4', 'Claude-3', 'Gemini Pro'].map(model => (
                <button
                  key={model}
                  onClick={() => handleModelSelect(model)}
                  disabled={isLoading}
                  style={{
                    background: '#fff',
                    color: '#333',
                    border: 'none',
                    padding: '16px 24px',
                    borderRadius: '8px',
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    opacity: isLoading ? 0.5 : 1
                  }}
                >
                  {model}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleBackToHome} style={{
          background: 'rgba(255,255,255,0.1)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '12px 24px',
          borderRadius: '8px',
          cursor: 'pointer'
        }}>
          ← Back to Home
        </button>
      </div>
    );
  }
  
  if (currentView === 'admin') {
    return (
      <ErrorBoundary fallback={
        <div style={{ 
          minHeight: '100vh', 
          color: 'white',
          background: '#1a1a1a',
          padding: '2rem',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <div style={{ fontSize: '4rem' }}>⚠️</div>
          <div>Admin Portal Error</div>
          <button 
            onClick={handleBackToHome}
            style={{
              background: '#fff',
              color: '#333',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            ← Back to Home
          </button>
        </div>
      }>
        <AdminPortal />
      </ErrorBoundary>
    );
  }

  if (currentView === 'game') {
    console.log('App: Rendering game view with SafeGameView');
    return <SafeGameView onBack={handleBackToHome} />;
  }

  if (currentView === 'coaching') {
    return (
      <div style={{ background: '#0f172a', minHeight: '100vh', position: 'relative' }}>
        <ErrorBoundary fallback={
          <div style={{ 
            minHeight: '100vh', 
            color: 'white',
            background: '#0f172a',
            padding: '2rem',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '4rem' }}>⚠️</div>
            <div>Coaching Mode Error</div>
            <button 
              onClick={handleBackToHome}
              style={{
                background: '#fff',
                color: '#333',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              ← Back to Home
            </button>
          </div>
        }>
          <div style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            zIndex: 1000
          }}>
            <button
              onClick={handleBackToHome}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '8px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ← Home
            </button>
          </div>
          <CoachingMode />
        </ErrorBoundary>
      </div>
    );
  }

  if (currentView === 'training-data') {
    return (
      <div style={{ background: '#0f172a', minHeight: '100vh', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          zIndex: 1000
        }}>
          <button
            onClick={handleBackToHome}
            style={{
              background: 'rgba(156, 39, 176, 0.2)',
              color: 'white',
              border: '1px solid rgba(156, 39, 176, 0.5)',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(156, 39, 176, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(156, 39, 176, 0.2)';
            }}
          >
            ← Home
          </button>
        </div>
        <TrainingDataManagerWithAuth />
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      color: 'white',
      background: '#000',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <header style={{ marginBottom: '2rem' }}>
        <div style={{ fontSize: '5rem', marginBottom: '0.5rem' }}>♟️</div>
        <h1 style={{ 
          fontSize: '3.5rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          ChessChat
        </h1>
        <p style={{ fontSize: '1.3rem', opacity: 0.9, marginBottom: '0.5rem' }}>
          AI-Powered Chess Platform with Custom LLM Training
        </p>
        <p style={{ fontSize: '1rem', opacity: 0.7 }}>
          Play against intelligent opponents and train your own coaching model
        </p>
      </header>
      
      <main>
        <div style={{ marginBottom: '2rem' }}>
          <p style={{ marginBottom: '1.5rem' }}>
            Train custom LLM models with real game data. Comprehensive coaching powered by self-hosted AI.
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              onClick={handlePlayChess}
              style={{
                background: '#fff',
                color: '#333',
                border: 'none',
                padding: '16px 32px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
              }}
            >
              🤖 AI Chess
            </button>
            
            <button 
              onClick={handleCoachingMode}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.9), rgba(5, 150, 105, 0.9))',
                color: 'white',
                border: 'none',
                padding: '18px 36px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              📚 Coaching Mode
            </button>
            
            <button 
              onClick={handleAdminPortal}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                padding: '16px 32px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold'
              }}
            >
              🔧 Admin Portal
            </button>
            
            <button 
              onClick={handleTrainingDataManager}
              style={{
                background: 'linear-gradient(135deg, rgba(156, 39, 176, 0.9), rgba(123, 31, 162, 0.9))',
                color: 'white',
                border: 'none',
                padding: '18px 36px',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '18px',
                fontWeight: 'bold',
                boxShadow: '0 4px 20px rgba(156, 39, 176, 0.4)',
                transition: 'transform 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              🧠 Training Data
            </button>
          </div>
        </div>
        
        <p style={{ 
          fontSize: '0.95rem', 
          opacity: 0.8,
          maxWidth: '700px',
          margin: '0 auto',
          padding: '1rem',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(102, 126, 234, 0.3)'
        }}>
          <strong>About:</strong> ChessChat is a self-hosted AI chess platform where you can play against intelligent opponents,
          receive comprehensive coaching analysis, and build custom LLM training datasets. All game data stays local
          and can be exported to train your own chess coaching models.
        </p>
      </main>
    </div>
  );
}

// Wrap the entire app in error boundary with diagnostics
const SafeApp: React.FC = () => {
  return (
    <ErrorBoundary>
      <App />
      <ProductionDiagnostics />
    </ErrorBoundary>
  );
};

export default SafeApp;
