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

  if (!health) {
    return <div className="loading">No health data available...</div>;
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
      <div className={`health-card status-${health.status || 'unknown'}`}>
        <h3>Overall Status</h3>
        <div className="status-badge">
          {health.status === 'healthy' && '✓ Healthy'}
          {health.status === 'degraded' && '⚠ Degraded'}
          {health.status === 'unhealthy' && '✗ Unhealthy'}
        </div>
        <p className="timestamp">
          Last checked: {new Date(health.timestamp).toLocaleString()}
        </p>
        <p className="version">Version: {health.version || 'Unknown'}</p>
        <p className="environment">Environment: {health.environment || 'Unknown'}</p>
      </div>

      {/* Database Health */}
      {health.database && (
        <div className="health-card">
          <h3>Database Health</h3>
          <div className="health-details">
            <div className="detail-row">
              <span>Status:</span>
              <span className={health.database.dbReady ? 'text-success' : 'text-error'}>
                {health.database.dbReady ? '✓ Connected' : '✗ Disconnected'}
              </span>
            </div>
            {health.database.error && (
              <div className="detail-row">
                <span>Error:</span>
                <span className="text-error">{health.database.error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Learning System */}
      {health.learning && (
        <div className="health-card">
          <h3>Learning System</h3>
          <div className="health-details">
            <div className="detail-row">
              <span>V3 Enabled:</span>
              <span className={health.learning.v3Enabled ? 'text-success' : 'text-warning'}>
                {health.learning.v3Enabled ? '✓ Active' : '○ Disabled'}
              </span>
            </div>
            <div className="detail-row">
              <span>Smart Sampling (V3.1):</span>
              <span className={health.learning.v31SmartSampling ? 'text-success' : 'text-warning'}>
                {health.learning.v31SmartSampling ? '✓ Active' : '○ Disabled'}
              </span>
            </div>
            <div className="detail-row">
              <span>Cache Enabled (V3.1):</span>
              <span className={health.learning.v31CacheEnabled ? 'text-success' : 'text-warning'}>
                {health.learning.v31CacheEnabled ? '✓ Active' : '○ Disabled'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
