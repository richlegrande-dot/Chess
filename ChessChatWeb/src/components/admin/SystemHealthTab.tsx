/**
 * System Health Tab
 * 
 * Displays:
 * - Overall health status
 * - Database health
 * - Service checks
 * - Circuit breaker states
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAdminStore } from '../../store/adminStore';
import './SystemHealthTab.css';

export const SystemHealthTab: React.FC = () => {
  const { token } = useAdminStore();
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      const data = await api.health.get();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();

    if (autoRefresh) {
      const interval = setInterval(fetchHealth, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (loading) {
    return <div className="loading">Loading health status...</div>;
  }

  if (error) {
    return (
      <div className="error-panel">
        <h3>❌ Error Loading Health Status</h3>
        <p>{error}</p>
        <button onClick={fetchHealth}>Retry</button>
      </div>
    );
  }

  return (
    <div className="system-health-tab">
      <div className="health-header">
        <h2>System Health</h2>
        <div className="health-controls">
          <label>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (10s)
          </label>
          <button onClick={fetchHealth}>Refresh Now</button>
        </div>
      </div>

      {/* Overall Status */}
      <div className={`health-card status-${health.status}`}>
        <h3>Overall Status</h3>
        <div className="status-badge">
          {health.status === 'healthy' && '✓ Healthy'}
          {health.status === 'degraded' && '⚠ Degraded'}
          {health.status === 'unhealthy' && '✗ Unhealthy'}
        </div>
        <p className="timestamp">
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </p>
        <p className="uptime">Uptime: {Math.floor(health.uptime / 1000)}s</p>
      </div>

      {/* Database Health */}
      {health.database && (
        <div className="health-card">
          <h3>Database Health</h3>
          <div className="health-details">
            <div className="detail-row">
              <span>Status:</span>
              <span className={health.database.dbReady ? 'text-success' : 'text-error'}>
                {health.database.dbReady ? '✓ Ready' : '✗ Not Ready'}
              </span>
            </div>
            <div className="detail-row">
              <span>Last Ping:</span>
              <span>
                {health.database.lastPing
                  ? new Date(health.database.lastPing).toLocaleString()
                  : 'Never'}
              </span>
            </div>
            <div className="detail-row">
              <span>Latency:</span>
              <span>{health.database.latencyMs}ms</span>
            </div>
            <div className="detail-row">
              <span>Failure Count:</span>
              <span className={health.database.failureCount > 0 ? 'text-warning' : ''}>
                {health.database.failureCount}
              </span>
            </div>
            <div className="detail-row">
              <span>Consecutive Failures:</span>
              <span
                className={
                  health.database.consecutiveFailures > 3
                    ? 'text-error'
                    : health.database.consecutiveFailures > 0
                    ? 'text-warning'
                    : ''
                }
              >
                {health.database.consecutiveFailures}
              </span>
            </div>
            {health.database.lastError && (
              <div className="detail-row">
                <span>Last Error:</span>
                <span className="text-error">{health.database.lastError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Checks */}
      <div className="health-card">
        <h3>Service Checks</h3>
        <div className="health-details">
          <div className="detail-row">
            <span>API Key:</span>
            <span className={health.checks.apiKey ? 'text-success' : 'text-warning'}>
              {health.checks.apiKey ? '✓ Configured' : '⚠ Not configured (optional)'}
            </span>
          </div>
          <div className="detail-row">
            <span>Database:</span>
            <span className={health.checks.database ? 'text-success' : 'text-error'}>
              {health.checks.database ? '✓ Connected' : '✗ Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {health.recommendations && health.recommendations.length > 0 && (
        <div className="health-card recommendations">
          <h3>⚠️ Recommendations</h3>
          <ul>
            {health.recommendations.map((rec: string, i: number) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
