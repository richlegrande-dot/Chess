/**
 * Admin Unlock Modal
 * 
 * Features:
 * - Password input
 * - Run Diagnostics button
 * - Distinguishes 401 (wrong password) vs 503 (backend down) vs network error
 */

import React, { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { useAdminStore } from '../../store/adminStore';
import './AdminUnlockModal.css';

interface Props {
  onUnlocked: () => void;
}

interface DiagnosticsResult {
  live?: any;
  db?: any;
  status?: any;
  error?: string;
}

export const AdminUnlockModal: React.FC<Props> = ({ onUnlocked }) => {
  const { setSession } = useAdminStore();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResult | null>(null);
  const [runningDiagnostics, setRunningDiagnostics] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await api.admin.auth.unlock(password);
      setSession(response.token, response.expiresAt);
      onUnlocked();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 401) {
          setError('❌ Wrong password. Please try again.');
        } else if (err.statusCode === 503) {
          setError('⚠️ Backend unavailable. Database may not be ready.');
        } else if (err.isNetworkError) {
          setError('🌐 Network error. Cannot connect to server.');
        } else {
          setError(`Error: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunDiagnostics = async () => {
    setRunningDiagnostics(true);
    setDiagnostics(null);
    setError(null);

    const results: DiagnosticsResult = {};

    try {
      // Test /api/health/live
      try {
        const live = await api.health.get();
        results.live = live;
      } catch (err) {
        results.live = { error: err instanceof Error ? err.message : 'Failed' };
      }

      // Test /api/health with full status
      try {
        const status = await api.health.get();
        results.status = status;
      } catch (err) {
        results.status = { error: err instanceof Error ? err.message : 'Failed' };
      }

      setDiagnostics(results);
    } catch (err) {
      setError('Diagnostics failed to run');
    } finally {
      setRunningDiagnostics(false);
    }
  };

  return (
    <div className="admin-unlock-overlay">
      <div className="admin-unlock-modal">
        <h2>🔐 Admin Portal</h2>
        <p className="subtitle">Enter admin password to continue</p>

        <form onSubmit={handleUnlock}>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            disabled={loading}
            autoFocus
          />

          {error && <div className="error-message">{error}</div>}

          <div className="button-row">
            <button type="submit" disabled={loading || !password}>
              {loading ? 'Unlocking...' : 'Unlock'}
            </button>
            <button
              type="button"
              onClick={handleRunDiagnostics}
              disabled={runningDiagnostics}
              className="diagnostics-button"
            >
              {runningDiagnostics ? 'Running...' : 'Run Diagnostics'}
            </button>
          </div>
        </form>

        {diagnostics && (
          <div className="diagnostics-results">
            <h3>Diagnostics Results</h3>
            
            <div className="diagnostic-item">
              <strong>Health Status:</strong>
              {diagnostics.status?.status === 'healthy' && (
                <span className="status-healthy"> ✓ Healthy</span>
              )}
              {diagnostics.status?.status === 'degraded' && (
                <span className="status-degraded"> ⚠ Degraded</span>
              )}
              {diagnostics.status?.status === 'unhealthy' && (
                <span className="status-unhealthy"> ✗ Unhealthy</span>
              )}
              {diagnostics.status?.error && (
                <span className="status-error"> Error: {diagnostics.status.error}</span>
              )}
            </div>

            {diagnostics.status?.database && (
              <div className="diagnostic-item">
                <strong>Database:</strong>
                {diagnostics.status.database.dbReady ? (
                  <span className="status-healthy">
                    {' '}✓ Ready (latency: {diagnostics.status.database.latencyMs}ms)
                  </span>
                ) : (
                  <span className="status-unhealthy">
                    {' '}✗ Not Ready
                    {diagnostics.status.database.lastError &&
                      ` - ${diagnostics.status.database.lastError}`}
                  </span>
                )}
              </div>
            )}

            {diagnostics.status?.recommendations &&
              diagnostics.status.recommendations.length > 0 && (
                <div className="diagnostic-item">
                  <strong>Recommendations:</strong>
                  <ul>
                    {diagnostics.status.recommendations.map((rec: string, i: number) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
};
