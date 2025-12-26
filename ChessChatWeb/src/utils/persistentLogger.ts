/**
 * Persistent Logger
 * 
 * Saves debug logs to localStorage so they can be accessed even after page crashes.
 * Logs are stored per game session and reset when a new game starts.
 */

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  data?: any;
}

export interface GameSessionLog {
  sessionId: string;
  startTime: number;
  lastUpdate: number;
  gameMode: string;
  cpuLevel?: number;
  logs: LogEntry[];
}

const STORAGE_KEY = 'chesschat_current_session_log';
const MAX_LOGS_PER_SESSION = 500;

class PersistentLogger {
  private currentSession: GameSessionLog | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private isDirty: boolean = false;

  /**
   * Start a new game session - resets all logs
   */
  startNewSession(gameMode: string, cpuLevel?: number): string {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentSession = {
      sessionId,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      gameMode,
      cpuLevel,
      logs: []
    };

    this.saveToStorageNow();
    console.log(`[PersistentLogger] Started new session: ${sessionId}`);
    
    return sessionId;
  }

  /**
   * Add a log entry to the current session
   */
  log(level: LogEntry['level'], message: string, data?: any): void {
    if (!this.currentSession) {
      // Initialize a default session if none exists
      this.startNewSession('unknown');
    }

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      message,
      data
    };

    this.currentSession!.logs.push(entry);
    this.currentSession!.lastUpdate = Date.now();

    // Limit log size to prevent storage overflow
    if (this.currentSession!.logs.length > MAX_LOGS_PER_SESSION) {
      this.currentSession!.logs.shift(); // Remove oldest log
    }

    // Mark as dirty and schedule deferred save (batching)
    this.isDirty = true;
    this.deferredSave();

    // Also log to console for debugging (but don't log data in production)
    const consoleMethod = level === 'error' ? console.error : 
                         level === 'warn' ? console.warn : 
                         console.log;
    consoleMethod(`[GameLog:${level}]`, message, data ? '(with data)' : '');
  }

  /**
   * Convenience methods
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Get the current session logs
   */
  getCurrentSession(): GameSessionLog | null {
    if (!this.currentSession) {
      this.loadFromStorage();
    }
    return this.currentSession;
  }

  /**
   * Get logs as formatted text
   */
  getLogsAsText(): string {
    if (!this.currentSession) {
      this.loadFromStorage();
    }

    if (!this.currentSession) {
      return 'No logs available';
    }

    const header = `
=== ChessChat Game Session Log ===
Session ID: ${this.currentSession.sessionId}
Start Time: ${new Date(this.currentSession.startTime).toLocaleString()}
Game Mode: ${this.currentSession.gameMode}
${this.currentSession.cpuLevel ? `CPU Level: ${this.currentSession.cpuLevel}` : ''}
Total Logs: ${this.currentSession.logs.length}
================================

`;

    const logLines = this.currentSession.logs.map(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const dataStr = entry.data ? ` | Data: ${JSON.stringify(entry.data)}` : '';
      return `[${time}] [${entry.level.toUpperCase()}] ${entry.message}${dataStr}`;
    }).join('\n');

    return header + logLines;
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.currentSession = null;
    this.isDirty = false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[PersistentLogger] Failed to clear storage:', error);
    }
  }

  /**
   * Deferred save - batches multiple log calls into single storage write
   * This prevents blocking the main thread during rapid logging
   */
  private deferredSave(): void {
    if (this.saveTimer) {
      return; // Already scheduled
    }

    // Save after 100ms of inactivity (batching rapid logs)
    this.saveTimer = setTimeout(() => {
      if (this.isDirty) {
        this.saveToStorageNow();
        this.isDirty = false;
      }
      this.saveTimer = null;
    }, 100);
  }

  /**
   * Force immediate save to localStorage
   */
  private saveToStorageNow(): void {
    if (!this.currentSession) return;

    try {
      // CRITICAL FIX: Use immediate synchronous save to avoid event loop blocking
      // The async requestIdleCallback was causing CPU moves to hang in production
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSession));
      } catch (error) {
        console.error('[PersistentLogger] Failed to save to storage:', error);
        // If storage is full, try to clear old logs and retry
        if (this.currentSession && this.currentSession.logs.length > 100) {
          this.currentSession.logs = this.currentSession.logs.slice(-100);
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentSession));
          } catch (retryError) {
            console.error('[PersistentLogger] Failed to save even after trimming:', retryError);
          }
        }
      }
    } catch (error) {
      console.error('[PersistentLogger] Failed to schedule save:', error);
    }
  }

  /**
   * Load session from localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.currentSession = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[PersistentLogger] Failed to load from storage:', error);
      this.currentSession = null;
    }
  }

  /**
   * Get statistics about the current session
   */
  getSessionStats() {
    if (!this.currentSession) {
      this.loadFromStorage();
    }

    if (!this.currentSession) {
      return null;
    }

    const logs = this.currentSession.logs;
    return {
      totalLogs: logs.length,
      errors: logs.filter(l => l.level === 'error').length,
      warnings: logs.filter(l => l.level === 'warn').length,
      info: logs.filter(l => l.level === 'info').length,
      debug: logs.filter(l => l.level === 'debug').length,
      duration: Date.now() - this.currentSession.startTime,
      lastUpdate: this.currentSession.lastUpdate
    };
  }
}

// Export singleton instance
export const persistentLogger = new PersistentLogger();
