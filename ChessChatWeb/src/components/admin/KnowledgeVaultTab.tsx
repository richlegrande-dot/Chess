/**
 * Knowledge Vault Tab
 * 
 * Features:
 * - List sources with chunk counts
 * - Create/edit/delete sources
 * - View/edit chunks
 * - Run diagnostics
 */

import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';
import { useAdminStore } from '../../store/adminStore';
import './KnowledgeVaultTab.css';

interface Source {
  id: string;
  title: string;
  sourceType: string;
  url?: string;
  _count: { chunks: number };
  updatedAt: string;
}

interface Chunk {
  id: string;
  chunkText: string;
  tags: string;
  language?: string;
  createdAt: string;
}

export const KnowledgeVaultTab: React.FC = () => {
  const { token } = useAdminStore();
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateSource, setShowCreateSource] = useState(false);
  const [showCreateChunk, setShowCreateChunk] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [diagnostics, setDiagnostics] = useState<any>(null);

  // Form states
  const [newSource, setNewSource] = useState({ title: '', sourceType: 'DOC', url: '' });
  const [newChunk, setNewChunk] = useState({ chunkText: '', tags: '', language: 'en' });

  const fetchSources = async () => {
    if (!token) {
      console.log('KnowledgeVault: No token available');
      setLoading(false);
      return;
    }
    console.log('KnowledgeVault: Fetching sources with token:', token?.substring(0, 20) + '...');
    try {
      const data = await api.admin.knowledge.getSources(token);
      console.log('KnowledgeVault: Received sources:', data);
      setSources(data.sources);
    } catch (err) {
      console.error('Failed to fetch sources:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChunks = async (sourceId: string) => {
    if (!token) return;
    try {
      const data = await api.admin.knowledge.getChunks(token, sourceId);
      setChunks(data);
    } catch (err) {
      console.error('Failed to fetch chunks:', err);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      await api.admin.knowledge.createSource(token, {
        title: newSource.title,
        sourceType: newSource.sourceType,
        url: newSource.url || undefined,
      });
      setNewSource({ title: '', sourceType: 'DOC', url: '' });
      setShowCreateSource(false);
      fetchSources();
    } catch (err) {
      console.error('Failed to create source:', err);
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!token || !confirm('Delete this source?')) return;

    try {
      await api.admin.knowledge.deleteSource(token, id);
      fetchSources();
      if (selectedSource?.id === id) {
        setSelectedSource(null);
        setChunks([]);
      }
    } catch (err) {
      console.error('Failed to delete source:', err);
    }
  };

  const handleSelectSource = (source: Source) => {
    setSelectedSource(source);
    fetchChunks(source.id);
    setShowCreateChunk(false);
  };

  const handleCreateChunk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !selectedSource) return;

    try {
      const tags = newChunk.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.admin.knowledge.createChunk(token, selectedSource.id, {
        chunkText: newChunk.chunkText,
        tags,
        language: newChunk.language,
      });
      setNewChunk({ chunkText: '', tags: '', language: 'en' });
      setShowCreateChunk(false);
      fetchChunks(selectedSource.id);
      fetchSources(); // Refresh to update chunk counts
    } catch (err) {
      console.error('Failed to create chunk:', err);
    }
  };

  const handleDeleteChunk = async (chunkId: string) => {
    if (!token || !confirm('Delete this chunk?')) return;

    try {
      await api.admin.knowledge.deleteChunk(token, chunkId);
      if (selectedSource) {
        fetchChunks(selectedSource.id);
        fetchSources(); // Refresh to update chunk counts
      }
    } catch (err) {
      console.error('Failed to delete chunk:', err);
    }
  };

  const handleRunDiagnostics = async () => {
    if (!token) return;
    try {
      const data = await api.admin.knowledge.getDiagnostics(token);
      setDiagnostics(data);
    } catch (err) {
      console.error('Failed to run diagnostics:', err);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [token]);

  if (loading) {
    return <div className="loading">Loading knowledge vault...</div>;
  }

  return (
    <div className="knowledge-vault-tab">
      <div className="vault-header">
        <h2>Knowledge Vault</h2>
        <div className="vault-actions">
          <button onClick={() => setShowCreateSource(true)}>+ New Source</button>
          <button onClick={handleRunDiagnostics} className="diagnostics-btn">
            Run Diagnostics
          </button>
        </div>
      </div>

      <div className="vault-layout">
        {/* Sources List */}
        <div className="sources-panel">
          <h3>Sources ({sources.length})</h3>
          <div className="sources-list">
            {sources.map((source) => (
              <div
                key={source.id}
                className={`source-item ${selectedSource?.id === source.id ? 'selected' : ''}`}
                onClick={() => handleSelectSource(source)}
              >
                <div className="source-info">
                  <strong>{source.title}</strong>
                  <span className="source-type">{source.sourceType}</span>
                  <span className="chunk-count">{source._count.chunks} chunks</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSource(source.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chunks Panel */}
        <div className="chunks-panel">
          {selectedSource ? (
            <>
              <div className="chunks-header">
                <h3>Chunks for: {selectedSource.title}</h3>
                <button onClick={() => setShowCreateChunk(true)}>+ Add Chunk</button>
              </div>

              {showCreateChunk && (
                <form onSubmit={handleCreateChunk} className="chunk-form">
                  <textarea
                    value={newChunk.chunkText}
                    onChange={(e) => setNewChunk({ ...newChunk, chunkText: e.target.value })}
                    placeholder="Chunk text..."
                    required
                  />
                  <input
                    type="text"
                    value={newChunk.tags}
                    onChange={(e) => setNewChunk({ ...newChunk, tags: e.target.value })}
                    placeholder="Tags (comma-separated)"
                  />
                  <input
                    type="text"
                    value={newChunk.language}
                    onChange={(e) => setNewChunk({ ...newChunk, language: e.target.value })}
                    placeholder="Language (e.g., en)"
                  />
                  <div className="form-actions">
                    <button type="submit">Create</button>
                    <button type="button" onClick={() => setShowCreateChunk(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              <div className="chunks-list">
                {chunks.map((chunk) => {
                  const isExpanded = expandedChunks.has(chunk.id);
                  const isLong = chunk.chunkText.length > 150;
                  const displayText = isExpanded || !isLong 
                    ? chunk.chunkText 
                    : chunk.chunkText.substring(0, 150) + '...';
                  
                  return (
                    <div key={chunk.id} className="chunk-item">
                      <div className="chunk-text">
                        <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>
                          {displayText}
                        </pre>
                      </div>
                      {isLong && (
                        <button
                          className="expand-btn"
                          onClick={() => {
                            const newExpanded = new Set(expandedChunks);
                            if (isExpanded) {
                              newExpanded.delete(chunk.id);
                            } else {
                              newExpanded.add(chunk.id);
                            }
                            setExpandedChunks(newExpanded);
                          }}
                        >
                          {isExpanded ? '▲ Show Less' : '▼ Show More'}
                        </button>
                      )}
                      <div className="chunk-meta">
                        <span className="chunk-tags">
                          Tags: {JSON.parse(chunk.tags).join(', ') || 'None'}
                        </span>
                        <span className="chunk-lang">{chunk.language}</span>
                      </div>
                      <button
                        className="delete-btn"
                        onClick={() => handleDeleteChunk(chunk.id)}
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="no-selection">Select a source to view chunks</div>
          )}
        </div>
      </div>

      {/* Create Source Modal */}
      {showCreateSource && (
        <div className="modal-overlay" onClick={() => setShowCreateSource(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Source</h3>
            <form onSubmit={handleCreateSource}>
              <input
                type="text"
                value={newSource.title}
                onChange={(e) => setNewSource({ ...newSource, title: e.target.value })}
                placeholder="Source title"
                required
              />
              <select
                value={newSource.sourceType}
                onChange={(e) => setNewSource({ ...newSource, sourceType: e.target.value })}
              >
                <option value="DOC">Document</option>
                <option value="URL">URL</option>
                <option value="NOTE">Note</option>
                <option value="IMPORT">Import</option>
              </select>
              <input
                type="text"
                value={newSource.url}
                onChange={(e) => setNewSource({ ...newSource, url: e.target.value })}
                placeholder="URL (optional)"
              />
              <div className="form-actions">
                <button type="submit">Create</button>
                <button type="button" onClick={() => setShowCreateSource(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diagnostics Results */}
      {diagnostics && (
        <div className="diagnostics-panel">
          <h3>Diagnostics Results</h3>
          <div className="diagnostic-stats">
            <div>Total Sources: {diagnostics.totalSources}</div>
            <div>Total Chunks: {diagnostics.totalChunks}</div>
            <div>Status: <strong>{diagnostics.status}</strong></div>
          </div>
          {diagnostics.mismatches.length > 0 && (
            <div className="mismatches">
              <h4>⚠️ Chunk Count Mismatches Detected:</h4>
              <ul>
                {diagnostics.mismatches.map((m: any) => (
                  <li key={m.sourceId}>
                    {m.title}: Relation={m.relationCount}, GroupBy={m.groupByCount}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={() => setDiagnostics(null)}>Close</button>
        </div>
      )}
    </div>
  );
};
