// Production Verification Script for GameStore Fix
// Run this in browser console at https://chesschat.uk

console.clear();
console.log('%c════════════════════════════════════════════════════════', 'color: #10b981; font-weight: bold');
console.log('%c  GameStore Fix - Production Verification              ', 'color: #10b981; font-weight: bold');
console.log('%c════════════════════════════════════════════════════════', 'color: #10b981; font-weight: bold');
console.log('');

const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            results.passed++;
            results.tests.push({ name, pass: true });
            console.log(`%c✅ ${name}`, 'color: #10b981');
            return true;
        } else {
            results.failed++;
            results.tests.push({ name, pass: false });
            console.log(`%c❌ ${name}`, 'color: #ef4444');
            return false;
        }
    } catch (e) {
        results.failed++;
        results.tests.push({ name, pass: false, error: e.message });
        console.log(`%c❌ ${name} - ${e.message}`, 'color: #ef4444');
        return false;
    }
}

console.log('%c📋 Phase 1: GameStore Availability', 'color: #3b82f6; font-weight: bold');
test('window.gameStore exists', () => typeof window.gameStore !== 'undefined');
test('window.gameStore is function', () => typeof window.gameStore === 'function');
test('gameStore.getState() works', () => {
    const state = window.gameStore.getState();
    return state !== null && typeof state === 'object';
});

console.log('');
console.log('%c📋 Phase 2: Logging Infrastructure', 'color: #3b82f6; font-weight: bold');
const state = window.gameStore?.getState();
test('debugInfo exists', () => state && typeof state.debugInfo !== 'undefined');
test('debugInfo.workerCalls is array', () => state && Array.isArray(state.debugInfo?.workerCalls));
test('logWorkerCall function exists', () => state && typeof state.logWorkerCall === 'function');

console.log('');
console.log('%c📋 Phase 3: Current State Inspection', 'color: #3b82f6; font-weight: bold');
if (state) {
    console.log('  Worker Calls Logged:', state.debugInfo?.workerCalls?.length || 0);
    console.log('  Game ID:', state.gameId || 'none');
    console.log('  Is Thinking:', state.isThinking || false);
    
    if (state.debugInfo?.workerCalls?.length > 0) {
        const lastCall = state.debugInfo.workerCalls[state.debugInfo.workerCalls.length - 1];
        console.log('');
        console.log('%c  Last Worker Call:', 'font-weight: bold');
        console.log('    timeMs:', lastCall.request?.timeMs);
        console.log('    cpuLevel:', lastCall.request?.cpuLevel);
        console.log('    mode:', lastCall.diagnostics?.mode);
    }
}

console.log('');
console.log('%c════════════════════════════════════════════════════════', 'color: #10b981');
const total = results.passed + results.failed;
console.log(`%c  Results: ${results.passed}/${total} tests passed`, 
    results.failed === 0 ? 'color: #10b981; font-weight: bold' : 'color: #ef4444; font-weight: bold');
console.log('%c════════════════════════════════════════════════════════', 'color: #10b981');

if (results.failed === 0) {
    console.log('');
    console.log('%c🎉 SUCCESS: GameStore fix verified in production!', 'color: #10b981; font-size: 1.2rem; font-weight: bold');
    console.log('');
    console.log('%cNext: Test in Coaching Mode', 'color: #3b82f6; font-weight: bold');
    console.log('  1. Click "📚 Coaching Mode"');
    console.log('  2. Start a game vs CPU');
    console.log('  3. Make a move');
    console.log('  4. Check console for Worker logs');
    console.log('  5. Run: window.gameStore.getState().debugInfo.workerCalls');
} else {
    console.log('');
    console.log('%c❌ FAILED: Some tests did not pass', 'color: #ef4444; font-size: 1.2rem; font-weight: bold');
    console.log('');
    console.log('Failed tests:');
    results.tests.filter(t => !t.pass).forEach(t => {
        console.log(`  ❌ ${t.name}${t.error ? ': ' + t.error : ''}`);
    });
}

console.log('');
return results.failed === 0;
