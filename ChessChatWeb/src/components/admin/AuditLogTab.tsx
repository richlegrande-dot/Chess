/**
 * Audit Log Tab
 * 
 * Displays audit log with pagination
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAdminStore } from '../../store/adminStore';
import './AuditLogTab.css';

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeJson: string | null;
  afterJson: string | null;
  createdAt: string;
}

export const AuditLogTab: React.FC = () => {
  const { token } = useAdminStore();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await api.admin.knowledge.getAuditLog(token, page, 50);
      setLogs(data.logs);
      setTotal(data.total);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token, page]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return <div className="loading">Loading audit log...</div>;
  }

  return (
    <div className="audit-log-tab">
      <div className="audit-header">
        <h2>Audit Log</h2>
        <div className="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            Previous
          </button>
          <span>Page {page} (Total: {total} entries)</span>
          <button onClick={() => setPage(p => p + 1)} disabled={logs.length < 50}>
            Next
          </button>
        </div>
      </div>

      <div className="audit-list">
        {logs.map((entry) => (
          <div key={entry.id} className="audit-entry">
            <div className="audit-summary" onClick={() => toggleExpand(entry.id)}>
              <span className="audit-time">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
              <span className={`audit-action action-${entry.action.toLowerCase()}`}>
                {entry.action}
              </span>
              <span className="audit-entity">
                {entry.entityType} ({entry.entityId.slice(0, 8)}...)
              </span>
              <span className="audit-actor">by {entry.actor}</span>
              <span className="expand-icon">{expandedId === entry.id ? '▼' : '▶'}</span>
            </div>

            {expandedId === entry.id && (
              <div className="audit-details">
                {entry.beforeJson && (
                  <div className="audit-json">
                    <h4>Before:</h4>
                    <pre>{JSON.stringify(JSON.parse(entry.beforeJson), null, 2)}</pre>
                  </div>
                )}
                {entry.afterJson && (
                  <div className="audit-json">
                    <h4>After:</h4>
                    <pre>{JSON.stringify(JSON.parse(entry.afterJson), null, 2)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
