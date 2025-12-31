/**
 * Safe Storage Layer
 * 
 * Provides hardened localStorage with:
 * - Schema versioning and migrations
 * - Atomic writes with integrity checks
 * - Corruption detection and recovery
 * - Size budgeting and LRU pruning
 * - TTL support
 */

interface StorageEntry<T> {
  version: number;
  data: T;
  checksum: string;
  timestamp: number;
  ttl?: number;
}

interface StorageMetadata {
  totalBytes: number;
  namespaces: Record<string, number>;
  lastPruned: number;
}

// Storage quotas per namespace (in bytes)
const NAMESPACE_QUOTAS = {
  'learning': 2 * 1024 * 1024,    // 2MB
  'coaching': 1 * 1024 * 1024,    // 1MB
  'trainingExamples': 2 * 1024 * 1024, // 2MB
  'default': 512 * 1024           // 512KB
};

const METADATA_KEY = '__safeStorage_metadata__';

/**
 * Simple checksum for integrity verification
 */
function calculateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Parse namespace from key (format: "namespace:subkey")
 */
function getNamespace(key: string): string {
  const parts = key.split(':');
  return parts.length > 1 ? parts[0] : 'default';
}

/**
 * Get current storage footprint
 */
export function getStorageFootprint(): StorageMetadata {
  const namespaces: Record<string, number> = {};
  let totalBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    
    const value = localStorage.getItem(key);
    if (!value) continue;
    
    const bytes = new Blob([value]).size;
    totalBytes += bytes;
    
    const namespace = getNamespace(key);
    namespaces[namespace] = (namespaces[namespace] || 0) + bytes;
  }

  return {
    totalBytes,
    namespaces,
    lastPruned: parseInt(localStorage.getItem(METADATA_KEY) || '0', 10)
  };
}

/**
 * Get item with validation and default fallback
 */
export function getItem<T>(
  key: string,
  validator?: (data: unknown) => data is T,
  defaultValue?: T
): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue ?? null;

    const entry = JSON.parse(raw) as StorageEntry<T>;
    
    // Check TTL
    if (entry.ttl && Date.now() > entry.timestamp + entry.ttl) {
      localStorage.removeItem(key);
      return defaultValue ?? null;
    }

    // Verify checksum
    const dataStr = JSON.stringify(entry.data);
    const expectedChecksum = calculateChecksum(dataStr);
    
    if (entry.checksum !== expectedChecksum) {
      handleCorruption(key, raw, 'checksum mismatch');
      return defaultValue ?? null;
    }

    // Validate data shape if validator provided
    if (validator && !validator(entry.data)) {
      handleCorruption(key, raw, 'validation failed');
      return defaultValue ?? null;
    }

    return entry.data;
  } catch (error) {
    handleCorruption(key, localStorage.getItem(key) || '', `parse error: ${error}`);
    return defaultValue ?? null;
  }
}

/**
 * Set item with integrity protection
 */
export function setItem<T>(
  key: string,
  value: T,
  options: {
    version?: number;
    ttl?: number;
    maxBytes?: number;
    merge?: boolean;
  } = {}
): boolean {
  try {
    const namespace = getNamespace(key);
    const quota = NAMESPACE_QUOTAS[namespace] || NAMESPACE_QUOTAS.default;

    // Merge with existing if requested
    let finalValue = value;
    if (options.merge) {
      const existing = getItem<T>(key);
      if (existing && typeof existing === 'object' && typeof value === 'object') {
        finalValue = { ...existing, ...value } as T;
      }
    }

    const dataStr = JSON.stringify(finalValue);
    const entry: StorageEntry<T> = {
      version: options.version || 1,
      data: finalValue,
      checksum: calculateChecksum(dataStr),
      timestamp: Date.now(),
      ttl: options.ttl
    };

    const entryStr = JSON.stringify(entry);
    const entryBytes = new Blob([entryStr]).size;

    // Check size limit
    if (options.maxBytes && entryBytes > options.maxBytes) {
      console.warn(`[SafeStorage] Entry for ${key} exceeds maxBytes (${entryBytes} > ${options.maxBytes})`);
      return false;
    }

    // Check namespace quota and prune if needed
    const footprint = getStorageFootprint();
    const namespaceBytes = footprint.namespaces[namespace] || 0;
    
    if (namespaceBytes + entryBytes > quota) {
      const targetBytes = quota * 0.8; // Prune to 80% of quota
      pruneLRU(namespace, targetBytes);
    }

    // Atomic write
    localStorage.setItem(key, entryStr);
    return true;
  } catch (error) {
    console.error(`[SafeStorage] Failed to set item ${key}:`, error);
    return false;
  }
}

