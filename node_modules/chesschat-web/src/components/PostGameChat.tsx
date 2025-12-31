// PostGameChat Component - Chat with AI about completed game

import React, { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import { api } from '../lib/api';
import type { ChatRequest } from '../lib/models';
import { CoachingPanel } from './CoachingPanel';
import '../styles/PostGameChat.css';

export const PostGameChat: React.FC = () => {
  const {
    chess,
    gameResult,
    selectedModel,
    chatMessages,
    addChatMessage,
    clearChat,
    returnToGame,
    gamePhase,
  } = useGameStore();

  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showCoachingPanel, setShowCoachingPanel] = useState(false);

  const [typingIndicator, setTypingIndicator] = useState(false);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, typingIndicator]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    const message = messageText.trim();
    if (!message || isLoading) return;

    // Add user message
    addChatMessage(message, true);
    setMessageText('');
    setIsLoading(true);
    setTypingIndicator(true);
    setError(null);

    try {
      const request: ChatRequest = {
        message,
        gameContext: {
          finalFEN: chess.getFEN(),
          pgn: chess.getPGN(),
          result: gameResult || 'Unknown',
        },
        chatHistory: chatMessages,
        model: selectedModel.modelIdentifier,
      };

      const response = await api.chat(request);

      // Add AI response with slight delay for animation
      setTimeout(() => {
        addChatMessage(response, false);
        setTypingIndicator(false);
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
      setTypingIndicator(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickQuestion = async (question: string) => {
    setMessageText(question);
    // Trigger form submission
    setTimeout(() => {
      const form = document.querySelector('.chat-input-form') as HTMLFormElement;
      form?.requestSubmit();
    }, 0);
  };

  return (
    <div className="post-game-chat">
      {/* Header */}
      <div className="chat-header">
        <button onClick={returnToGame} className="btn-back">
          ← Back to Game
        </button>
        <h2>Game Analysis</h2>
        <div className="header-actions">
          <button 
            onClick={() => setShowCoachingPanel(!showCoachingPanel)} 
            className="btn-coaching"
            aria-label="Toggle coaching panel"
          >
            🧠 Coaching
          </button>
          <button onClick={clearChat} className="btn-clear">
            Clear Chat
          </button>
        </div>
      </div>

      {/* Game Summary */}
      <div className="game-summary">
        <div className="summary-item">
          <span className="summary-label">Result:</span>
          <span className="summary-value">{gameResult}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Moves:</span>
          <span className="summary-value">{chess.getMoveHistory().length}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">AI Model:</span>
          <span className="summary-value">{selectedModel.name}</span>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="chat-messages">
        {chatMessages.length === 0 ? (
          <div className="chat-empty">
            <div className="empty-icon">💬</div>
            <h3>Ask me about your game!</h3>
            <div className="quick-questions">
              <p className="quick-questions-title">Try asking:</p>
              <button
                onClick={() => handleQuickQuestion('Where did I make mistakes?')}
                className="quick-question-btn"
              >
                Where did I make mistakes?
              </button>
              <button
                onClick={() => handleQuickQuestion('What are better alternatives?')}
                className="quick-question-btn"
              >
                What are better alternatives?
              </button>
              <button
                onClick={() => handleQuickQuestion('How could I have won?')}
                className="quick-question-btn"
              >
                How could I have won?
              </button>
              <button
                onClick={() => handleQuickQuestion('Explain like I\'m 8 years old')}
                className="quick-question-btn"
              >
                Explain like I'm 8 years old
              </button>
            </div>
          </div>
        ) : (
          <>
            {chatMessages.map((msg, index) => (
              <div
                key={msg.id}
                className={`chat-message ${msg.isUser ? 'user' : 'ai'} message-enter`}
                style={{ animationDelay: `${index * 0.05}s` }}
                role="article"
                aria-label={`Message from ${msg.isUser ? 'you' : 'AI assistant'}`}
              >
                <div className="message-avatar" aria-hidden="true">
                  {msg.isUser ? '👤' : '🤖'}
                </div>
                <div className="message-content">
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time" aria-label={`Sent at ${new Date(msg.timestamp).toLocaleTimeString()}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            {typingIndicator && (
              <div 
                className="chat-message ai typing-indicator"
                role="status"
                aria-live="polite"
                aria-label="AI is analyzing your game"
              >
                <div className="message-avatar" aria-hidden="true">🤖</div>
                <div className="message-content">
                  <div className="typing-bubble">
                    <div className="typing-dots" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <span>AI is analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="chat-error">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="chat-input-form" role="form" aria-label="Send a message to AI">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder="Ask about the game..."
          className="chat-input"
          disabled={isLoading}
          aria-label="Type your question about the game"
        />
        <button
          type="submit"
          className="btn-send"
          disabled={!messageText.trim() || isLoading}

      {/* Coaching Panel */}
      <CoachingPanel
        gamePhase={gamePhase || 'middlegame'}
        playerColor="white"
        moveCount={chess.getMoveHistory().length}
        isVisible={showCoachingPanel}
        onClose={() => setShowCoachingPanel(false)}
      />
          aria-label="Send message"
        >
          Send
        </button>
      </form>

      <div className="chat-hint">
        💡 Try: 'Where did I go wrong?' or 'Explain in simple terms'
      </div>
    </div>
  );
};
