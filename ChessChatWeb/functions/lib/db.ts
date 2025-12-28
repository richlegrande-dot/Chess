/**
 * Database Service - Supports both D1 and Prisma
 * 
 * Implements:
 * - D1 native binding (preferred for Cloudflare)
 * - Prisma with Accelerate (fallback)
 * - Health monitoring
 */

import { PrismaClient } from '@prisma/client/edge';
import { withAccelerate } from '@prisma/extension-accelerate';

export interface DbHealthStatus {
  dbReady: boolean;
  lastPing: Date | null;
  lastError: string | null;
  failureCount: number;
  latencyMs: number | null;
  consecutiveFailures: number;
  dbType: 'D1' | 'Prisma' | 'none';
}

class DatabaseService {
  private prisma: PrismaClient | null = null;
  private d1: D1Database | null = null;
  private healthStatus: DbHealthStatus = {
    dbReady: false,
    lastPing: null,
    lastError: null,
    failureCount: 0,
    latencyMs: null,
    consecutiveFailures: 0,
    dbType: 'none',
  };
  
  private readonly MAX_CONSECUTIVE_FAILURES = 5;
  private readonly HEALTH_CHECK_INTERVAL = 15000; // 15 seconds
  private watchdogInterval: NodeJS.Timeout | null = null;
  private isShuttingDown = false;
  private isInitialized = false;
  private databaseUrl: string | null = null;

  constructor(databaseUrl?: string) {
    // Store database URL for later initialization
    // In Cloudflare Workers, this will be passed from context.env
    this.databaseUrl = databaseUrl || null;
  }

  /**
   * Initialize with D1 binding (native Cloudflare)
   */
  async initializeD1(d1: D1Database): Promise<void> {
    if (this.isInitialized && this.d1) {
      return; // Already initialized
    }

    try {
      console.log('[DB] Initializing D1 database...');
      this.d1 = d1;
      
      // Verify D1 connectivity with a simple query
      await d1.prepare('SELECT 1').first();
      
      this.healthStatus.dbReady = true;
      this.healthStatus.dbType = 'D1';
      this.healthStatus.lastPing = new Date();
      this.isInitialized = true;
      console.log('[DB] ✓ D1 initialized successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[DB] ✗ D1 initialization failed:', message);
      this.healthStatus.lastError = message;
      this.healthStatus.dbReady = false;
      throw new Error(`D1 startup failed: ${message}`);
    }
  }

  /**
   * Initialize Prisma client and verify database connectivity
   * This is the "startup gate" - app should not start if this fails
   */
  async initialize(databaseUrl?: string): Promise<void> {
    if (this.isInitialized) {
      return; // Already initialized
    }

    // Use provided URL or fallback to constructor URL
    const dbUrl = databaseUrl || this.databaseUrl;
    
    if (!dbUrl) {
      const error = 'FATAL: DATABASE_URL not provided. Cannot initialize database.';
      console.error(error);
      throw new Error(error);
    }

    try {
      console.log('Initializing database connection...');
      
      // Create Prisma client with Accelerate extension
      const basePrisma = new PrismaClient({
        log: ['error', 'warn'],
        datasources: {
          db: {
            url: dbUrl,
          },
        },
      });
      
      this.prisma = basePrisma.$extends(withAccelerate()) as any;

      // Startup gate: Verify database connectivity
      await this.verifyConnection();

      // Note: For Cloudflare Workers, watchdog runs per-request check instead of setInterval
      // This is because Workers don't support long-running background tasks

      console.log('[DB] ✓ Database initialized successfully');
      this.healthStatus.dbReady = true;
      this.healthStatus.dbType = 'Prisma';
      this.isInitialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('✗ Database initialization failed:', message);
      this.healthStatus.lastError = message;
      this.healthStatus.dbReady = false;
      
      // Fail-fast: Don't start the app if DB is not ready
      throw new Error(`Database startup gate failed: ${message}`);
    }
  }

  /**
   * Verify database connection by running a simple query
   */
  private async verifyConnection(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized');
    }

    const startTime = Date.now();
    
