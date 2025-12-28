/**
 * Frontend Diagnostics Utility
 * 
 * Exposes diagnostic functions to window.chessChatDiagnostics for debugging
 * User can run: window.chessChatDiagnostics.checkWorkerCalls()
 */

import { useGameStore } from '../store/gameStore';

export interface WorkerCallDiagnostics {
  totalCalls: number;
  calls: any[];
  lastCall: any | null;
  storeInitialized: boolean;
  debugInfoExists: boolean;
}

export const chessChatDiagnostics = {
  /**
   * Check Worker call storage status
   * Usage in DevTools: window.chessChatDiagnostics.checkWorkerCalls()
   */
  checkWorkerCalls(): WorkerCallDiagnostics {
    try {
      const store = useGameStore.getState();
      const workerCalls = store?.debugInfo?.workerCalls || [];
      
      const result: WorkerCallDiagnostics = {
        totalCalls: workerCalls.length,
        calls: workerCalls,
        lastCall: workerCalls[workerCalls.length - 1] || null,
        storeInitialized: !!store,
        debugInfoExists: !!store?.debugInfo
      };

      console.group('🔍 Worker Calls Diagnostic');
      console.log('Store Initialized:', result.storeInitialized);
      console.log('Debug Info Exists:', result.debugInfoExists);
      console.log('Total Worker Calls:', result.totalCalls);
      
      if (result.totalCalls > 0) {
        console.log('Last Call:', result.lastCall);
        console.table(workerCalls.slice(-5).map(call => ({
          timestamp: new Date(call.timestamp).toLocaleTimeString(),
          endpoint: call.endpoint,
          method: call.method,
          success: call.success ? '✓' : '✗',
          latency: `${call.latencyMs}ms`
        })));
      } else {
        console.warn('⚠️ No Worker calls logged yet');
        console.log('This means either:');
        console.log('  1. No chess moves have been made yet');
        console.log('  2. Frontend is not receiving workerCallLog in API responses');
        console.log('  3. logWorkerCall() is not being called');
      }
      
      console.groupEnd();
      
      return result;
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      return {
        totalCalls: 0,
        calls: [],
        lastCall: null,
        storeInitialized: false,
        debugInfoExists: false
      };
    }
  },

  /**
   * Check if the Worker call log is incremented after a move
   * Usage: await window.chessChatDiagnostics.testWorkerCallLogging()
   */
  async testWorkerCallLogging(): Promise<{ 
    before: number; 
    after: number; 
    incremented: boolean;
    message: string;
  }> {
    const before = this.checkWorkerCalls();
    
    console.log('📊 Test: Make a chess move and check if Worker call is logged...');
    console.log('Current count:', before.totalCalls);
    
    // Wait 5 seconds for user to make a move
    console.log('⏱️ Waiting 5 seconds for you to make a move...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const after = this.checkWorkerCalls();
    const incremented = after.totalCalls > before.totalCalls;
    
    const result = {
      before: before.totalCalls,
      after: after.totalCalls,
      incremented,
      message: incremented 
        ? `✅ SUCCESS: Worker call logged (${before.totalCalls} → ${after.totalCalls})`
        : `❌ FAILED: No new Worker call (still ${before.totalCalls})`
    };
    
    console.group('🎯 Test Result');
    console.log(result.message);
    console.groupEnd();
    
    return result;
  },

  /**
   * Get full game store state
   */
  getGameStoreState() {
    const state = useGameStore.getState();
    console.log('📦 Full Game Store State:', state);
    return state;
  },

  /**
   * Clear Worker call logs (for testing)
   */
  clearWorkerCalls() {
    useGameStore.setState(state => ({
      debugInfo: {
        ...state.debugInfo,
        workerCalls: []
      }
    }));
    console.log('🧹 Worker calls cleared');
  },

  /**
   * Simulate a Worker call (for testing)
   */
  simulateWorkerCall() {
    const store = useGameStore.getState();
    store.logWorkerCall({
      endpoint: '/assist/chess-move',
      method: 'POST',
      success: true,
      latencyMs: 42,
      request: { test: true },
      response: { test: true }
    });
    console.log('✨ Simulated Worker call logged');
    return this.checkWorkerCalls();
  },

  /**
   * Test Admin Portal API endpoint
   */
  async testAdminPortalAPI(): Promise<any> {
    const password = localStorage.getItem('adminPassword');
    
    if (!password) {
      console.warn('⚠️ No admin password in localStorage');
      console.log('Set it with: localStorage.setItem("adminPassword", "Qwerty123")');
      return null;
    }

    console.log('🔐 Testing Admin Portal API with stored password...');

    try {
      const response = await fetch('/api/admin/worker-calls?limit=10', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      });

      console.log('Response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ API Response:', data);
        return data;
      } else {
        const text = await response.text();
        console.error('❌ API Error:', response.status, text);
        return null;
      }
    } catch (error) {
      console.error('❌ Fetch error:', error);
      return null;
    }
  },

  /**
   * Show all available diagnostic commands
   */
  help() {
    console.group('🛠️ ChessChat Diagnostics Help');
    console.log('Available commands:');
    console.log('');
    console.log('1. window.chessChatDiagnostics.checkWorkerCalls()');
    console.log('   → Check Worker call storage status');
    console.log('');
    console.log('2. await window.chessChatDiagnostics.testWorkerCallLogging()');
    console.log('   → Test if Worker calls are being logged (make a move within 5s)');
    console.log('');
    console.log('3. window.chessChatDiagnostics.simulateWorkerCall()');
    console.log('   → Add a test Worker call to verify storage');
    console.log('');
    console.log('4. window.chessChatDiagnostics.getGameStoreState()');
    console.log('   → View full game store state');
    console.log('');
    console.log('5. window.chessChatDiagnostics.clearWorkerCalls()');
    console.log('   → Clear all Worker call logs');
    console.log('');
    console.log('6. await window.chessChatDiagnostics.testAdminPortalAPI()');
    console.log('   → Test Admin Portal API endpoint');
    console.log('');
    console.groupEnd();
  }
};

// Expose to window object for easy console access
if (typeof window !== 'undefined') {
  (window as any).chessChatDiagnostics = chessChatDiagnostics;
  console.log('🛠️ ChessChat Diagnostics loaded. Type window.chessChatDiagnostics.help() for commands');
}
