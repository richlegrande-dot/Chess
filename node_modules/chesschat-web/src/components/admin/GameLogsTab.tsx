/**
 * Game Logs Tab for Admin Portal
 * 
 * Displays persistent logs from the current game session.
 * Shows logs even after page crashes or reloads.
 */

import React, { useState, useEffect } from 'react';
import { persistentLogger, GameSessionLog } from '../../utils/persistentLogger';
import './GameLogsTab.css';

export const GameLogsTab: React.FC = () => {
  const [session, setSession] = useState<GameSessionLog | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSession();

    if (autoRefresh) {
      const interval = setInterval(loadSession, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [session, autoScroll]);

  const loadSession = () => {
    const currentSession = persistentLogger.getCurrentSession();
    setSession(currentSession);
  };

  const handleExport = () => {
    const text = persistentLogger.getLogsAsText();
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chesschat-logs-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all logs? This cannot be undone.')) {
      persistentLogger.clearLogs();
      loadSession();
    }
  };

  const handleCopyToClipboard = () => {
    const text = persistentLogger.getLogsAsText();
    navigator.clipboard.writeText(text).then(() => {
      alert('Logs copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy logs:', err);
      alert('Failed to copy logs to clipboard');
    });
  };

  if (!session) {
    return (
      <div className="game-logs-tab">
        <div className="logs-empty">
          <h3>No Game Session Active</h3>
          <p>Start a game in Coaching Mode to see logs here.</p>
          <p>Logs are automatically saved to localStorage and will persist even if the page crashes.</p>
        </div>
      </div>
    );
  }

  const stats = persistentLogger.getSessionStats();
  let filteredLogs = filter === 'all' 
    ? session.logs 
    : session.logs.filter(log => log.level === filter);
  
  // Apply search filter
  if (searchTerm) {
    const search = searchTerm.toLowerCase();
    filteredLogs = filteredLogs.filter(log => 
      log.message.toLowerCase().includes(search) ||
      JSON.stringify(log.data || {}).toLowerCase().includes(search)
    );
  }

  return (
    <div className="game-logs-tab">
      <div className="logs-header">
        <div className="logs-info">
          <h2>🎮 Game Session Logs</h2>
          <div className="session-info">
            <span className="info-item">
              <strong>Session:</strong> {session.sessionId}
            </span>
            <span className="info-item">
              <strong>Started:</strong> {new Date(session.startTime).toLocaleString()}
            </span>
            <span className="info-item">
              <strong>Mode:</strong> {session.gameMode}
            </span>
            {session.cpuLevel && (
              <span className="info-item">
                <strong>CPU Level:</strong> {session.cpuLevel}/8
              </span>
            )}
          </div>
        </div>

        <div className="logs-actions">
          <label className="auto-refresh-toggle">
            <input 
              type="checkbox" 
              checked={autoRefresh} 
              onChange={e => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh
          </label>
          <label className="auto-refresh-toggle">
            <input 
              type="checkbox" 
              checked={autoScroll} 
              onChange={e => setAutoScroll(e.target.checked)}
            />
            Auto-scroll
          </label>
          <button onClick={loadSession} className="btn-refresh">
            🔄 Refresh
          </button>
          <button onClick={handleCopyToClipboard} className="btn-copy">
            📋 Copy All
          </button>
          <button onClick={handleExport} className="btn-export">
            💾 Export
          </button>
          <button onClick={handleClear} className="btn-clear">
            🗑️ Clear
          </button>
        </div>
      </div>

      {stats && (
        <div className="logs-stats">
          <div className="stat-card">
            <div className="stat-value">{stats.totalLogs}</div>
            <div className="stat-label">Total Logs</div>
          </div>
          <div className="stat-card error">
            <div className="stat-value">{stats.errors}</div>
            <div className="stat-label">Errors</div>
          </div>
          <div className="stat-card warning">
            <div className="stat-value">{stats.warnings}</div>
            <div className="stat-label">Warnings</div>
          </div>
          <div className="stat-card info">
            <div className="stat-value">{stats.info}</div>
            <div className="stat-label">Info</div>
          </div>
          <div className="stat-card debug">
            <div className="stat-value">{stats.debug}</div>
            <div className="stat-label">Debug</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.floor(stats.duration / 1000)}s</div>
            <div className="stat-label">Duration</div>
          </div>
        </div>
      )}

      <div className="logs-controls">
        <div className="search-box">
          <input 
            type="text"
            placeholder="🔍 Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          {searchTerm && (
            <button 
              className="clear-search"
              onClick={() => setSearchTerm('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="logs-filter">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All ({session.logs.length})
          </button>
        <button 
          className={filter === 'error' ? 'active error' : ''} 
          onClick={() => setFilter('error')}
        >
          Errors ({session.logs.filter(l => l.level === 'error').length})
        </button>
        <button 
          className={filter === 'warn' ? 'active warning' : ''} 
          onClick={() => setFilter('warn')}
        >
          Warnings ({session.logs.filter(l => l.level === 'warn').length})
        </button>
        <button 
          className={filter === 'info' ? 'active info' : ''} 
          onClick={() => setFilter('info')}
        >
          Info ({session.logs.filter(l => l.level === 'info').length})
        </button>
        <button 
          className={filter === 'debug' ? 'active debug' : ''} 
          onClick={() => setFilter('debug')}
        >
          Debug ({session.logs.filter(l => l.level === 'debug').length})
        </button>
        </div>
      </div>

      <div className="logs-container" ref={logsContainerRef}>
        {filteredLogs.length === 0 ? (
          <div className="logs-empty-filter">
            {searchTerm ? (
              <>No logs matching "{searchTerm}"</>
            ) : (
              <>No {filter !== 'all' ? filter : ''} logs found</>
            )}
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const isHighlighted = log.message.toLowerCase().includes('cpu move') || 
                                  log.message.toLowerCase().includes('error') ||
                                  log.message.toLowerCase().includes('freeze') ||
                                  log.message.toLowerCase().includes('hang');
            const time = new Date(log.timestamp);
            const timeStr = time.toLocaleTimeString('en-US', { 
              hour12: false, 
              hour: '2-digit', 
              minute: '2-digit', 
              second: '2-digit' 
            }) + '.' + time.getMilliseconds().toString().padStart(3, '0');
            
            return (
              <div key={index} className={`log-entry log-${log.level} ${isHighlighted ? 'highlighted' : ''}`}>
                <span className="log-time" title={time.toISOString()}>
                  {timeStr}
                </span>
                <span className={`log-level log-level-${log.level}`}>
                  {log.level.toUpperCase()}
                </span>
                <span className="log-message">{log.message}</span>
                <button 
                  className="copy-log-btn"
                  onClick={() => {
                    const text = `[${timeStr}] [${log.level.toUpperCase()}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`;
                    navigator.clipboard.writeText(text);
                  }}
                  title="Copy this log entry"
                >
                  📋
                </button>
                {log.data && (
                  <details className="log-data">
                    <summary>View Data</summary>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
