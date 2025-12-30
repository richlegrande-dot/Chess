/**
 * Automated test to verify gameStore is properly exposed to window
 * Run this in the browser console after the app loads
 */

console.log('🔍 Testing gameStore availability...\n');

const tests = [];
let allPassed = true;

// Test 1: window object exists
const test1 = typeof window !== 'undefined';
tests.push({ name: 'window object exists', pass: test1 });
if (!test1) allPassed = false;

// Test 2: gameStore exists on window
const test2 = typeof window.gameStore !== 'undefined';
tests.push({ name: 'window.gameStore exists', pass: test2 });
if (!test2) allPassed = false;

// Test 3: gameStore is a function (Zustand store)
const test3 = typeof window.gameStore === 'function';
tests.push({ name: 'window.gameStore is a function', pass: test3 });
if (!test3) allPassed = false;

// Test 4: gameStore.getState() works
let test4 = false;
let stateSnapshot = null;
try {
    if (window.gameStore) {
        stateSnapshot = window.gameStore.getState();
        test4 = true;
    }
} catch (e) {
    console.error('getState() error:', e);
}
tests.push({ name: 'window.gameStore.getState() works', pass: test4 });
if (!test4) allPassed = false;

// Test 5: debugInfo exists in state
let test5 = false;
try {
    if (window.gameStore) {
        const state = window.gameStore.getState();
        test5 = state && typeof state.debugInfo !== 'undefined';
    }
} catch (e) {}
tests.push({ name: 'debugInfo exists in state', pass: test5 });
if (!test5) allPassed = false;

// Test 6: logWorkerCall function exists
let test6 = false;
try {
    if (window.gameStore) {
        const state = window.gameStore.getState();
        test6 = state && typeof state.logWorkerCall === 'function';
    }
} catch (e) {}
tests.push({ name: 'logWorkerCall function exists', pass: test6 });
if (!test6) allPassed = false;

// Print results
console.log('='.repeat(50));
tests.forEach(test => {
    const icon = test.pass ? '✅' : '❌';
    console.log(`${icon} ${test.name}`);
});
console.log('='.repeat(50));

if (allPassed) {
    console.log('\n🎉 SUCCESS: All tests passed!');
    console.log('✅ gameStore is properly exposed to window');
    console.log('✅ Logging and diagnostics should now work');
    console.log('\nYou can now test in CoachingMode:');
    console.log('  - CPU moves will log to gameStore');
    console.log('  - No more "gameStore not available" errors');
    console.log('  - Worker calls will be visible in Admin Portal');
} else {
    console.error('\n❌ FAILED: Some tests did not pass');
    console.error('gameStore may not be properly initialized');
    
    if (!test2) {
        console.error('\nDEBUG: window.gameStore is undefined');
        console.error('Check that App.tsx imports and exposes useGameStore');
    }
}

console.log('\n📋 State snapshot:', stateSnapshot ? 'Available' : 'Not available');
if (stateSnapshot && stateSnapshot.debugInfo) {
    console.log('📊 Worker calls logged:', stateSnapshot.debugInfo.workerCalls?.length || 0);
}

// Return result for programmatic use
allPassed;