/**
 * Handle corrupted data
 */
function handleCorruption(key: string, corruptedValue: string, reason: string): void {
  const timestamp = Date.now();
  const corruptKey = `corrupt:${key}:${timestamp}`;
  
  // Keep last 3 corrupted values per key
  const corruptKeys = Object.keys(localStorage)
    .filter(k => k.startsWith(`corrupt:${key}:`))
    .sort()
    .reverse();
  
  // Remove oldest if more than 2
  if (corruptKeys.length >= 2) {
    corruptKeys.slice(2).forEach(k => localStorage.removeItem(k));
  }
  
  // Save corrupted value for debugging
  try {
    localStorage.setItem(corruptKey, JSON.stringify({
      original: corruptedValue.substring(0, 1000), // Limit size
      reason,
      timestamp
    }));
  } catch {
    // If even saving corruption snapshot fails, just log
  }
  
  // Log once (rate limiting handled elsewhere)
  console.warn(`[SafeStorage] Corruption detected in ${key}: ${reason}`);
  
  // Remove corrupted entry
  localStorage.removeItem(key);
}

/**
 * Prune LRU entries in a namespace to target size
 */
export function pruneLRU(namespace: string, targetBytes: number): void {
  const entries: Array<{ key: string; timestamp: number; bytes: number }> = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || getNamespace(key) !== namespace) continue;
    
    const value = localStorage.getItem(key);
    if (!value) continue;
    
    try {
      const entry = JSON.parse(value) as StorageEntry<unknown>;
      entries.push({
        key,
        timestamp: entry.timestamp,
        bytes: new Blob([value]).size
      });
    } catch {
      // Skip invalid entries
    }
  }
  
  // Sort by timestamp (oldest first)
  entries.sort((a, b) => a.timestamp - b.timestamp);
  
  let currentBytes = entries.reduce((sum, e) => sum + e.bytes, 0);
  let prunedCount = 0;
  
  for (const entry of entries) {
    if (currentBytes <= targetBytes) break;
    
    localStorage.removeItem(entry.key);
    currentBytes -= entry.bytes;
    prunedCount++;
  }
  
  if (prunedCount > 0) {
    console.info(`[SafeStorage] Pruned ${prunedCount} entries from ${namespace} namespace`);
    localStorage.setItem(METADATA_KEY, Date.now().toString());
  }
}

/**
 * Migrate data from one version to another
 */
export function migrate<TOld, TNew>(
  key: string,
  fromVersion: number,
  toVersion: number,
  migrator: (old: TOld) => TNew
): boolean {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;

    const entry = JSON.parse(raw) as StorageEntry<TOld>;
    
    if (entry.version !== fromVersion) {
      return false; // Not the expected version
    }

    const migratedData = migrator(entry.data);
    
    return setItem(key, migratedData, { version: toVersion });
  } catch (error) {
    console.error(`[SafeStorage] Migration failed for ${key}:`, error);
    return false;
  }
}

/**
 * Clear all entries in a namespace
 */
export function clearNamespace(namespace: string): void {
  const keysToRemove: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && getNamespace(key) === namespace) {
      keysToRemove.push(key);
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.info(`[SafeStorage] Cleared ${keysToRemove.length} entries from ${namespace}`);
}

/**
 * Check if storage is available and working
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}
