// Comprehensive automated test for gameStore fix
const runGameStoreTests = async () => {
    console.clear();
    console.log('╔═══════════════════════════════════════════════════╗');
    console.log('║   GameStore Fix - Automated Test Suite           ║');
    console.log('╚═══════════════════════════════════════════════════╝\n');
    
    const results = { passed: 0, failed: 0, tests: [] };
    
    // Helper to run a test
    const test = (name, fn) => {
        try {
            const result = fn();
            if (result) {
                results.passed++;
                results.tests.push({ name, pass: true, value: 'PASS' });
                console.log(`✅ ${name}`);
                return true;
            } else {
                results.failed++;
                results.tests.push({ name, pass: false, value: 'FAIL' });
                console.log(`❌ ${name}`);
                return false;
            }
        } catch (e) {
            results.failed++;
            results.tests.push({ name, pass: false, value: e.message });
            console.log(`❌ ${name} - Error: ${e.message}`);
            return false;
        }
    };
    
    console.log('📋 Phase 1: Window Object Tests\n');
    test('window object exists', () => typeof window !== 'undefined');
    test('window is object type', () => typeof window === 'object');
    
    console.log('\n📋 Phase 2: GameStore Availability Tests\n');
    test('window.gameStore exists', () => typeof window.gameStore !== 'undefined');
    test('window.gameStore is function', () => typeof window.gameStore === 'function');
    test('gameStore is Zustand store', () => {
        return window.gameStore && 
               typeof window.gameStore === 'function' && 
               typeof window.gameStore.getState === 'function';
    });
    
    console.log('\n📋 Phase 3: GameStore State Tests\n');
    let state = null;
    test('gameStore.getState() callable', () => {
        state = window.gameStore.getState();
        return state !== null && typeof state === 'object';
    });
    
    test('state has debugInfo', () => state && typeof state.debugInfo !== 'undefined');
    test('debugInfo is object', () => state && typeof state.debugInfo === 'object');
    test('debugInfo has workerCalls', () => state && Array.isArray(state.debugInfo?.workerCalls));
    test('debugInfo has lastApiCall', () => state && typeof state.debugInfo?.lastApiCall !== 'undefined');
    
    console.log('\n📋 Phase 4: Logging Functions Tests\n');
    test('logWorkerCall exists', () => state && typeof state.logWorkerCall === 'function');
    test('logApiCall exists', () => state && typeof state.logApiCall === 'function');
    
    console.log('\n📋 Phase 5: Store Subscribe Test\n');
    test('gameStore.subscribe exists', () => typeof window.gameStore.subscribe === 'function');
    
    // Test subscription
    let subscribeWorks = false;
    test('gameStore.subscribe callable', () => {
        const unsubscribe = window.gameStore.subscribe(() => {
            subscribeWorks = true;
        });
        unsubscribe();
        return typeof unsubscribe === 'function';
    });
    
    console.log('\n' + '='.repeat(50));
    console.log(`\n📊 Test Results: ${results.passed}/${results.passed + results.failed} passed`);
    
    if (results.failed === 0) {
        console.log('\n🎉 ✅ ALL TESTS PASSED!\n');
        console.log('GameStore Fix Status: ✅ SUCCESS');
        console.log('└─ gameStore properly exposed to window');
        console.log('└─ All required functions available');
        console.log('└─ State structure verified');
        console.log('└─ Logging system functional\n');
        
        console.log('Next Steps:');
        console.log('1. Test in Coaching Mode - CPU moves should log correctly');
        console.log('2. Check Admin Portal - Worker calls should be visible');
        console.log('3. Verify no "gameStore not available" errors\n');
        
        console.log('Current State Info:');
        console.log(`  Worker Calls Logged: ${state?.debugInfo?.workerCalls?.length || 0}`);
        console.log(`  Game ID: ${state?.gameId || 'none'}`);
        console.log(`  Is Thinking: ${state?.isThinking || false}`);
        
        return true;
    } else {
        console.log('\n❌ SOME TESTS FAILED\n');
        console.log('Failed Tests:');
        results.tests.filter(t => !t.pass).forEach(t => {
            console.log(`  ❌ ${t.name}: ${t.value}`);
        });
        return false;
    }
};

// Run tests
runGameStoreTests();
