/**
 * Timing Instrumentation for Performance Diagnosis
 * 
 * Usage:
 *   const t = timed(requestId);
 *   await someAsyncWork();
 *   t.log('segment_name', additionalData);
 */

export interface TimingData {
  requestId: string;
  segment: string;
  ms: number;
  [key: string]: any;
}

export function timed(requestId: string) {
  const startTime = Date.now();
  let lastMark = startTime;
  
  return {
    /**
     * Log timing for a segment
     */
    log(segment: string, data: Record<string, any> = {}) {
      const now = Date.now();
      const segmentMs = now - lastMark;
      const totalMs = now - startTime;
      
      const logData: TimingData = {
        requestId,
        segment,
        ms: segmentMs,
        totalMs,
        ...data
      };
      
      console.log(`[L3][timing] ${JSON.stringify(logData)}`);
      lastMark = now;
      
      return segmentMs;
    },
    
    /**
     * Get elapsed time without logging
     */
    elapsed() {
      return Date.now() - startTime;
    },
    
    /**
     * Mark current time for next segment
     */
    mark() {
      lastMark = Date.now();
    }
  };
}
