// Bootstrap script to load ES modules safely in production
console.log('🚀 BOOTSTRAP_START - Non-module script executing');

// Immediate feedback
const diagnostic = document.getElementById('immediate-diagnostic');
if (diagnostic) {
  diagnostic.innerHTML = `
    <div style="font-size: 2rem; margin-bottom: 1rem;">⚡</div>
    <div>Loading ES Modules...</div>
    <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">Bootstrap script active</div>
  `;
}

// Try to load the main module dynamically
async function loadMainModule() {
  try {
    console.log('🟡 BOOTSTRAP: Attempting to load main module');
    
    // Get the main script src from the existing script tag
    const mainScript = document.querySelector('script[type="module"][src*="index-"]');
    const mainScriptSrc = mainScript ? mainScript.src : null;
    
    if (!mainScriptSrc) {
      throw new Error('Could not find main module script');
    }
    
    console.log('🟡 BOOTSTRAP: Found main script:', mainScriptSrc);
    
    if (diagnostic) {
      diagnostic.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 1rem;">🔄</div>
        <div>Importing Main Module...</div>
        <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">Dynamic import attempt</div>
      `;
    }
    
    // Try dynamic import of the main module
    const module = await import(mainScriptSrc);
    console.log('✅ BOOTSTRAP: Main module loaded successfully:', module);
    
    if (diagnostic) {
      diagnostic.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 1rem;">✅</div>
        <div>Module Loaded Successfully</div>
        <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem;">Starting React app...</div>
      `;
      
      // Hide after success
      setTimeout(() => {
        if (diagnostic.parentNode) {
          diagnostic.remove();
        }
      }, 1000);
    }
    
  } catch (error) {
    console.error('❌ BOOTSTRAP: Failed to load main module:', error);
    
    if (diagnostic) {
      diagnostic.innerHTML = `
        <div style="font-size: 2rem; margin-bottom: 1rem; color: #ff4444;">💥</div>
        <div style="color: #ff4444;">Module Import Failed</div>
        <div style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.5rem; max-width: 300px;">
          ${error.message}
        </div>
        <button onclick="location.reload()" style="padding: 8px 16px; background: #fff; color: #000; border: none; border-radius: 4px; cursor: pointer; margin-top: 1rem;">Retry</button>
        <button onclick="window.location.href='/fallback.html'" style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid #fff; border-radius: 4px; cursor: pointer; margin-top: 1rem; margin-left: 8px;">Compatibility Mode</button>
      `;
    }
  }
}

// Start loading after a brief delay
setTimeout(loadMainModule, 100);