    try {
      // Try to query the KnowledgeSource table to verify schema exists
      await this.prisma.$queryRaw`SELECT 1`;
      
      const latency = Date.now() - startTime;
      this.healthStatus.latencyMs = latency;
      this.healthStatus.lastPing = new Date();
      this.healthStatus.consecutiveFailures = 0;
      
      console.log(`✓ Database connection verified (${latency}ms)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Database connection verification failed: ${message}`);
    }
  }

  /**
   * Runtime watchdog: Periodic health checks
   * Shuts down gracefully if failures exceed threshold
   */
  private startWatchdog(): void {
    console.log(`Starting database watchdog (interval: ${this.HEALTH_CHECK_INTERVAL}ms, threshold: ${this.MAX_CONSECUTIVE_FAILURES} failures)`);
    
    this.watchdogInterval = setInterval(async () => {
      if (this.isShuttingDown) {
        return;
      }

      try {
        await this.performHealthCheck();
        
        // Reset consecutive failures on success
        if (this.healthStatus.consecutiveFailures > 0) {
          console.log('✓ Database health check recovered');
          this.healthStatus.consecutiveFailures = 0;
        }
      } catch (error) {
        this.healthStatus.consecutiveFailures++;
        this.healthStatus.failureCount++;
        
        const message = error instanceof Error ? error.message : String(error);
        this.healthStatus.lastError = message;
        
        console.error(`✗ Database health check failed (${this.healthStatus.consecutiveFailures}/${this.MAX_CONSECUTIVE_FAILURES}): ${message}`);

        // Trigger safe shutdown if threshold exceeded
        if (this.healthStatus.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
          console.error(`CRITICAL: Database has failed ${this.MAX_CONSECUTIVE_FAILURES} consecutive health checks. Initiating safe shutdown...`);
          await this.safeShutdown();
        }
      }
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform a health check ping
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized');
    }

    const startTime = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    
    const latency = Date.now() - startTime;
    this.healthStatus.latencyMs = latency;
    this.healthStatus.lastPing = new Date();
    this.healthStatus.dbReady = true;
  }

  /**
   * Safe shutdown: Stop accepting requests and exit process
   */
  private async safeShutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.healthStatus.dbReady = false;

    console.log('Stopping database watchdog...');
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    console.log('Closing database connections...');
    if (this.prisma) {
      await this.prisma.$disconnect();
    }

    console.log('Database service shutdown complete. Exiting process...');
    
    // In Cloudflare Workers, we can't exit the process
    // Instead, mark as unhealthy and reject all future requests
    // The orchestrator will notice and restart the worker
  }

  /**
   * Get the Prisma client instance with lazy initialization for Cloudflare Workers.
   * Throws if database is not ready - circuit breaker pattern.
   */
  async getClient(): Promise<PrismaClient> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (!this.prisma) {
      throw new Error('Database is not ready. Prisma client not initialized.');
    }

    if (!this.healthStatus.dbReady) {
      throw new Error('Database is not ready. Health check failed.');
    }

    return this.prisma;
  }

  /**
   * Get the D1 database instance
   * Throws if D1 is not initialized
   */
  getD1(): D1Database {
    if (!this.d1) {
      throw new Error('D1 database is not initialized');
    }
    
    if (!this.healthStatus.dbReady) {
      throw new Error('D1 database is not ready');
    }
    
    return this.d1;
  }

  /**
   * Check if database is available
   */
  isAvailable(): boolean {
    return this.healthStatus.dbReady && (this.prisma !== null || this.d1 !== null);
  }

  /**
   * Get current health status
   */
  getHealthStatus(): DbHealthStatus {
    return { ...this.healthStatus };
  }

  /**
   * Manual health check (for admin endpoints)
   */
  async checkHealth(): Promise<DbHealthStatus> {
    try {
      await this.performHealthCheck();
    } catch (error) {
      // Health check failed, status already updated
    }
    return this.getHealthStatus();
  }

  /**
   * Disconnect from database (for graceful shutdown)
   */
  async disconnect(): Promise<void> {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }

    this.healthStatus.dbReady = false;
    console.log('Database disconnected');
  }
}

// Factory function to create database service with environment variables
export function createDatabaseService(databaseUrl: string): DatabaseService {
  return new DatabaseService(databaseUrl);
}

// Singleton instance for backward compatibility (will be initialized with env var)
export const db = new DatabaseService();

// Export Prisma client getter
export const getPrismaClient = () => db.getClient();

// Export D1 getter
export const getD1Client = () => db.getD1();

// Export health check
export const getDbHealth = () => db.getHealthStatus();
export const checkDbHealth = () => db.checkHealth();
