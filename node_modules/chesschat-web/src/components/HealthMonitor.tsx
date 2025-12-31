import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import '../styles/HealthMonitor.css';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    apiKey: boolean;
    openAIConnectivity?: boolean;
  };
  circuitBreakers: {
    chessMove: {
      state: string;
      failures: number;
      lastFailureTime: number | null;
    };
    chat: {
      state: string;
      failures: number;
      lastFailureTime: number | null;
    };
  };
  recommendations?: string[];
}

export function HealthMonitor() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await api.health.get();
      
      setHealth(data);
      setLastCheck(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealth();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'degraded':
        return '⚠️';
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  const getCircuitBreakerIcon = (state: string) => {
    if (state.includes('CLOSED')) return '🟢';
    if (state.includes('HALF_OPEN')) return '🟡';
    if (state.includes('OPEN')) return '🔴';
    return '⚪';
  };

  if (loading && !health) {
    return (
      <div className="health-monitor">
        <div className="health-loading">Loading health status...</div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="health-monitor">
        <div className="health-error">
          ❌ {error}
          <button onClick={fetchHealth}>Retry</button>
        </div>
      </div>
    );
  }

  if (!health) return null;

  return (
    <div className={`health-monitor health-${health.status}`}>
      <div className="health-header">
        <h3>
          {getStatusIcon(health.status)} Service Health
        </h3>
        <div className="health-controls">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <button onClick={fetchHealth} disabled={loading}>
            {loading ? '↻' : '🔄'} Refresh
          </button>
        </div>
      </div>

      <div className="health-status">
        <div className="status-badge" data-status={health.status}>
          {health.status.toUpperCase()}
        </div>
        {lastCheck && (
          <div className="last-check">
            Last checked: {lastCheck.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="health-metrics">
        <div className="metric">
          <span className="metric-label">Uptime</span>
          <span className="metric-value">{formatUptime(health.uptime)}</span>
        </div>
        <div className="metric">
          <span className="metric-label">API Key</span>
          <span className="metric-value">
            {health.checks.apiKey ? '✅ Configured' : '❌ Missing'}
          </span>
        </div>
        {health.checks.openAIConnectivity !== undefined && (
          <div className="metric">
            <span className="metric-label">OpenAI</span>
            <span className="metric-value">
              {health.checks.openAIConnectivity ? '✅ Connected' : '❌ Failed'}
            </span>
          </div>
        )}
      </div>

      <div className="circuit-breakers">
        <h4>Circuit Breakers</h4>
        <div className="breaker-grid">
          <div className="breaker">
            <span className="breaker-name">Chess Move</span>
            <span className="breaker-state">
              {getCircuitBreakerIcon(health.circuitBreakers.chessMove.state)}
              {health.circuitBreakers.chessMove.state}
            </span>
            {health.circuitBreakers.chessMove.failures > 0 && (
              <span className="breaker-failures">
                {health.circuitBreakers.chessMove.failures} failures
              </span>
            )}
          </div>
          <div className="breaker">
            <span className="breaker-name">Chat</span>
            <span className="breaker-state">
              {getCircuitBreakerIcon(health.circuitBreakers.chat.state)}
              {health.circuitBreakers.chat.state}
            </span>
            {health.circuitBreakers.chat.failures > 0 && (
              <span className="breaker-failures">
                {health.circuitBreakers.chat.failures} failures
              </span>
            )}
          </div>
        </div>
      </div>

      {health.recommendations && health.recommendations.length > 0 && (
        <div className="health-recommendations">
          <h4>⚠️ Recommendations</h4>
          <ul>
            {health.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="health-footer">
        <small>
          Timestamp: {new Date(health.timestamp).toLocaleString()}
        </small>
      </div>
    </div>
  );
}
