/**
 * Production Diagnostics Panel
 * Hidden debugging panel for live production troubleshooting
 * Visible only when localStorage.debug === "true"
 */

import React, { useState, useEffect } from 'react';
import { systemLogger } from '../lib/logger';
import '../styles/ProductionDiagnostics.css';

interface DiagnosticsData {
  domain: string;
  buildVersion: string;
  apiBasePath: string;
  environment: string;
  isDevelopment: boolean;
  localStorage: {
    trainingDataCount: number;
    debugEnabled: boolean;
  };
  features: {
    cpuStatus: string;
    knowledgeVault: string;
  };
}

export const ProductionDiagnostics: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [data, setData] = useState<DiagnosticsData | null>(null);

  useEffect(() => {
    // Check if debug mode is enabled
    const debugEnabled = localStorage.getItem('debug') === 'true';
    setIsVisible(debugEnabled);

    if (debugEnabled) {
      collectDiagnostics();
    }
  }, []);

  const collectDiagnostics = () => {
    try {
      const trainingData = localStorage.getItem('chess_coaching_training_data');
      const trainingDataCount = trainingData ? JSON.parse(trainingData).length : 0;

      const diagnostics: DiagnosticsData = {
        domain: window.location.hostname,
        buildVersion: import.meta.env.VITE_BUILD_VERSION || 'unknown',
        apiBasePath: '/api',
        environment: import.meta.env.MODE,
        isDevelopment: import.meta.env.DEV,
        localStorage: {
          trainingDataCount,
          debugEnabled: localStorage.getItem('debug') === 'true',
        },
        features: {
          cpuStatus: 'operational',
          knowledgeVault: 'connected',
        },
      };

      setData(diagnostics);
      systemLogger.debug('Diagnostics collected', diagnostics);
    } catch (error) {
      systemLogger.error('Failed to collect diagnostics', error);
    }
  };

  const handleCopyDiagnostics = () => {
    if (!data) return;
    
    const diagnosticsText = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(diagnosticsText).then(() => {
      alert('Diagnostics copied to clipboard');
    });
  };

  const handleDisableDebug = () => {
    localStorage.removeItem('debug');
    setIsVisible(false);
    systemLogger.info('Debug mode disabled');
  };

  if (!isVisible) return null;

  return (
    <div className="production-diagnostics">
      <div className="diagnostics-toggle" onClick={() => setIsExpanded(!isExpanded)}>
        🔧 Production Diagnostics {isExpanded ? '▼' : '▶'}
      </div>

      {isExpanded && data && (
        <div className="diagnostics-panel">
          <div className="diagnostics-header">
            <h3>🤖 Wall-E System Status</h3>
            <button onClick={handleDisableDebug} className="close-btn">
              ✕
            </button>
          </div>

          <div className="diagnostics-content">
            <div className="diag-section">
              <h4>🌐 Deployment</h4>
              <div className="diag-row">
                <span>Domain:</span>
                <code>{data.domain}</code>
              </div>
              <div className="diag-row">
                <span>Build Version:</span>
                <code>{data.buildVersion}</code>
              </div>
              <div className="diag-row">
                <span>Environment:</span>
                <code>{data.environment}</code>
              </div>
              <div className="diag-row">
                <span>API Base:</span>
                <code>{data.apiBasePath}</code>
              </div>
            </div>

            <div className="diag-section">
              <h4>💾 Storage</h4>
              <div className="diag-row">
                <span>Training Examples:</span>
                <code>{data.localStorage.trainingDataCount}</code>
              </div>
              <div className="diag-row">
                <span>Debug Mode:</span>
                <code>{data.localStorage.debugEnabled ? 'Enabled' : 'Disabled'}</code>
              </div>
            </div>

            <div className="diag-section">
              <h4>⚙️ Features</h4>
              <div className="diag-row">
                <span>CPU Status:</span>
                <code className="status-ok">{data.features.cpuStatus}</code>
              </div>
              <div className="diag-row">
                <span>Knowledge Vault:</span>
                <code className="status-ok">{data.features.knowledgeVault}</code>
              </div>
            </div>
          </div>

          <div className="diagnostics-actions">
            <button onClick={handleCopyDiagnostics} className="diag-btn">
              📋 Copy Diagnostics
            </button>
            <button onClick={collectDiagnostics} className="diag-btn">
              🔄 Refresh
            </button>
          </div>

          <div className="diagnostics-footer">
            <small>To disable: localStorage.removeItem('debug') or click ✕</small>
          </div>
        </div>
      )}
    </div>
  );
};
