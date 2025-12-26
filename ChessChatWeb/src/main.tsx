import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

// IMMEDIATE SCRIPT LOAD SIGNAL
(window as any).mainScriptLoaded = true;

// BUILD VERSION CHECK
console.log('🔧 CHESSCHAT BUILD: 2025-12-25-PERFORMANCE-FIX');
console.log('✅ Opening book integration, feature parameters, beam search optimization');

// IMMEDIATE DOM FEEDBACK - Prove JavaScript is executing
console.log('🚀 MAIN_TSX_START - JavaScript execution began');

// Clear the immediate diagnostic and set up our debug status
const immediateDiagnostic = document.getElementById('immediate-diagnostic');
if (immediateDiagnostic) {
  immediateDiagnostic.remove();
}

document.body.style.background = 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)';

// Add debug status to existing root div
const existingRoot = document.getElementById('root');
if (existingRoot) {
  const debugStatus = document.createElement('div');
  debugStatus.id = 'debug-status';
  debugStatus.style.cssText = 'position: fixed; top: 10px; left: 10px; background: rgba(0,255,0,0.8); color: black; padding: 8px; border-radius: 4px; font-size: 12px; z-index: 9999;';
  debugStatus.innerHTML = '🟢 JS Loading...';
  document.body.appendChild(debugStatus);
}

// Global error handlers for production debugging
window.addEventListener('error', (event) => {
  console.error('🔥 GLOBAL_JS_ERROR:', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('🔥 UNHANDLED_PROMISE_REJECTION:', event.reason);
});

// DEBUG: Log main.tsx execution
console.log('🟩 MAIN_TSX_LOADED - React main module executing');
document.getElementById('debug-status')!.innerHTML = '🟡 Error handlers set...';

const rootElement = document.getElementById('root');
console.log('🟩 ROOT_ELEMENT_CHECK:', {
  exists: rootElement !== null,
  tagName: rootElement?.tagName,
  id: rootElement?.id
});
document.getElementById('debug-status')!.innerHTML = '🟡 Root element found...';

if (!rootElement) {
  console.error('❌ ROOT_ELEMENT_MISSING - Cannot find #root element!');
  // Fallback: Create emergency error display
  document.body.innerHTML = `
    <div style="min-height: 100vh; background: #000; color: #fff; padding: 2rem; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1>🚨 ChessChat Critical Error</h1>
      <p>Root element #root not found in DOM</p>
      <button onclick="location.reload()" style="margin-top: 1rem; padding: 12px 24px; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer;">Reload</button>
    </div>
  `;
  throw new Error('Root element #root not found');
}

console.log('🟩 CREATING_REACT_ROOT - About to create React root');
document.getElementById('debug-status')!.innerHTML = '🟡 Creating React root...';

try {
  const root = ReactDOM.createRoot(rootElement);
  console.log('🟩 REACT_ROOT_CREATED - Root created successfully');
  document.getElementById('debug-status')!.innerHTML = '🟡 React root created...';
  
  document.getElementById('debug-status')!.innerHTML = '🟡 Rendering App...';
  
  root.render(
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
  
  console.log('🟩 REACT_RENDER_CALLED - App component render initiated');
  
  // Hide debug status after successful render (with delay to ensure App mounts)
  setTimeout(() => {
    const debugEl = document.getElementById('debug-status');
    if (debugEl) debugEl.style.display = 'none';
  }, 2000);
} catch (error) {
  console.error('❌ REACT_MOUNT_ERROR:', error);
  // Emergency fallback UI
  rootElement.innerHTML = `
    <div style="min-height: 100vh; background: #000; color: #fff; padding: 2rem; text-align: center; display: flex; flex-direction: column; justify-content: center; align-items: center;">
      <h1>🚨 ChessChat Initialization Error</h1>
      <p>Failed to mount React application</p>
      <pre style="background: #333; padding: 1rem; border-radius: 4px; max-width: 80%; overflow: auto; font-size: 0.8rem;">${error instanceof Error ? error.message : 'Unknown error'}</pre>
      <button onclick="location.reload()" style="margin-top: 1rem; padding: 12px 24px; background: #fff; color: #000; border: none; border-radius: 8px; cursor: pointer;">Reload</button>
    </div>
  `;
  throw error;
}
