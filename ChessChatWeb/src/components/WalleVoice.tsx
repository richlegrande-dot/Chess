/**
 * Wall-E Voice Component
 * Adds personality and life to the coaching system with dynamic messages
 */

import React, { useState, useEffect } from 'react';

interface WalleVoiceProps {
  context: 'analyzing' | 'thinking' | 'celebrating' | 'encouraging';
  message?: string;
}

const WALLE_MESSAGES = {
  analyzing: [
    "Hmm, interesting moves! 🤔",
    "Wall-E is taking notes... 📝",
    "Let's see what we can learn! 🔍",
    "Scanning for patterns... 🎯",
    "Wall-E loves analyzing games! 💚"
  ],
  thinking: [
    "Wall-E is thinking... 💭",
    "Processing... beep boop! 🤖",
    "Calculating the best advice... 🧮",
    "Wall-E wants to help! ✨"
  ],
  celebrating: [
    "Great job, friend! 🎉",
    "Wall-E is so proud! 🌟",
    "You're improving! 📈",
    "Excellent game! 💪"
  ],
  encouraging: [
    "You've got this! 💚",
    "Wall-E believes in you! 🤖",
    "Every game makes you stronger! 💪",
    "Keep going, friend! 🚀"
  ]
};

export const WalleVoice: React.FC<WalleVoiceProps> = ({ context, message }) => {
  const [currentMessage, setCurrentMessage] = useState(message || WALLE_MESSAGES[context][0]);
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    if (!message) {
      const messages = WALLE_MESSAGES[context];
      const interval = setInterval(() => {
        setIsAnimating(false);
        setTimeout(() => {
          setCurrentMessage(messages[Math.floor(Math.random() * messages.length)]);
          setIsAnimating(true);
        }, 300);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [context, message]);

  return (
    <div style={{
      padding: '1rem',
      background: 'rgba(16, 185, 129, 0.1)',
      borderRadius: '12px',
      border: '2px solid rgba(16, 185, 129, 0.3)',
      marginTop: '1rem',
      transition: 'all 0.3s ease',
      opacity: isAnimating ? 1 : 0.7,
      transform: isAnimating ? 'scale(1)' : 'scale(0.98)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem'
      }}>
        <span style={{
          fontSize: '2rem',
          animation: 'pulse 2s ease-in-out infinite'
        }}>
          🤖
        </span>
        <div>
          <p style={{
            margin: 0,
            fontSize: '0.95rem',
            color: '#10b981',
            fontStyle: 'italic'
          }}>
            {currentMessage}
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Wall-E Thinking Dots - Shows Wall-E is processing
 */
export const WalleThinking: React.FC = () => {
  return (
    <div style={{
      display: 'inline-flex',
      gap: '0.25rem',
      alignItems: 'center',
      marginLeft: '0.5rem'
    }}>
      <span style={{
        fontSize: '0.5rem',
        animation: 'bounce 1s ease-in-out infinite',
        animationDelay: '0s'
      }}>●</span>
      <span style={{
        fontSize: '0.5rem',
        animation: 'bounce 1s ease-in-out infinite',
        animationDelay: '0.2s'
      }}>●</span>
      <span style={{
        fontSize: '0.5rem',
        animation: 'bounce 1s ease-in-out infinite',
        animationDelay: '0.4s'
      }}>●</span>
    </div>
  );
};

export default WalleVoice;
