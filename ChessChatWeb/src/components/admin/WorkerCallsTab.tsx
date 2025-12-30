/**
 * Worker Calls Tab - Admin Portal
 * 
 * Displays worker service binding call logs from persistent KV storage
 */

import React, { useState, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';

interface WorkerCallLog {
  timestamp: number;
  endpoint: string;
  method: string;
  success: boolean;
  latencyMs: number;
  error?: string;
  request?: any;
  response?: any;
}

interface WorkerCallsResponse {
  success: boolean;
  totalCalls: number;
  successRate: number;
  avgLatency: number;
  successfulCalls: number;
  failedCalls: number;
  calls: WorkerCallLog[];
  errorPatterns: Record<string, number>;
  lastUpdated: number;
}

export const WorkerCallsTab: React.FC = () => {
  const { debugInfo } = useGameStore();
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [persistentLogs, setPersistentLogs] = useState<WorkerCallsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'memory'>('memory');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Fetch logs from persistent API
  useEffect(() => {
    const fetchPersistentLogs = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Call new Worker API endpoint (no auth required for read)
        const response = await fetch('/api/admin/worker-calls?limit=100');

        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.logs) {
            // Transform Worker API response to match expected format
            const transformedData: WorkerCallsResponse = {
              success: true,
              totalCalls: data.count || data.logs.length,
              successRate: calculateSuccessRate(data.logs),
              avgLatency: calculateAvgLatency(data.logs),
              successfulCalls: data.logs.filter((l: any) => l.success).length,
              failedCalls: data.logs.filter((l: any) => !l.success).length,
              calls: data.logs.map((log: any) => ({
                timestamp: new Date(log.ts).getTime(),
                endpoint: log.endpoint,
                method: log.method,
                success: log.success,
                latencyMs: log.latencyMs,
                error: log.error,
                request: log.requestJson,
                response: log.responseJson,
              })),
              errorPatterns: calculateErrorPatterns(data.logs),
              lastUpdated: Date.now(),
            };
            
            setPersistentLogs(transformedData);
            setDataSource('api');
            console.log('[WorkerCalls] Loaded', transformedData.totalCalls, 'logs from Worker API');
          } else {
            throw new Error('Invalid response format');
          }
        } else {
          const errorText = await response.text();
          console.error('[WorkerCalls] API error:', response.status, errorText);
          setError(`API returned ${response.status}: ${errorText}`);
          setDataSource('memory');
        }
      } catch (err) {
        console.error('[WorkerCalls] Fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setDataSource('memory');
      } finally {
        setLoading(false);
      }
    };

    fetchPersistentLogs();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPersistentLogs, 30000);
    return () => clearInterval(interval);
  }, []);
  
  // Helper functions for data transformation
  const calculateSuccessRate = (logs: any[]): number => {
    if (logs.length === 0) return 0;
    const successful = logs.filter(l => l.success).length;
    return (successful / logs.length) * 100;
  };
  
  const calculateAvgLatency = (logs: any[]): number => {
    if (logs.length === 0) return 0;
    const total = logs.reduce((sum, l) => sum + (l.latencyMs || 0), 0);
    return Math.round(total / logs.length);
  };
  
  const calculateErrorPatterns = (logs: any[]): Record<string, number> => {
    return logs.filter(l => !l.success).reduce((acc, log) => {
      const errorType = log.error?.includes('timeout') ? 'timeout' :
                       log.error?.includes('404') ? '404-not-found' :
                       log.error?.includes('500') ? '500-server-error' :
                       log.error?.includes('binding') ? 'binding-issue' :
                       'other';
      acc[errorType] = (acc[errorType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  };

  // Use persistent logs if available, otherwise fall back to in-memory
  const workerCalls = dataSource === 'api' && persistentLogs 
    ? persistentLogs.calls 
    : (debugInfo.workerCalls || []);
    
  const successfulCalls = dataSource === 'api' && persistentLogs
    ? persistentLogs.successfulCalls
    : workerCalls.filter(c => c.success).length;
    
  const failedCalls = dataSource === 'api' && persistentLogs
    ? persistentLogs.failedCalls
    : workerCalls.filter(c => !c.success).length;
    
  const successRate = dataSource === 'api' && persistentLogs
    ? persistentLogs.successRate
    : (workerCalls.length > 0 ? (successfulCalls / workerCalls.length) * 100 : 0);

  // Analyze common error patterns
  const errorPatterns = dataSource === 'api' && persistentLogs
    ? persistentLogs.errorPatterns
    : workerCalls.filter(c => !c.success).reduce((acc, call) => {
        const errorType = call.error?.includes('timeout') ? 'timeout' :
                         call.error?.includes('404') ? '404-not-found' :
                         call.error?.includes('500') ? '500-server-error' :
                         call.error?.includes('binding') ? 'binding-issue' :
                         'other';
        acc[errorType] = (acc[errorType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

  return (
    <div className="worker-calls-tab">
      <div className="tab-header">
        <h2>🔗 Worker API Call Logs</h2>
        <p className="tab-description">
          Displays all Worker API calls stored in Prisma-backed database (single Worker deployment).
        </p>
        <div className="data-source-indicator">
          {loading ? (
            <span className="loading">⏳ Loading logs...</span>
          ) : error ? (
            <span className="error">⚠️ API Error: {error} (showing in-memory logs)</span>
          ) : dataSource === 'api' ? (
            <span className="success">✓ Showing persistent logs from Prisma database</span>
          ) : (
            <span className="warning">⚠️ Showing in-memory logs only (Database not available)</span>
          )}
          <button 
            className="refresh-btn"
            onClick={() => window.location.reload()}
            style={{ marginLeft: '1rem', padding: '0.5rem 1rem' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Diagnostic Panel */}
      <div className="diagnostic-panel">
        <button 
          className="diagnostic-toggle"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
        >
          🔍 {showDiagnostics ? 'Hide' : 'Show'} Frontend Diagnostics
        </button>
        
        {showDiagnostics && (
          <div className="diagnostic-content">
            <h4>Frontend Storage Status</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              <li>📊 In-Memory Worker Calls: <strong>{debugInfo.workerCalls?.length || 0}</strong></li>
              <li>💾 Debug Info Exists: <strong>{debugInfo ? '✓ Yes' : '✗ No'}</strong></li>
              <li>🔧 Console Commands Available: <strong>window.chessChatDiagnostics</strong></li>
            </ul>
            <p style={{ fontSize: '0.9rem', opacity: 0.8, marginTop: '1rem' }}>
              💡 <strong>Tip:</strong> Open DevTools Console and run:
              <br />
              <code style={{ background: '#000', padding: '0.25rem 0.5rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.5rem' }}>
                window.chessChatDiagnostics.help()
              </code>
            </p>
          </div>
        )}
      </div>

      {/* Service Binding Status */}
      <div className="binding-status-card">
        <h3>📊 Worker API Status</h3>
        <div className="status-indicators">
          <div className="status-item">
            <span className="label">Data Source:</span>
            <span className={`value ${dataSource === 'api' ? 'success' : 'warning'}`}>
              {dataSource === 'api' ? '📦 Prisma Database' : '💾 In-Memory Only'}
            </span>
          </div>
          <div className="status-item">
            <span className="label">Worker Active:</span>
            <span className={`value ${successfulCalls > 0 ? 'success' : 'warning'}`}>
              {successfulCalls > 0 ? '✓ Working' : '⚠️ No successful calls'}
            </span>
          </div>
          <div className="status-item">
            <span className="label">Success Rate:</span>
            <span className={`value ${successRate >= 70 ? 'success' : successRate >= 30 ? 'warning' : 'error'}`}>
              {workerCalls.length > 0 ? `${successRate.toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <div className="status-item">
            <span className="label">Configuration:</span>
            <span className="value info">
              Dashboard → Pages → Settings → Functions → Bindings
            </span>
          </div>
        </div>

        {successRate < 70 && workerCalls.length > 0 && (
          <div className="warning-banner">
            ⚠️ <strong>Low Success Rate Detected:</strong> {successRate.toFixed(1)}% success rate indicates configuration issues.
            <button 
              className="troubleshoot-btn"
              onClick={() => setShowTroubleshooting(!showTroubleshooting)}
            >
              {showTroubleshooting ? 'Hide' : 'Show'} Troubleshooting Guide
            </button>
          </div>
        )}

        {showTroubleshooting && (
          <div className="troubleshooting-section">
            <h4>🔧 Troubleshooting Steps</h4>
            
            {Object.entries(errorPatterns).map(([type, count]) => (
              <div key={type} className="error-pattern">
                <strong>{type}:</strong> {count} occurrence(s)
                {type === 'timeout' && (
                  <div className="fix-hint">
                    💡 <strong>Fix:</strong> Worker is too slow. Check worker logs and consider:
                    <ul>
                      <li>Reducing search depth in worker</li>
                      <li>Increasing timeout in Pages Function (currently 15s)</li>
                      <li>Optimizing chess engine code</li>
                    </ul>
                  </div>
                )}
                {type === '404-not-found' && (
                  <div className="fix-hint">
                    💡 <strong>Fix:</strong> Worker endpoint not found. Verify:
                    <ul>
                      <li>Worker is deployed: <code>walle-assistant-production</code></li>
                      <li>Worker has <code>/assist/chess-move</code> route</li>
                      <li>Service binding configured correctly</li>
                    </ul>
                  </div>
                )}
                {type === 'binding-issue' && (
                  <div className="fix-hint">
                    💡 <strong>Fix:</strong> Service binding misconfigured. Check:
                    <ul>
                      <li>Dashboard → Pages → chesschat-web → Settings → Functions → Bindings</li>
                      <li>Variable name: <code>WALLE_ASSISTANT</code></li>
                      <li>Service: <code>walle-assistant-production</code></li>
                      <li>Environment: Production</li>
                    </ul>
                  </div>
                )}
              </div>
            ))}

            <div className="config-checklist">
              <h5>✅ Configuration Checklist</h5>
              <ul>
                <li>Worker deployed: <code>npx wrangler deploy</code> in worker-assistant/</li>
                <li>Service binding added in Dashboard (NOT in wrangler.toml for Pages)</li>
                <li>Worker route: <code>chesschat.uk/api/chess-move*</code> (specific, not <code>/api/*</code>)</li>
                <li>Pages Function calls worker at <code>https://internal/assist/chess-move</code></li>
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Calls</div>
          <div className="stat-value">{workerCalls.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Success Rate</div>
          <div className="stat-value">
            {workerCalls.length > 0 
              ? `${((workerCalls.filter(c => c.success).length / workerCalls.length) * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Latency</div>
          <div className="stat-value">
            {workerCalls.length > 0
              ? formatLatency(workerCalls.reduce((sum, c) => sum + c.latencyMs, 0) / workerCalls.length)
              : 'N/A'}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Failed Calls</div>
          <div className="stat-value error">
            {workerCalls.filter(c => !c.success).length}
          </div>
        </div>
      </div>

      <div className="calls-list">
        {workerCalls.length === 0 ? (
          <div className="empty-state">
            <p>No worker calls recorded yet.</p>
            <p className="empty-hint">Make a move or use chat to see worker calls appear here.</p>
          </div>
        ) : (
          <div className="calls-table">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Method</th>
                  <th>Latency</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {workerCalls.slice().reverse().map((call, idx) => (
                  <tr key={idx} className={call.success ? 'success-row' : 'error-row'}>
                    <td>
                      <span className={`status-badge ${call.success ? 'success' : 'error'}`}>
                        {call.success ? '✓' : '✗'}
                      </span>
                    </td>
                    <td className="time-cell">{formatTime(call.timestamp)}</td>
                    <td className="endpoint-cell">
                      <code>{call.endpoint}</code>
                    </td>
                    <td>
                      <span className="method-badge">{call.method}</span>
                    </td>
                    <td className="latency-cell">
                      <span className={call.latencyMs > 5000 ? 'slow' : ''}>
                        {formatLatency(call.latencyMs)}
                      </span>
                    </td>
                    <td className="details-cell">
                      {call.error && (
                        <div className="error-detail">❌ {call.error}</div>
                      )}
                      {call.response?.move && (
                        <div className="move-detail">♟️ Move: {call.response.move}</div>
                      )}
                      {call.response?.depthReached && (
                        <div className="depth-detail">🎯 Depth: {call.response.depthReached}</div>
                      )}
                      {call.response?.evaluation !== undefined && (
                        <div className="eval-detail">
                          📊 Eval: {(call.response.evaluation / 100).toFixed(2)}
                        </div>
                      )}
                      {call.request && (
                        <details className="request-details">
                          <summary>Request Data</summary>
                          <pre>{JSON.stringify(call.request, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style jsx>{`
        .worker-calls-tab {
          padding: 1.5rem;
          max-width: 1400px;
        }

        .tab-header {
          margin-bottom: 1.5rem;
        }

        .tab-header h2 {
          margin: 0 0 0.5rem 0;
          color: #1e293b;
        }

        .tab-description {
          color: #64748b;
          margin: 0;
        }

        /* Service Binding Status Card */
        .binding-status-card {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .binding-status-card h3 {
          margin: 0 0 1rem 0;
          font-size: 1.25rem;
        }

        .status-indicators {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .status-item {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-item .label {
          font-weight: 500;
          opacity: 0.9;
        }

        .status-item .value {
          font-weight: bold;
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
        }

        .status-item .value.success {
          background: rgba(34, 197, 94, 0.3);
        }

        .status-item .value.warning {
          background: rgba(251, 191, 36, 0.3);
        }

        .status-item .value.error {
          background: rgba(239, 68, 68, 0.3);
        }

        .status-item .value.info {
          font-size: 0.875rem;
          background: rgba(255, 255, 255, 0.1);
          font-family: monospace;
        }

        .warning-banner {
          background: rgba(251, 191, 36, 0.2);
          border: 2px solid rgba(251, 191, 36, 0.5);
          border-radius: 8px;
          padding: 1rem;
          margin-top: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .troubleshoot-btn {
          margin-left: auto;
          background: rgba(255, 255, 255, 0.9);
          color: #764ba2;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .troubleshoot-btn:hover {
          background: white;
          transform: translateY(-1px);
        }

        .troubleshooting-section {
          background: rgba(255, 255, 255, 0.95);
          color: #1e293b;
          border-radius: 8px;
          padding: 1.5rem;
          margin-top: 1rem;
        }

        .troubleshooting-section h4 {
          margin: 0 0 1rem 0;
          color: #1e293b;
        }

        .troubleshooting-section h5 {
          margin: 1.5rem 0 0.5rem 0;
          color: #475569;
        }

        .error-pattern {
          background: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 1rem;
          margin-bottom: 1rem;
          border-radius: 4px;
        }

        .fix-hint {
          margin-top: 0.5rem;
          padding: 0.75rem;
          background: #fffbeb;
          border-left: 3px solid #fbbf24;
          border-radius: 4px;
          font-size: 0.875rem;
        }

        .fix-hint ul {
          margin: 0.5rem 0 0 1.5rem;
          padding: 0;
        }

        .fix-hint li {
          margin: 0.25rem 0;
        }

        .fix-hint code {
          background: rgba(0, 0, 0, 0.05);
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 0.85em;
        }

        .config-checklist {
          background: #f0fdf4;
          border-radius: 6px;
          padding: 1rem;
        }

        .config-checklist ul {
          margin: 0.5rem 0 0 1.5rem;
          padding: 0;
        }

        .config-checklist li {
          margin: 0.5rem 0;
        }

        .config-checklist code {
          background: rgba(0, 0, 0, 0.05);
          padding: 0.125rem 0.375rem;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .stat-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 1rem;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 0.5rem;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1e293b;
        }

        .stat-value.error {
          color: #ef4444;
        }

        .calls-list {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }

        .empty-state {
          padding: 3rem;
          text-align: center;
          color: #64748b;
        }

        .empty-hint {
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .calls-table {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        thead {
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
        }

        th {
          padding: 0.75rem;
          text-align: left;
          font-size: 0.875rem;
          font-weight: 600;
          color: #475569;
        }

        tbody tr {
          border-bottom: 1px solid #e2e8f0;
        }

        tbody tr:hover {
          background: #f8fafc;
        }

        td {
          padding: 0.75rem;
          font-size: 0.875rem;
        }

        .success-row {
          background: rgba(34, 197, 94, 0.02);
        }

        .error-row {
          background: rgba(239, 68, 68, 0.02);
        }

        .status-badge {
          display: inline-block;
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .status-badge.success {
          background: #dcfce7;
          color: #166534;
        }

        .status-badge.error {
          background: #fee2e2;
          color: #991b1b;
        }

        .time-cell {
          color: #64748b;
          font-size: 0.8rem;
          white-space: nowrap;
        }

        .endpoint-cell code {
          background: #f1f5f9;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.8rem;
          color: #3b82f6;
        }

        .method-badge {
          background: #dbeafe;
          color: #1e40af;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .latency-cell span {
          color: #22c55e;
        }

        .latency-cell span.slow {
          color: #ef4444;
          font-weight: 600;
        }

        .details-cell {
          font-size: 0.8rem;
        }

        .error-detail {
          color: #dc2626;
          margin-bottom: 0.25rem;
        }

        .move-detail,
        .depth-detail,
        .eval-detail {
          color: #475569;
          margin-bottom: 0.25rem;
        }

        .request-details {
          margin-top: 0.5rem;
        }

        .request-details summary {
          cursor: pointer;
          color: #3b82f6;
          font-size: 0.75rem;
        }

        .request-details pre {
          background: #f1f5f9;
          padding: 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          overflow-x: auto;
          margin-top: 0.5rem;
        }
      `}</style>
    </div>
  );
};
