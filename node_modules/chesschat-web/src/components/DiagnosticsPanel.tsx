/**
 * Diagnostics Panel Component
 * 
 * Hidden debug panel showing storage, performance, and system health.
 * Accessible via ?debug=1 query parameter.
 */

'use client';

import { useEffect, useState } from 'react';
import { 
  collectDiagnostics, 
  isDebugMode, 
  resetDiagnostics,
  type DiagnosticsData 
} from '@/lib/diagnostics/clientDiagnostics';
import { clearCache as clearCoachingCache } from '@/lib/coaching/coachingCache';
import { clearAllMastery } from '@/lib/coaching/masteryModel';
import { clearNamespace } from '@/lib/storage/safeStorage';

export function DiagnosticsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  useEffect(() => {
    if (!isDebugMode()) {
      setIsOpen(false);
      return;
    }

    setIsOpen(true);
    refreshData();

    if (autoRefresh) {
      const interval = setInterval(refreshData, 2000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const refreshData = () => {
    const diagnostics = collectDiagnostics();
    setData(diagnostics);
  };

  const handleClearCoachingCache = () => {
    if (confirm('Clear all cached coaching reports?')) {
      clearCoachingCache();
      refreshData();
    }
  };

  const handleClearMastery = () => {
    if (confirm('Clear all mastery data? This will reset your learning progress.')) {
      clearAllMastery();
      refreshData();
    }
  };

  const handleClearNamespace = (namespace: string) => {
    if (confirm(`Clear all ${namespace} data?`)) {
      clearNamespace(namespace);
      refreshData();
    }
  };

  const handleResetCounters = () => {
    resetDiagnostics();
    refreshData();
  };

  if (!isOpen || !data) return null;

  return (
    <div className="fixed bottom-4 right-4 w-[600px] max-h-[80vh] bg-gray-900 text-gray-100 rounded-lg shadow-2xl overflow-hidden z-50 font-mono text-xs">
      {/* Header */}
      <div className="bg-blue-600 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold">🔧 Client Diagnostics</span>
          <span className="text-xs opacity-75">
            {new Date(data.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-3 h-3"
            />
            Auto
          </label>
          <button
            onClick={refreshData}
            className="px-2 py-1 bg-blue-500 hover:bg-blue-400 rounded text-xs"
          >
            ↻
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-2 py-1 bg-red-500 hover:bg-red-400 rounded text-xs"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(80vh-120px)]">
        {/* Storage */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">📦 Storage</h3>
          <div className="space-y-1 pl-2">
            <div>
              Total: <span className="text-green-400">{data.storage.totalMB} MB</span>
              {' '}({data.storage.totalBytes.toLocaleString()} bytes)
            </div>
            {Object.entries(data.storage.namespaces).map(([ns, info]) => (
              <div key={ns} className="flex justify-between items-center">
                <span>
                  {ns}: <span className="text-blue-400">{info.mb.toFixed(2)} MB</span>
                </span>
                <button
                  onClick={() => handleClearNamespace(ns)}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 rounded text-[10px]"
                >
                  Clear
                </button>
              </div>
            ))}
            {data.storage.lastPruned > 0 && (
              <div className="text-gray-400 text-[10px]">
                Last pruned: {new Date(data.storage.lastPruned).toLocaleString()}
              </div>
            )}
          </div>
        </section>

        {/* Coaching Cache */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">🎓 Coaching Cache</h3>
          <div className="space-y-1 pl-2">
            <div>Reports: <span className="text-green-400">{data.coaching.cachedReports}</span></div>
            <div>Size: <span className="text-blue-400">{data.coaching.cacheMB.toFixed(2)} MB</span></div>
            <div>Avg compute: <span className="text-purple-400">{data.coaching.averageComputeTime}ms</span></div>
            {data.coaching.oldestCacheEntry && (
              <div className="text-[10px] text-gray-400">
                Oldest: {new Date(data.coaching.oldestCacheEntry).toLocaleString()}
              </div>
            )}
            <button
              onClick={handleClearCoachingCache}
              className="mt-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-[10px]"
            >
              Clear Cache
            </button>
          </div>
        </section>

        {/* Learning */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">🧠 Learning Progress</h3>
          <div className="space-y-1 pl-2">
            <div>Total concepts: <span className="text-green-400">{data.learning.totalConcepts}</span></div>
            <div>Mastered: <span className="text-green-400">{data.learning.masteredConcepts}</span></div>
            <div>In progress: <span className="text-yellow-400">{data.learning.inProgressConcepts}</span></div>
            <div>Needs review: <span className="text-red-400">{data.learning.needsReviewConcepts}</span></div>
            <div>
              Avg mastery: <span className="text-purple-400">
                {(data.learning.averageMastery * 100).toFixed(1)}%
              </span>
            </div>
            <button
              onClick={handleClearMastery}
              className="mt-1 px-2 py-1 bg-red-600 hover:bg-red-500 rounded text-[10px]"
            >
              Reset Learning
            </button>
          </div>
        </section>

        {/* Performance */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">⚡ Performance</h3>
          <div className="space-y-1 pl-2">
            <div>
              Last analysis: {' '}
              {data.performance.lastAnalysisDuration !== null ? (
                <span className={
                  data.performance.lastAnalysisDuration < 100 ? 'text-green-400' :
                  data.performance.lastAnalysisDuration < 500 ? 'text-yellow-400' :
                  'text-red-400'
                }>
                  {data.performance.lastAnalysisDuration}ms
                </span>
              ) : (
                <span className="text-gray-400">N/A</span>
              )}
            </div>
            <div>
              Cache hit rate: {' '}
              <span className={
                data.performance.cacheHitRate > 0.8 ? 'text-green-400' :
                data.performance.cacheHitRate > 0.5 ? 'text-yellow-400' :
                'text-red-400'
              }>
                {(data.performance.cacheHitRate * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </section>

        {/* Logging */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">📝 Logging</h3>
          <div className="space-y-1 pl-2">
            <div>Unique messages: <span className="text-blue-400">{data.logging.uniqueMessages}</span></div>
            <div>Suppressed: <span className="text-gray-400">{data.logging.totalSuppressed}</span></div>
            <button
              onClick={handleResetCounters}
              className="mt-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[10px]"
            >
              Reset Counters
            </button>
          </div>
        </section>

        {/* Server Status */}
        <section>
          <h3 className="font-bold text-yellow-400 mb-2">🌐 Server Status</h3>
          <div className="space-y-1 pl-2">
            {data.serverStatus.lastDegradedResponse ? (
              <>
                <div className="text-orange-400">Last degraded response:</div>
                <div className="text-[10px] text-gray-300 pl-2">
                  {data.serverStatus.lastDegradedResponse}
                </div>
                <div className="text-[10px] text-gray-400">
                  Response time: {data.serverStatus.lastResponseTime}ms
                </div>
              </>
            ) : (
              <div className="text-green-400">No recent degraded responses</div>
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="bg-gray-800 px-4 py-2 text-[10px] text-gray-400 border-t border-gray-700">
        Remove <code className="bg-gray-700 px-1 rounded">?debug=1</code> from URL to hide this panel
      </div>
    </div>
  );
}
