/**
 * Global Error Boundary
 * Catches fatal React errors and displays a user-friendly fallback
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { systemLogger } from '../lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    systemLogger.error('Fatal UI Error Caught', { error, errorInfo });
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyError = () => {
    const { error, errorInfo } = this.state;
    const errorText = `
ChessChat Error Report
======================
Time: ${new Date().toISOString()}
URL: ${window.location.href}
User Agent: ${navigator.userAgent}

Error: ${error?.message}
Stack: ${error?.stack}

Component Stack: ${errorInfo?.componentStack}
    `.trim();

    navigator.clipboard.writeText(errorText).then(() => {
      alert('Error details copied to clipboard. Please report this issue.');
    }).catch(() => {
      prompt('Copy this error report:', errorText);
    });
  };

  render() {
    if (this.state.hasError) {
      // Allow custom fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default friendly error UI
      return (
        <div style={{
          minHeight: '100vh',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
          color: '#fff',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤖💥</div>
          <h1 style={{ color: '#ff4444', marginBottom: '1rem', fontSize: '2rem' }}>
            Oops! Wall-E Encountered an Error
          </h1>
          <p style={{ marginBottom: '2rem', maxWidth: '600px', lineHeight: '1.6', fontSize: '1.1rem' }}>
            Something unexpected happened and Wall-E couldn't continue. Don't worry, your chess games are still safe!
          </p>
          
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              🔄 Reload Wall-E
            </button>
            
            <button
              onClick={this.handleCopyError}
              style={{
                padding: '12px 24px',
                background: 'rgba(59, 130, 246, 0.2)',
                color: '#93c5fd',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '16px',
              }}
            >
              📋 Copy Error Details
            </button>
          </div>

          {import.meta.env.DEV && this.state.error && (
            <details style={{
              marginTop: '2rem',
              maxWidth: '800px',
              textAlign: 'left',
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '1rem',
              borderRadius: '8px',
              fontSize: '0.9rem',
            }}>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                Technical Details (Development Mode)
              </summary>
              <pre style={{ 
                background: '#222', 
                padding: '1rem', 
                borderRadius: '4px',
                fontSize: '0.8rem',
                textAlign: 'left',
                overflow: 'auto'
              }}>
                {this.state.error.message}
                {this.state.error.stack && '\n\n' + this.state.error.stack}
              </pre>
            </details>
          )}
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
            style={{
              background: '#fff',
              color: '#333',
              border: 'none',
              padding: '12px 24px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              marginTop: '1rem'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}