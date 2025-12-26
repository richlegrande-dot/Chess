/**
 * CPU Error Banner
 * Displays when CPU fails to make a move and offers retry
 */

import React from 'react';
import '../styles/CPUErrorBanner.css';

interface CPUErrorBannerProps {
  error: string;
  onRetry: () => void;
  onDismiss: () => void;
  isRetrying?: boolean;
}

export const CPUErrorBanner: React.FC<CPUErrorBannerProps> = ({
  error,
  onRetry,
  onDismiss,
  isRetrying = false,
}) => {
  return (
    <div className="cpu-error-banner">
      <div className="cpu-error-content">
        <div className="cpu-error-icon">🤖⚠️</div>
        <div className="cpu-error-message">
          <strong>Wall-E Couldn't Move</strong>
          <p>{error}</p>
        </div>
      </div>
      <div className="cpu-error-actions">
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="cpu-error-btn cpu-error-btn-retry"
        >
          {isRetrying ? '⏳ Retrying...' : '🔄 Retry'}
        </button>
        <button
          onClick={onDismiss}
          disabled={isRetrying}
          className="cpu-error-btn cpu-error-btn-dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
