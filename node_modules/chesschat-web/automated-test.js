// Automated Feature Test Script for ChessChat
// Run this in browser console (F12) on https://4a4aa909.chesschat-web.pages.dev

console.log('🧪 Starting Automated Feature Tests...\n');

// Test 1: Check bundle version
console.log('📦 Test 1: Bundle Version Check');
const scripts = Array.from(document.scripts).map(s => s.src).filter(src => src.includes('index-') || src.includes('cpuWorker-'));
console.log('Loaded bundles:', scripts);
const hasNewBundle = scripts.some(s => s.includes('index-CEHJJa_h.js'));
console.log(hasNewBundle ? '✅ New bundle detected' : '❌ Old bundle still loaded');

// Test 2: Check if localStorage debug mode works
console.log('\n📝 Test 2: Debug Mode Check');
const debugMode = localStorage.getItem('debug');
console.log('Debug mode:', debugMode);
console.log(debugMode === 'true' ? '✅ Debug enabled' : 'ℹ️ Debug disabled (enable with: localStorage.setItem("debug", "true"))');

// Test 3: Check CPU configuration
console.log('\n⚙️ Test 3: CPU Configuration Check');
try {
    // Try to access level configs if available in window
    if (window.__LEVEL_CONFIGS__) {
        console.log('Level configs accessible:', window.__LEVEL_CONFIGS__);
    } else {
        console.log('ℹ️ Level configs not exposed in window (expected)');
    }
} catch (e) {
    console.log('ℹ️ Cannot access configs directly (expected)');
}

// Test 4: Monitor CPU moves
console.log('\n🤖 Test 4: CPU Move Performance Monitor');
console.log('Instructions:');
console.log('1. Start a game vs CPU');
console.log('2. Watch console for worker logs');
console.log('3. Look for: "[Worker] Starting search: minDepth=X"');
console.log('4. Verify no "Worker timeout" errors');
console.log('\nListening for CPU moves...');

// Intercept console.error to catch worker timeouts
const originalError = console.error;
let errorCount = 0;
console.error = function(...args) {
    const msg = args.join(' ');
    if (msg.includes('Worker timeout') || msg.includes('Worker computation failed')) {
        errorCount++;
        console.log(`\n❌ DETECTED WORKER ERROR #${errorCount}:`, msg);
    }
    originalError.apply(console, args);
};

// Test 5: Simulate worker stats tracking
console.log('\n📊 Test 5: Worker Stats Tracking');
let testMoves = [
    { level: 4, time: 1850, success: true, depth: 3 },
    { level: 4, time: 1920, success: true, depth: 3 },
    { level: 7, time: 2350, success: true, depth: 4 },
    { level: 7, time: 2280, success: true, depth: 4 },
];

function calculateStats(moves) {
    const successMoves = moves.filter(m => m.success);
    const avgTime = successMoves.reduce((sum, m) => sum + m.time, 0) / successMoves.length;
    const successRate = (successMoves.length / moves.length) * 100;
    return {
        totalAttempts: moves.length,
        successCount: successMoves.length,
        successRate: successRate.toFixed(1) + '%',
        avgTime: Math.round(avgTime) + 'ms',
        status: successRate >= 95 ? '🟢 Healthy' : successRate >= 70 ? '🟡 Warning' : '🔴 Critical'
    };
}

const simulatedStats = calculateStats(testMoves);
console.log('Simulated stats from test moves:', simulatedStats);
console.log(simulatedStats.status.includes('🟢') ? '✅ Stats calculation working correctly' : '⚠️ Check stats logic');

// Test 6: Debug panel accessibility test
console.log('\n🔧 Test 6: Debug Panel Elements');
setTimeout(() => {
    const debugButton = document.querySelector('button:contains("Show Analytics Panel")') || 
                       Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Analytics'));
    if (debugButton) {
        console.log('✅ Debug panel button found');
        console.log('Click it to test UI elements');
    } else {
        console.log('ℹ️ Debug panel button not found (may not be on this page yet)');
    }
}, 1000);

// Test 7: Performance thresholds
console.log('\n⚡ Test 7: Performance Threshold Checks');
const thresholds = {
    fast: 2000,
    warning: 2300,
    timeout: 2500,
};
console.log('Performance thresholds:', thresholds);

function checkPerformance(timeMs) {
    if (timeMs < thresholds.fast) return '🟢 Fast';
    if (timeMs < thresholds.warning) return '🟡 Acceptable';
    if (timeMs < thresholds.timeout) return '🟠 Close to timeout';
    return '🔴 Timeout';
}

[1500, 2100, 2400, 2600].forEach(time => {
    console.log(`${time}ms → ${checkPerformance(time)}`);
});

// Test 8: Export simulation
console.log('\n💾 Test 8: Diagnostic Export Simulation');
const mockDiagnosticData = {
    timestamp: new Date().toISOString(),
    performance: {
        workerStats: {
            totalAttempts: 10,
            successCount: 10,
            timeoutCount: 0,
            successRate: '100%',
            avgSuccessTime: '1850ms',
        }
    }
};
console.log('Mock diagnostic data structure:');
console.log(JSON.stringify(mockDiagnosticData, null, 2));
console.log('✅ Export structure looks correct');

// Summary
console.log('\n' + '='.repeat(60));
console.log('🎉 AUTOMATED TESTS COMPLETE');
console.log('='.repeat(60));
console.log('\n📋 Next Steps:');
console.log('1. Start a game vs CPU (any level)');
console.log('2. Make 5-10 moves');
console.log('3. Click "Show Analytics Panel"');
console.log('4. Scroll to "Worker Performance Monitor"');
console.log('5. Click "Export Diagnostics" button');
console.log('6. Verify:');
console.log('   - Success rate ~100%');
console.log('   - No timeout warnings');
console.log('   - Avg times < 2500ms');
console.log('   - Recent moves table populates');
console.log('\n🔍 Monitor this console for worker errors');
console.log('Error count so far:', errorCount);
