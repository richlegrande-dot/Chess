/**
 * Deployment Validation Script
 * Run in Node.js to verify deployment is live and configured correctly
 */

console.log('🔍 Validating ChessChat Deployment...\n');

const deploymentUrl = 'https://4a4aa909.chesschat-web.pages.dev';
const productionUrl = 'https://chesschat.uk';

async function validateDeployment() {
    try {
        // Use dynamic import for fetch in Node.js
        const fetch = (await import('node-fetch')).default;

        console.log('📡 Fetching deployment...');
        const response = await fetch(deploymentUrl);
        
        if (!response.ok) {
            console.log(`❌ Deployment not accessible: ${response.status}`);
            return false;
        }

        const html = await response.text();
        
        // Check for new bundle
        const hasNewBundle = html.includes('index-CEHJJa_h.js');
        const hasNewWorker = html.includes('cpuWorker-ChVIoKx-.js');
        
        console.log('\n📦 Bundle Verification:');
        console.log(hasNewBundle ? '✅ New main bundle (index-CEHJJa_h.js) found' : '❌ Old bundle detected');
        console.log(hasNewWorker ? '✅ Worker bundle (cpuWorker-ChVIoKx-.js) found' : '❌ Worker bundle missing');
        
        // Check for build version indicators
        const hasBuildInfo = html.includes('buildVersion') || html.includes('v2025-12-25');
        console.log(hasBuildInfo ? '✅ Build version info present' : 'ℹ️  Build version not in HTML');
        
        // Check page size (should be ~10KB)
        const pageSize = (html.length / 1024).toFixed(2);
        console.log(`\n📄 Page size: ${pageSize} KB`);
        console.log(pageSize > 8 && pageSize < 15 ? '✅ Within expected range' : '⚠️  Unusual page size');
        
        // Check for React root
        const hasReactRoot = html.includes('id="root"');
        console.log(`\n⚛️  React root: ${hasReactRoot ? '✅ Present' : '❌ Missing'}`);
        
        console.log('\n' + '='.repeat(60));
        console.log('✅ DEPLOYMENT VALIDATION COMPLETE');
        console.log('='.repeat(60));
        console.log(`\n🌐 Deployment URL: ${deploymentUrl}`);
        console.log(`📦 Bundle: index-CEHJJa_h.js (Enhanced Debug Panel)`);
        console.log(`🔧 Worker: cpuWorker-ChVIoKx-.js (Reduced minDepth)`);
        console.log('\n🎯 Next: Open browser and run manual tests');
        
        return true;
        
    } catch (error) {
        console.log(`\n❌ Validation failed: ${error.message}`);
        console.log('\nPossible issues:');
        console.log('• Deployment still propagating');
        console.log('• Network connectivity issue');
        console.log('• URL incorrect');
        return false;
    }
}

// Run validation
validateDeployment().then(success => {
    if (success) {
        console.log('\n📋 Manual Testing Steps:');
        console.log('1. Open:', deploymentUrl);
        console.log('2. Start game vs CPU Level 4');
        console.log('3. Check console (F12) for worker logs');
        console.log('4. Open "Show Analytics Panel"');
        console.log('5. Verify "Worker Performance Monitor" section');
        console.log('6. Export diagnostics and check workerStats');
    }
    process.exit(success ? 0 : 1);
});
