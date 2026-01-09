/**
 * Wall-E Learning Diagnostics Tab (Production-Hardened)
 * Admin portal component for troubleshooting the learning system
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAdminStore } from '../../store/adminStore';
import { api } from '../../lib/api';

interface LearningHealth {
  success: boolean;
  timestamp: string;
  requestId?: string;
  config: {
    enabled: boolean;
    readonly: boolean;
    shadowMode: boolean;
    canaryEnabled: boolean;
    canaryPercentage: number;
  };
  tables: {
    userConceptStates: number;
    adviceInterventions: number;
    practicePlans: number;
    learningEvents: number;
  };
  status: string;
  durationMs?: number;
}

interface UserProgress {
  success: boolean;
  userId: string;
  requestId?: string;
  gamesAnalyzed: number;
  lastIngestedAt: string | null;
  topWeakConcepts: Array<{ name: string; mastery: number; lastSeen: string | null }>;
  topStrongConcepts: Array<{ name: string; mastery: number; lastSeen: string | null }>;
  recentKeyMoments: Array<any>;
  totalConcepts: number;
  avgMastery: number;
  durationMs?: number;
}

interface LearningEvent {
  id: string;
  ts: string;
  userId: string;
  eventType: string;
  payload: {
    gameId?: string;
    blunders?: number;
    mistakes?: number;
    accuracy?: number;
    conceptsUpdated?: number;
    result?: string;
    durationMs?: number;
    partial?: boolean;
    errorCode?: string;
    flags?: {
      enabled?: boolean;
      shadow?: boolean;
      readonly?: boolean;
      async?: boolean;
      maxPly?: number;
    };
  };
}

interface RecentEventsResponse {
  success: boolean;
  requestId?: string;
  events: LearningEvent[];
  total: number;
  durationMs?: number;
}

// Safe date formatter that handles invalid dates
const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

const formatDateShort = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Never';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return 'Invalid';
    return date.toLocaleDateString();
  } catch {
    return 'Invalid';
  }
};

// Clamp mastery between 0 and 1
const clampMastery = (mastery: number): number => {
  return Math.max(0, Math.min(1, mastery));
};

// Hash userId for privacy (first 8 chars of simple hash)
const hashUserId = (userId: string): string => {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).substring(0, 8);
};

export const LearningDiagnosticsTab: React.FC = () => {
  const { token } = useAdminStore();
  const [health, setHealth] = useState<LearningHealth | null>(null);
  const [lastGoodHealth, setLastGoodHealth] = useState<LearningHealth | null>(null);
  const [testUserId, setTestUserId] = useState('');
  const [userProgress, setUserProgress] = useState<UserProgress | null>(null);
  const [recentEvents, setRecentEvents] = useState<LearningEvent[]>([]);
  const [eventsFilter, setEventsFilter] = useState<'all' | 'failed' | '1h' | '24h'>('all');
  const [healthLoading, setHealthLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // AbortControllers for cancellable requests
  const healthAbortController = useRef<AbortController | null>(null);
  const progressAbortController = useRef<AbortController | null>(null);
  const eventsAbortController = useRef<AbortController | null>(null);
  
  // Request sequence counter for race condition protection
  const healthSeq = useRef(0);
  const progressSeq = useRef(0);
  const eventsSeq = useRef(0);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      healthAbortController.current?.abort();
      progressAbortController.current?.abort();
      eventsAbortController.current?.abort();
    };
  }, []);

  useEffect(() => {
    loadHealth();
    loadRecentEvents();
  }, []);

  const loadHealth = async () => {
    // Cancel previous request
    healthAbortController.current?.abort();
    healthAbortController.current = new AbortController();
    
    const currentSeq = ++healthSeq.current;
    
    try {
      setHealthLoading(true);
      setError(null);
      
      const response = await fetch('/api/admin/learning-health', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: healthAbortController.current.signal,
      });
      
      // Check if this response is still relevant
      if (currentSeq !== healthSeq.current) return;
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorMessage = `HTTP ${response.status}`;
        
        if (response.status === 401 || response.status === 403) {
          errorMessage = 'Admin authentication required or expired';
        } else if (response.status === 404) {
          errorMessage = 'Endpoint not deployed (404)';
        } else if (response.status >= 500) {
          errorMessage = `Backend error (${response.status}). Check Worker logs.`;
        } else {
          errorMessage += `: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Defensive parsing with fallbacks
      const parsedHealth: LearningHealth = {
        success: data?.success ?? false,
        timestamp: data?.timestamp ?? new Date().toISOString(),
        requestId: data?.requestId,
        config: {
          enabled: data?.config?.enabled ?? false,
          readonly: data?.config?.readonly ?? false,
          shadowMode: data?.config?.shadowMode ?? false,
          canaryEnabled: data?.config?.canaryEnabled ?? false,
          canaryPercentage: data?.config?.canaryPercentage ?? 0,
        },
        tables: {
          userConceptStates: data?.tables?.userConceptStates ?? 0,
          adviceInterventions: data?.tables?.adviceInterventions ?? 0,
          practicePlans: data?.tables?.practicePlans ?? 0,
          learningEvents: data?.tables?.learningEvents ?? 0,
        },
        status: data?.status ?? 'unknown',
        durationMs: data?.durationMs,
      };
      
      setHealth(parsedHealth);
      setLastGoodHealth(parsedHealth);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return; // Intentional abort, don't show error
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load health data';
      setError(errorMessage);
      console.error('[LearningDiagnostics] Health check failed:', err);
    } finally {
      if (currentSeq === healthSeq.current) {
        setHealthLoading(false);
      }
    }
  };

  const loadUserProgress = useCallback(async () => {
    const userId = testUserId.trim();
    if (!userId) {
      setError('Please enter a user ID');
      return;
    }
    
    // Cancel previous request
    progressAbortController.current?.abort();
    progressAbortController.current = new AbortController();
    
    const currentSeq = ++progressSeq.current;
    
    try {
      setProgressLoading(true);
      setError(null);
      
      const response = await fetch(`/api/learning/progress?userId=${encodeURIComponent(userId)}`, {
        signal: progressAbortController.current.signal,
      });
      
      // Check if this response is still relevant
      if (currentSeq !== progressSeq.current) return;
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        let errorMessage = `HTTP ${response.status}`;
        
        if (response.status === 404) {
          errorMessage = 'User not found or endpoint not deployed';
        } else if (response.status >= 500) {
          errorMessage = `Server error (${response.status}). Check Worker logs.`;
        } else {
          errorMessage += `: ${errorText}`;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      // Defensive parsing
      const parsedProgress: UserProgress = {
        success: data?.success ?? false,
        userId: data?.userId ?? userId,
        requestId: data?.requestId,
        gamesAnalyzed: data?.gamesAnalyzed ?? 0,
        lastIngestedAt: data?.lastIngestedAt ?? null,
        topWeakConcepts: (data?.topWeakConcepts ?? []).map((c: any) => ({
          name: c?.name ?? 'unknown',
          mastery: clampMastery(c?.mastery ?? 0),
          lastSeen: c?.lastSeen ?? null,
        })),
        topStrongConcepts: (data?.topStrongConcepts ?? []).map((c: any) => ({
          name: c?.name ?? 'unknown',
          mastery: clampMastery(c?.mastery ?? 0),
          lastSeen: c?.lastSeen ?? null,
        })),
        recentKeyMoments: data?.recentKeyMoments ?? [],
        totalConcepts: data?.totalConcepts ?? 0,
        avgMastery: clampMastery(data?.avgMastery ?? 0),
        durationMs: data?.durationMs,
      };
      
      setUserProgress(parsedProgress);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load user progress';
      setError(errorMessage);
      console.error('[LearningDiagnostics] User progress failed:', err);
    } finally {
      if (currentSeq === progressSeq.current) {
        setProgressLoading(false);
      }
    }
  }, [testUserId]);

  const loadRecentEvents = async () => {
    // Cancel previous request
    eventsAbortController.current?.abort();
    eventsAbortController.current = new AbortController();
    
    const currentSeq = ++eventsSeq.current;
    
    try {
      setEventsLoading(true);
      
      const response = await fetch('/api/admin/learning-recent?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: eventsAbortController.current.signal,
      });
      
      if (currentSeq !== eventsSeq.current) return;
      
      if (!response.ok) {
        // Don't show error for events - it's not critical
        console.warn('[LearningDiagnostics] Recent events failed:', response.status);
        setRecentEvents([]);
        return;
      }
      
      const data: RecentEventsResponse = await response.json();
      setRecentEvents(data?.events ?? []);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.warn('[LearningDiagnostics] Recent events failed:', err);
      setRecentEvents([]);
    } finally {
      if (currentSeq === eventsSeq.current) {
        setEventsLoading(false);
      }
    }
  };

  // Debounced user ID input
  useEffect(() => {
    const timer = setTimeout(() => {
      // Auto-lookup could be added here if desired
    }, 300);
    return () => clearTimeout(timer);
  }, [testUserId]);

  const getStatusColor = (status: string) => {
    if (status === 'healthy') return '#4ade80';
    if (status === 'unhealthy') return '#ef4444';
    return '#fbbf24';
  };

  const getConfigStatus = () => {
    const currentHealth = health || lastGoodHealth;
    if (!currentHealth) return 'Unknown';
    if (!currentHealth.config.enabled) return '❌ Disabled';
    if (currentHealth.config.readonly) return '⚠️ Read-Only Mode';
    if (currentHealth.config.shadowMode) return '🔍 Shadow Mode (No Writes)';
    return '✅ Active';
  };

  const getMasteryColor = (mastery: number): string => {
    const clamped = clampMastery(mastery);
    if (clamped < 0.3) return '#ef4444';
    if (clamped < 0.7) return '#fbbf24';
    return '#4ade80';
  };

  const getMasteryBg = (mastery: number): string => {
    const clamped = clampMastery(mastery);
    if (clamped < 0.3) return '#fee';
    if (clamped < 0.7) return '#fef3c7';
    return '#d1fae5';
  };

  const getEventStatusBadge = (event: LearningEvent) => {
    const isPartial = event.payload?.partial;
    const hasError = event.payload?.errorCode;
    
    if (hasError) {
      return { label: 'FAILED', color: '#ef4444', bg: '#fee' };
    } else if (isPartial) {
      return { label: 'PARTIAL', color: '#f59e0b', bg: '#fef3c7' };
    } else {
      return { label: 'SUCCESS', color: '#10b981', bg: '#d1fae5' };
    }
  };

  const getLocalUserId = (): string | null => {
    try {
      return localStorage.getItem('userId') || 
             localStorage.getItem('guestId') || 
             localStorage.getItem('user_id') ||
             null;
    } catch {
      return null;
    }
  };

  const handleGetMyUserId = () => {
    const userId = getLocalUserId();
    if (userId) {
      setTestUserId(userId);
      // Don't use alert, just provide feedback in UI
      setError(null);
    } else {
      setError('No user ID found in localStorage. Play a game first to generate one.');
    }
  };

  const filterEvents = (events: LearningEvent[]) => {
    let filtered = events;
    
    if (eventsFilter === 'failed') {
      filtered = filtered.filter(e => e.payload?.errorCode);
    } else if (eventsFilter === '1h') {
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      filtered = filtered.filter(e => new Date(e.ts).getTime() > oneHourAgo);
    } else if (eventsFilter === '24h') {
      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      filtered = filtered.filter(e => new Date(e.ts).getTime() > oneDayAgo);
    }
    
    return filtered;
  };

  return (
    <div className="learning-diagnostics-tab">
      <div className="diagnostics-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>🤖 Wall-E Learning System Diagnostics</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={loadRecentEvents} 
            className="refresh-button" 
            disabled={eventsLoading}
            style={{ padding: '0.5rem 1rem', cursor: eventsLoading ? 'not-allowed' : 'pointer' }}
          >
            {eventsLoading ? '⏳' : '🔄'} Events
          </button>
          <button 
            onClick={loadHealth} 
            className="refresh-button" 
            disabled={healthLoading}
            style={{ padding: '0.5rem 1rem', cursor: healthLoading ? 'not-allowed' : 'pointer' }}
          >
            {healthLoading ? '⏳' : '🔄'} Health
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner" style={{ background: '#fee', color: '#c00', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}>×</button>
        </div>
      )}

      {/* System Health */}
      {(health || lastGoodHealth) && (
        <div className="health-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>System Health</h3>
            {healthLoading && lastGoodHealth && (
              <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>⏳ Refreshing...</span>
            )}
          </div>
          <div className="health-overview" style={{ 
            background: (health || lastGoodHealth)!.status === 'healthy' ? '#f0fdf4' : '#fef2f2', 
            padding: '1.5rem', 
            borderRadius: '8px',
            border: `2px solid ${getStatusColor((health || lastGoodHealth)!.status)}`,
            marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.2rem' }}>Status: {(health || lastGoodHealth)!.status.toUpperCase()}</h4>
                <p style={{ margin: '0.5rem 0 0 0', opacity: 0.7 }}>
                  Last checked: {formatDate((health || lastGoodHealth)!.timestamp)}
                  {(health || lastGoodHealth)!.requestId && (
                    <span style={{ marginLeft: '1rem', fontSize: '0.75rem' }}>
                      (ID: {(health || lastGoodHealth)!.requestId.substring(0, 8)})
                    </span>
                  )}
                </p>
              </div>
              <div style={{ fontSize: '3rem' }}>
                {(health || lastGoodHealth)!.status === 'healthy' ? '✅' : '❌'}
              </div>
            </div>
          </div>

          {/* Configuration */}
          <div className="config-section" style={{ marginBottom: '1.5rem' }}>
            <h4>Configuration</h4>
            <div className="config-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="config-card" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Overall Status</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>{getConfigStatus()}</div>
              </div>
              <div className="config-card" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Enabled</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {(health || lastGoodHealth)!.config.enabled ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              <div className="config-card" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Read-Only Mode</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {(health || lastGoodHealth)!.config.readonly ? '⚠️ Yes' : '✅ No'}
                </div>
              </div>
              <div className="config-card" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Shadow Mode</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {(health || lastGoodHealth)!.config.shadowMode ? '🔍 Yes' : '✅ No'}
                </div>
              </div>
              <div className="config-card" style={{ background: '#f9fafb', padding: '1rem', borderRadius: '6px' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Canary Testing</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {(health || lastGoodHealth)!.config.canaryEnabled ? `✅ ${(health || lastGoodHealth)!.config.canaryPercentage}%` : '❌ Disabled'}
                </div>
              </div>
            </div>
          </div>

          {/* Database Tables */}
          <div className="tables-section" style={{ marginBottom: '1.5rem' }}>
            <h4>Database Tables</h4>
            <div className="tables-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="table-card" style={{ background: '#f0f9ff', padding: '1rem', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>User Concept States</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: '0.5rem', color: '#1d4ed8' }}>
                  {(health || lastGoodHealth)!.tables.userConceptStates.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>Individual concept mastery records</div>
              </div>
              <div className="table-card" style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Learning Events</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: '0.5rem', color: '#15803d' }}>
                  {(health || lastGoodHealth)!.tables.learningEvents.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>Audit trail of ingestion & updates</div>
              </div>
              <div className="table-card" style={{ background: '#fefce8', padding: '1rem', borderRadius: '6px', border: '1px solid #fef08a' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Advice Interventions</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: '0.5rem', color: '#a16207' }}>
                  {(health || lastGoodHealth)!.tables.adviceInterventions.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>Coaching recommendations tracked</div>
              </div>
              <div className="table-card" style={{ background: '#faf5ff', padding: '1rem', borderRadius: '6px', border: '1px solid #e9d5ff' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Practice Plans</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, marginTop: '0.5rem', color: '#7c3aed' }}>
                  {(health || lastGoodHealth)!.tables.practicePlans.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', marginTop: '0.5rem', opacity: 0.6 }}>Generated training plans</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Events / Proof of Learning */}
      <div className="recent-events-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>🔬 Proof of Learning (Recent Events)</h3>
          {eventsLoading && <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>⏳ Loading...</span>}
        </div>
        <p style={{ marginBottom: '1rem', opacity: 0.7, fontSize: '0.875rem' }}>
          This shows actual ingestion attempts, helping diagnose "Did the system ingest? Did it analyze? Did it write?"
        </p>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(['all', 'failed', '1h', '24h'] as const).map(filter => (
            <button
              key={filter}
              onClick={() => setEventsFilter(filter)}
              style={{
                padding: '0.5rem 1rem',
                background: eventsFilter === filter ? '#3b82f6' : 'white',
                color: eventsFilter === filter ? 'white' : '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: eventsFilter === filter ? 600 : 400,
              }}
            >
              {filter === 'all' ? 'All Events' : 
               filter === 'failed' ? 'Failed Only' :
               filter === '1h' ? 'Last Hour' : 'Last 24h'}
            </button>
          ))}
        </div>

        {recentEvents.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
            {filterEvents(recentEvents).slice(0, 20).map(event => {
              const badge = getEventStatusBadge(event);
              return (
                <div key={event.id} style={{ 
                  background: 'white', 
                  padding: '1rem', 
                  borderRadius: '6px', 
                  border: '1px solid #e5e7eb',
                  fontSize: '0.875rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.25rem 0.5rem', 
                        background: badge.bg, 
                        color: badge.color,
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        marginRight: '0.5rem'
                      }}>
                        {badge.label}
                      </span>
                      <span style={{ fontWeight: 600 }}>{event.eventType}</span>
                    </div>
                    <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{formatDate(event.ts)}</span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <div>
                      <span style={{ opacity: 0.6 }}>User:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{hashUserId(event.userId)}</span>
                    </div>
                    {event.payload.gameId && (
                      <div>
                        <span style={{ opacity: 0.6 }}>Game:</span> <span style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{event.payload.gameId.substring(0, 8)}</span>
                      </div>
                    )}
                    {event.payload.conceptsUpdated !== undefined && (
                      <div>
                        <span style={{ opacity: 0.6 }}>Concepts:</span> <strong>{event.payload.conceptsUpdated}</strong>
                      </div>
                    )}
                    {event.payload.durationMs && (
                      <div>
                        <span style={{ opacity: 0.6 }}>Duration:</span> <strong>{event.payload.durationMs}ms</strong>
                      </div>
                    )}
                    {event.payload.errorCode && (
                      <div style={{ gridColumn: '1 / -1', color: '#dc2626', marginTop: '0.25rem' }}>
                        <span style={{ opacity: 0.8 }}>Error:</span> <code>{event.payload.errorCode}</code>
                      </div>
                    )}
                  </div>

                  {event.payload.flags && (
                    <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#f9fafb', borderRadius: '4px', fontSize: '0.75rem', opacity: 0.8 }}>
                      Flags: enabled={String(event.payload.flags.enabled)}, shadow={String(event.payload.flags.shadow)}, 
                      readonly={String(event.payload.flags.readonly)}, async={String(event.payload.flags.async)}
                      {event.payload.flags.maxPly && `, maxPly=${event.payload.flags.maxPly}`}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      const json = JSON.stringify(event, null, 2);
                      navigator.clipboard.writeText(json);
                      alert('Event JSON copied to clipboard');
                    }}
                    style={{
                      marginTop: '0.5rem',
                      padding: '0.25rem 0.5rem',
                      background: 'transparent',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                    }}
                  >
                    📋 Copy JSON
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.6 }}>
            {eventsLoading ? 'Loading events...' : 'No recent events found. Events endpoint may not be deployed yet.'}
          </div>
        )}
      </div>

      {/* User Progress Lookup */}
      <div className="user-lookup-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9fafb', borderRadius: '8px' }}>
        <h3>🔍 User Progress Lookup</h3>
        <p style={{ marginBottom: '1rem', opacity: 0.7 }}>
          Enter a user ID to inspect their learning progress (useful for debugging user reports)
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
            placeholder="Enter user ID (e.g., guest-1234567890)"
            style={{ 
              flex: 1, 
              minWidth: '250px',
              padding: '0.75rem', 
              border: '1px solid #d1d5db', 
              borderRadius: '6px',
              fontSize: '1rem'
            }}
            onKeyDown={(e) => e.key === 'Enter' && !progressLoading && loadUserProgress()}
          />
          <button 
            onClick={loadUserProgress}
            disabled={progressLoading || !testUserId.trim()}
            style={{
              padding: '0.75rem 1.5rem',
              background: testUserId.trim() && !progressLoading ? '#3b82f6' : '#d1d5db',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: testUserId.trim() && !progressLoading ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              whiteSpace: 'nowrap'
            }}
          >
            {progressLoading ? '⏳ Loading...' : '🔍 Look Up'}
          </button>
          <button
            onClick={handleGetMyUserId}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            👤 Get My ID
          </button>
        </div>

        {/* Validation Help */}
        <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#e0f2fe', borderRadius: '6px', fontSize: '0.875rem' }}>
          <strong>💡 Tip:</strong> If gamesAnalyzed stays 0 after playing a game, postgame ingestion is not wired. 
          Test progress endpoint: <a href="/api/learning/progress?userId=test" target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', textDecoration: 'underline' }}>
            /api/learning/progress?userId=test
          </a>
        </div>

        {userProgress && (
          <div className="user-progress-results" style={{ marginTop: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h4>Results for: {userProgress.userId}</h4>
              {userProgress.requestId && (
                <span style={{ fontSize: '0.75rem', opacity: 0.6, fontFamily: 'monospace' }}>
                  ID: {userProgress.requestId.substring(0, 8)}
                </span>
              )}
            </div>
            
            <div className="progress-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Games Analyzed</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#1d4ed8' }}>{userProgress.gamesAnalyzed}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Concepts Tracked</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#15803d' }}>{userProgress.totalConcepts}</div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Avg Mastery</div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: '#7c3aed' }}>
                  {(clampMastery(userProgress.avgMastery) * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ background: 'white', padding: '1rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Last Ingested</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.5rem' }}>
                  {formatDate(userProgress.lastIngestedAt)}
                </div>
              </div>
            </div>

            {userProgress.gamesAnalyzed === 0 && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fcd34d' }}>
                ⚠️ No games analyzed yet for this user. They need to play a game to start learning, or the ingestion flow is not wired.
              </div>
            )}

            {userProgress.topWeakConcepts.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h5>🎯 Weakest Concepts (Areas to Improve)</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {userProgress.topWeakConcepts.map((concept, i) => {
                    const clamped = clampMastery(concept.mastery);
                    return (
                      <div key={i} style={{ 
                        background: 'white', 
                        padding: '0.75rem', 
                        borderRadius: '6px', 
                        border: `1px solid ${getMasteryBg(clamped)}`, 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '1rem' 
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{concept.name}</div>
                          <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
                            Last seen: {formatDateShort(concept.lastSeen)}
                          </div>
                        </div>
                        <div style={{ width: '200px', height: '8px', background: getMasteryBg(clamped), borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${clamped * 100}%`, 
                            height: '100%', 
                            background: getMasteryColor(clamped),
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontWeight: 600, minWidth: '60px', textAlign: 'right' }}>
                          {(clamped * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {userProgress.topStrongConcepts.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h5>💪 Strongest Concepts</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {userProgress.topStrongConcepts.map((concept, i) => {
                    const clamped = clampMastery(concept.mastery);
                    return (
                      <div key={i} style={{ background: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #d1fae5', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600 }}>{concept.name}</div>
                          <div style={{ fontSize: '0.875rem', opacity: 0.6 }}>
                            Last seen: {formatDateShort(concept.lastSeen)}
                          </div>
                        </div>
                        <div style={{ width: '200px', height: '8px', background: '#d1fae5', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${clamped * 100}%`, 
                            height: '100%', 
                            background: '#4ade80',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                        <div style={{ fontWeight: 600, minWidth: '60px', textAlign: 'right', color: '#15803d' }}>
                          {(clamped * 100).toFixed(0)}%
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {userProgress.recentKeyMoments.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h5>🔑 Recent Key Moments</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {userProgress.recentKeyMoments.slice(0, 5).map((moment, i) => (
                    <div key={i} style={{ background: 'white', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 600 }}>Game {userProgress.gamesAnalyzed - i}</span>
                        <span style={{ fontSize: '0.875rem', opacity: 0.6 }}>
                          {formatDate(moment.timestamp)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', flexWrap: 'wrap' }}>
                        <span>Blunders: <strong>{moment.blunders ?? 0}</strong></span>
                        <span>Mistakes: <strong>{moment.mistakes ?? 0}</strong></span>
                        <span>Accuracy: <strong>{(moment.accuracy ?? 0).toFixed(0)}%</strong></span>
                        <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                          {moment.conceptsUpdated ?? 0} concepts updated
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!userProgress && testUserId && !progressLoading && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: '#f3f4f6', borderRadius: '6px', textAlign: 'center', opacity: 0.6 }}>
            Click "Look Up" to inspect this user's learning progress
          </div>
        )}
      </div>

      {/* Troubleshooting Guide */}
      <div className="troubleshooting-section" style={{ marginTop: '2rem', padding: '1.5rem', background: '#fefce8', borderRadius: '8px', border: '1px solid #fef08a' }}>
        <h3>🛠️ Common Issues & Solutions</h3>
        
        <div style={{ marginTop: '1rem' }}>
          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              ❌ "0 concepts updated" showing in postgame
            </summary>
            <div style={{ padding: '1rem', marginTop: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <p><strong>Possible causes:</strong></p>
              <ul>
                <li>Learning system is in shadow mode (check config above → "Shadow Mode")</li>
                <li>System is in readonly mode (no writes allowed)</li>
                <li>STOCKFISH_GAME_ANALYSIS_ENABLED is not set to "true"</li>
                <li>Async processing is queued but not yet complete (check Recent Events panel)</li>
                <li>Render server cold start prevented analysis</li>
              </ul>
              <p><strong>Solution:</strong> Look up the user ID above and check if gamesAnalyzed is incrementing. If yes, learning IS working—the postgame message is just from a stub. Check Recent Events to see actual ingestion status.</p>
            </div>
          </details>

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              ⚠️ Training Portal shows "32 games tracked"
            </summary>
            <div style={{ padding: '1rem', marginTop: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <p><strong>Cause:</strong> This is localStorage sample data from old migration, not server data.</p>
              <p><strong>Solution:</strong> Training Portal now fetches real server data from /api/learning/progress. If it still shows "32 games", user needs to hard refresh (Ctrl+Shift+R on Windows, Cmd+Shift+R on Mac) to load new bundle.</p>
            </div>
          </details>

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              🔍 No concept states for a user who played games
            </summary>
            <div style={{ padding: '1rem', marginTop: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <p><strong>Possible causes:</strong></p>
              <ul>
                <li>Learning system in read-only or shadow mode (check Configuration section)</li>
                <li>Render server timeout preventing analysis completion</li>
                <li>Database connection issues (check Worker logs)</li>
                <li>User ID mismatch (check exact ID from localStorage)</li>
                <li>Postgame UI not calling ingestion endpoint (architecture disconnect)</li>
              </ul>
              <p><strong>Debugging:</strong> Check "Recent Events" panel. If events are appearing with SUCCESS status, ingestion is working. If Learning Events table count above is incrementing, system is functional. If no events at all, ingestion flow is not wired.</p>
            </div>
          </details>

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              🔗 How to verify ingestion wiring
            </summary>
            <div style={{ padding: '1rem', marginTop: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <p><strong>Steps:</strong></p>
              <ol>
                <li>Play a complete game</li>
                <li>Note your user ID (click "Get My ID" button above)</li>
                <li>Wait 30-60 seconds for async processing</li>
                <li>Look up your user ID in this admin panel</li>
                <li>Check "Games Analyzed" stat</li>
                <li>Check "Recent Events" panel for your game</li>
              </ol>
              <p><strong>If gamesAnalyzed = 0:</strong> Postgame flow is NOT calling /api/learning/ingest-game. This is the documented UI disconnect.</p>
              <p><strong>If gamesAnalyzed &gt; 0:</strong> Learning is working! The "0 concepts updated" message is from a stub endpoint.</p>
            </div>
          </details>

          <details style={{ marginBottom: '1rem' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, padding: '0.5rem', background: 'white', borderRadius: '4px' }}>
              🚀 How to enable learning if disabled
            </summary>
            <div style={{ padding: '1rem', marginTop: '0.5rem', background: 'white', borderRadius: '4px' }}>
              <p><strong>Environment variables needed (Worker):</strong></p>
              <pre style={{ background: '#f3f4f6', padding: '1rem', borderRadius: '4px', overflow: 'auto', fontSize: '0.875rem' }}>
{`STOCKFISH_GAME_ANALYSIS_ENABLED=true
DATABASE_URL=prisma://...
STOCKFISH_SERVER_URL=https://chesschat-stockfish.onrender.com
STOCKFISH_API_KEY=<your-key>`}
              </pre>
              <p style={{ marginTop: '1rem' }}><strong>After setting:</strong> Redeploy Worker with <code>wrangler deploy</code> or push to trigger Cloudflare auto-deploy.</p>
            </div>
          </details>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions" style={{ marginTop: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <button 
          onClick={() => window.open('/api/learning/progress?userId=test', '_blank')}
          style={{ padding: '0.75rem 1.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
        >
          📊 Test Progress Endpoint
        </button>
        <button 
          onClick={() => window.open('https://chesschat-stockfish.onrender.com/health', '_blank')}
          style={{ padding: '0.75rem 1.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
        >
          🏥 Check Render Health
        </button>
        <button 
          onClick={() => window.open('/api/admin/learning-health', '_blank')}
          style={{ padding: '0.75rem 1.5rem', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer' }}
        >
          🔍 Health Endpoint (Raw)
        </button>
      </div>
    </div>
  );
};
