import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            🛑 ChessChat Loading Error
          </h1>
          <p style={{ fontSize: '1.2rem', marginBottom: '2rem', maxWidth: '600px' }}>
            Something went wrong while loading the chess application. This might be due to:
          </p>
          <ul style={{ fontSize: '1rem', marginBottom: '2rem', textAlign: 'left', maxWidth: '400px' }}>
            <li>Browser compatibility issues</li>
            <li>WebGL/3D rendering problems</li>
            <li>Network connectivity</li>
            <li>JavaScript execution errors</li>
          </ul>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: '2px solid white',
              color: 'white',
              padding: '12px 24px',
              borderRadius: '8px',
              fontSize: '1rem',
              cursor: 'pointer',
              marginBottom: '1rem'
            }}
          >
            🔄 Reload ChessChat
          </button>
          
          {this.state.error && (
            <details style={{ marginTop: '2rem', width: '100%', maxWidth: '800px' }}>
              <summary style={{ cursor: 'pointer', marginBottom: '1rem' }}>
                🔍 Debug Information (Development)
              </summary>
              <pre style={{ 
                background: 'rgba(0,0,0,0.3)', 
                padding: '1rem', 
                borderRadius: '8px', 
                fontSize: '0.8rem', 
                textAlign: 'left',
                overflow: 'auto',
                whiteSpace: 'pre-wrap'
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo?.componentStack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}