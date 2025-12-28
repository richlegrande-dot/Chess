// Debug Panel Component for troubleshooting AI move issues

import React from 'react';
import { Square } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import '../styles/DebugPanel.css';

export const DebugPanel: React.FC = () => {
  const { 
    chess, 
    debugInfo, 
    showDebugPanel, 
    toggleDebugPanel, 
    copyDebugInfo,
    selectedModel,
    boardVersion,
    isThinking,
    errorMessage,
    healthInfo,
    performHealthCheck,
    attemptRecovery,
    chessConversation,
    lastAIResponse,
    gameId,
    isPlayerTurn,
  } = useGameStore();

  // Helper function to get all legal moves for current position
  const getAllLegalMoves = () => {
    const allMoves: { from: string; to: string; }[] = [];
    for (let rank = 1; rank <= 8; rank++) {
      for (let file of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
        const square = `${file}${rank}` as Square;
        const piece = chess.getPiece(square);
        if (piece && ((chess.getTurn() === 'w' && piece.startsWith('w')) || (chess.getTurn() === 'b' && piece.startsWith('b')))) {
          const moves = chess.getLegalMoves(square);
          moves.forEach(to => allMoves.push({ from: square, to }));
        }
      }
    }
    return allMoves;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatLatency = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <>
      {/* Debug Toggle Button */}
      <button 
        className="debug-toggle-btn"
        onClick={toggleDebugPanel}
        title="Toggle Debug Panel"
      >
        🔧
      </button>

      {/* Debug Panel */}
      {showDebugPanel && (
        <div className="debug-panel">
          <div className="debug-header">
            <h3>🔧 Debug Panel</h3>
            <div className="debug-header-actions">
              <button 
                onClick={() => {
                  localStorage.setItem('debug', 'true');
                  alert('Debug mode enabled! Page will refresh to show worker logs.\n\nCheck the console after refresh to see:\n- Worker configuration\n- Feature parameters\n- Move calculations');
                  window.location.reload();
                }}
                title="Enable debug mode and refresh to show worker logs"
                style={{ 
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                🐛 Enable Debug Mode
              </button>
              <button onClick={copyDebugInfo} title="Copy debug info">
                📋 Copy
              </button>
              <button onClick={toggleDebugPanel} title="Close">
                ✕
              </button>
            </div>
          </div>

          <div className="debug-content">
            {/* Current State */}
            <section className="debug-section">
              <h4>Current State</h4>
              <div className="debug-grid">
                <span className="debug-label">Model:</span>
                <span className="debug-value">{selectedModel.name}</span>
                
                <span className="debug-label">Board Ver:</span>
                <span className="debug-value">{boardVersion}</span>
                
                <span className="debug-label">Thinking:</span>
                <span className={`debug-value ${isThinking ? 'status-active' : ''}`}>
                  {isThinking ? 'Yes ⏳' : 'No'}
                </span>
                
                <span className="debug-label">Error:</span>
                <span className={`debug-value ${errorMessage ? 'status-error' : ''}`}>
                  {errorMessage || 'None'}
                </span>
              </div>
            </section>

            {/* Board Interaction Debug */}
            <section className="debug-section">
              <h4>🎯 Board Interaction</h4>
              <div className="debug-grid">
                <span className="debug-label">Player Turn:</span>
                <span className={`debug-value ${isPlayerTurn ? 'status-success' : 'status-warning'}`}>
                  {isPlayerTurn ? '✓ Yes' : '✗ No (AI Turn)'}
                </span>
                
                <span className="debug-label">Can Move:</span>
                <span className={`debug-value ${!isThinking && isPlayerTurn ? 'status-success' : 'status-error'}`}>
                  {!isThinking && isPlayerTurn ? '✓ Ready' : '✗ Blocked'}
                </span>
                
                <span className="debug-label">Legal Moves:</span>
                <span className="debug-value">
                  {getAllLegalMoves().length} available
                </span>
                
                <span className="debug-label">Game Over:</span>
                <span className={`debug-value ${chess.isGameOver() ? 'status-warning' : 'status-success'}`}>
                  {chess.isGameOver() ? '✓ Game End' : '✗ Active'}
                </span>
              </div>
              
              {/* Interaction Test Buttons */}
              <div className="debug-actions">
                <button 
                  className="debug-btn"
                  onClick={() => {
                    const moves = getAllLegalMoves();
                    console.log('🔍 Legal moves:', moves);
                    const moveStrings = moves.map(m => `${m.from}-${m.to}`);
                    alert(`Legal moves available: ${moves.length}\n${moveStrings.slice(0, 10).join(', ')}${moves.length > 10 ? '...' : ''}`);
                  }}
                  title="Show available moves"
                >
                  🔍 Test Moves
                </button>
                
                <button 
                  className="debug-btn"
                  onClick={() => {
                    const boardEl = document.querySelector('.chess-board-premium');
                    const clickable = boardEl?.querySelectorAll('[data-square]').length || 0;
                    console.log('🎯 Board elements:', { boardEl, clickable });
                    alert(`Board element: ${boardEl ? 'Found' : 'Missing'}\nClickable squares: ${clickable}/64`);
                  }}
                  title="Check board DOM elements"
                >
                  🎯 Test DOM
                </button>
                
                <button 
                  className="debug-btn"
                  onClick={() => {
                    const state = {
                      isPlayerTurn: isPlayerTurn,
                      isThinking: isThinking,
                      canInteract: !isThinking && isPlayerTurn,
                      gameOver: chess.isGameOver(),
                      legalMoves: getAllLegalMoves().length
                    };
                    console.log('🔧 Interaction state:', state);
                    alert(`Interaction Debug:\n${JSON.stringify(state, null, 2)}`);
                  }}
                  title="Check interaction state"
                >
                  🔧 Test State
                </button>
              </div>
            </section>

            {/* Current Position */}
            <section className="debug-section">
              <h4>Position</h4>
              <div className="debug-mono">
                <div className="debug-label">FEN:</div>
                <div className="debug-fen">{chess.getFEN()}</div>
                <div className="debug-label">PGN:</div>
                <div className="debug-pgn">{chess.getPGN() || '(no moves)'}</div>
                <div className="debug-label">Turn:</div>
                <div className="debug-value">{chess.getTurn() === 'w' ? 'White' : 'Black'} to move</div>
              </div>
            </section>

            {/* Move Simulation */}
            <section className="debug-section">
              <h4>🧪 Move Testing</h4>
              <div className="debug-actions">
                <button 
                  className="debug-btn"
                  onClick={() => {
                    const moves = getAllLegalMoves();
                    if (moves.length > 0) {
                      const testMove = moves[0];
                      console.log('🧪 Testing move:', testMove);
                      try {
                        // Test if move validation works
                        const isValid = chess.isLegalMove(testMove.from as Square, testMove.to as Square);
                        alert(`Test Move: ${testMove.from}-${testMove.to}\nValid: ${isValid}\nClick handler should ${isValid ? 'work' : 'fail'}`);
                      } catch (error) {
                        alert(`Move validation error: ${error}`);
                      }
                    } else {
                      alert('No legal moves available!');
                    }
                  }}
                  disabled={getAllLegalMoves().length === 0}
                >
                  🧪 Simulate Move
                </button>
                
                <button 
                  className="debug-btn"
                  onClick={() => {
                    // Force re-render board
                    const event = new CustomEvent('forceUpdate', { detail: { timestamp: Date.now() } });
                    window.dispatchEvent(event);
                    alert('Board refresh triggered!');
                  }}
                >
                  🔄 Force Refresh
                </button>
                
                <button 
                  className="debug-btn"
                  onClick={() => {
                    // Test click simulation
                    const squares = document.querySelectorAll('[data-square]');
                    const whiteSquares = Array.from(squares).filter(sq => {
                      const square = sq.getAttribute('data-square');
                      const piece = chess.getPiece(square as any);
                      return piece && piece.startsWith('w');
                    });
                    
                    if (whiteSquares.length > 0) {
                      const testSquare = whiteSquares[0];
                      console.log('🖱️ Simulating click on:', testSquare.getAttribute('data-square'));
                      (testSquare as HTMLElement).click();
                      alert(`Clicked on ${testSquare.getAttribute('data-square')}\nCheck if piece got selected!`);
                    } else {
                      alert('No white pieces found to click!');
                    }
                  }}
                >
                  🖱️ Test Click
                </button>
                
                <button 
                  className="debug-btn"
                  onClick={() => {
                    // Show legal moves for b2 pawn specifically
                    const b2Piece = chess.getPiece('b2' as Square);
                    if (b2Piece) {
                      const legalMoves = chess.getLegalMoves('b2' as Square);
                      console.log('♟️ b2 pawn legal moves:', legalMoves);
                      alert(`b2 ${b2Piece} can move to: ${legalMoves.join(', ') || 'nowhere'}\n\nNote: Pawns move FORWARD only (b3, b4), not sideways!`);
                    } else {
                      alert('No piece found on b2!');
                    }
                  }}
                >
                  ♟️ Check b2
                </button>
              </div>
            </section>

            {/* Last API Call */}
            {debugInfo.lastApiCall && (
              <section className="debug-section">
                <h4>Last API Call</h4>
                <div className="debug-grid">
                  <span className="debug-label">Time:</span>
                  <span className="debug-value">{formatTime(debugInfo.lastApiCall.timestamp)}</span>
                  
                  <span className="debug-label">Model:</span>
                  <span className="debug-value">{debugInfo.lastApiCall.modelId}</span>
                </div>
                <div className="debug-mono">
                  <div className="debug-label">Request FEN:</div>
                  <div className="debug-fen">{debugInfo.lastApiCall.fen}</div>
                </div>
              </section>
            )}

            {/* Last API Response */}
            {debugInfo.lastApiResponse && (
              <section className="debug-section">
                <h4>Last API Response</h4>
                <div className="debug-grid">
                  <span className="debug-label">Move:</span>
                  <span className={`debug-value ${debugInfo.lastApiResponse.move ? 'status-success' : 'status-error'}`}>
                    {debugInfo.lastApiResponse.move || 'Failed'}
                  </span>
                  
                  <span className="debug-label">Latency:</span>
                  <span className="debug-value">{formatLatency(debugInfo.lastApiResponse.latencyMs)}</span>
                  
                  <span className="debug-label">Engine:</span>
                  <span className="debug-value">{debugInfo.lastApiResponse.engine || 'unknown'}</span>
                  
                  <span className="debug-label">Mode:</span>
                  <span className={`debug-value ${debugInfo.lastApiResponse.mode === 'service-binding' ? 'status-success' : 'status-warning'}`}>
                    {debugInfo.lastApiResponse.mode || 'unknown'}
                  </span>
                  
                  {/* Difficulty Diagnostics */}
                  {debugInfo.lastApiResponse.difficultyDiagnostics && (
                    <>
                      <span className="debug-label">Difficulty:</span>
                      <span className="debug-value">{debugInfo.lastApiResponse.difficultyDiagnostics.requested}</span>
                      
                      <span className="debug-label">Mapped To:</span>
                      <span className="debug-value">{debugInfo.lastApiResponse.difficultyDiagnostics.mappedTo}</span>
                      
                      <span className="debug-label">Depth Reached:</span>
                      <span className="debug-value">{debugInfo.lastApiResponse.difficultyDiagnostics.depthReached}</span>
                      
                      <span className="debug-label">Nodes Evaluated:</span>
                      <span className="debug-value">{debugInfo.lastApiResponse.difficultyDiagnostics.nodesEvaluated}</span>
                      
                      {debugInfo.lastApiResponse.difficultyDiagnostics.openingBook && (
                        <>
                          <span className="debug-label">Source:</span>
                          <span className="debug-value status-info">📖 Opening Book</span>
                        </>
                      )}
                    </>
                  )}
                  
                  {debugInfo.lastApiResponse.error && (
                    <>
                      <span className="debug-label">Error:</span>
                      <span className="debug-value status-error">{debugInfo.lastApiResponse.error}</span>
                    </>
                  )}
                </div>
              </section>
            )}

            {/* Health Status */}
            <section className="debug-section">
              <h4>🏥 Health Status</h4>
              <div className="debug-grid">
                <span className="debug-label">Status:</span>
                <span className={`debug-value ${healthInfo?.isHealthy ? 'status-healthy' : 'status-error'}`}>
                  {healthInfo?.isHealthy ? '✅ Healthy' : '⚠️ Issues Detected'}
                </span>
                
                <span className="debug-label">Last Check:</span>
                <span className="debug-value">
                  {healthInfo?.lastHealthCheck ? formatTime(healthInfo.lastHealthCheck) : 'Never'}
                </span>
                
                <span className="debug-label">Recovery Attempts:</span>
                <span className="debug-value">{healthInfo?.recoveryAttempts || 0}</span>
              </div>

              <div className="debug-actions">
                <button 
                  onClick={performHealthCheck} 
                  className="debug-health-btn"
                  title="Run manual health check"
                >
                  🔍 Check Health
                </button>
                
                <button 
                  onClick={attemptRecovery} 
                  className="debug-recovery-btn"
                  title="Attempt manual recovery"
                  disabled={healthInfo?.isHealthy || (healthInfo?.recoveryAttempts || 0) >= 3}
                >
                  🔧 Recover
                </button>
              </div>

              {healthInfo?.issues && healthInfo.issues.length > 0 && (
                <div className="debug-issues">
                  <div className="debug-label">Issues Found:</div>
                  {healthInfo.issues.map((issue, idx) => (
                    <div key={idx} className="debug-issue">❌ {issue}</div>
                  ))}
                </div>
              )}
            </section>

            {/* Chess Conversation */}
            <section className="debug-section">
              <h4>♟️ Chess Conversation</h4>
              <div className="debug-grid">
                <span className="debug-label">Game ID:</span>
                <span className="debug-value">{gameId || 'Not started'}</span>
                
                <span className="debug-label">Messages:</span>
                <span className="debug-value">{chessConversation.length}</span>
              </div>
              
              <div className="debug-conversation">
                {chessConversation.length === 0 ? (
                  <div className="debug-empty">No conversation yet</div>
                ) : (
                  chessConversation.slice(-5).map((msg, idx) => (
                    <div key={idx} className={`debug-chat-message ${msg.role}`}>
                      <div className="chat-header">
                        <span className="chat-role">
                          {msg.role === 'user' ? '👤 You' : msg.role === 'assistant' ? '🤖 AI' : '⚙️ System'}
                        </span>
                        <span className="chat-time">{formatTime(msg.timestamp)}</span>
                      </div>
                      <div className="chat-content">{msg.content}</div>
                      {msg.moveContext && (
                        <div className="chat-move">Move: {msg.moveContext}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
              
              {lastAIResponse && (
                <div className="debug-last-response">
                  <strong>Last AI Response:</strong>
                  <div className="ai-response-text">{lastAIResponse}</div>
                </div>
              )}
            </section>

            {/* Move History */}
            <section className="debug-section">
              <h4>Move History ({debugInfo.moveHistory.length})</h4>
              <div className="debug-move-history">
                {debugInfo.moveHistory.length === 0 ? (
                  <div className="debug-empty">No moves yet</div>
                ) : (
                  debugInfo.moveHistory.slice(-10).map((entry, idx) => (
                    <div key={idx} className={`debug-move ${entry.player}`}>
                      <span className="move-num">#{entry.moveNum}</span>
                      <span className="move-player">{entry.player === 'human' ? '👤' : '🤖'}</span>
                      <span className="move-notation">{entry.move}</span>
                      <span className="move-time">{formatTime(entry.timestamp)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Worker Binding Troubleshooting Guide */}
            <section className="debug-section debug-troubleshooting">
              <h4>🔍 Worker Binding Verification</h4>
              <div className="debug-info-box">
                <div className="info-title">📋 Required API Response Fields:</div>
                <div className="info-content">
                  <p><strong>To verify worker service binding is active:</strong></p>
                  <ol>
                    <li>Open Browser DevTools (F12) → <strong>Network</strong> tab</li>
                    <li>Make a CPU move in the game</li>
                    <li>Find the <code>/api/chess-move</code> request</li>
                    <li>Check the <strong>Response</strong> tab for these fields:</li>
                  </ol>
                  <div className="required-fields">
                    <div className="field-item">
                      <code className="field-name">workerCallLog</code>
                      <span className="field-desc">Object containing worker service binding call details</span>
                    </div>
                    <div className="field-item">
                      <code className="field-name">workerCallLog.source</code>
                      <span className="field-desc">Should be <strong>"worker"</strong> (NOT "fallback main_thread")</span>
                    </div>
                    <div className="field-item">
                      <code className="field-name">workerCallLog.endpoint</code>
                      <span className="field-desc">Should be "/assist/chess-move"</span>
                    </div>
                    <div className="field-item">
                      <code className="field-name">workerCallLog.latencyMs</code>
                      <span className="field-desc">Response time in milliseconds</span>
                    </div>
                    <div className="field-item">
                      <code className="field-name">mode</code>
                      <span className="field-desc">Should be "service-binding" when debug enabled</span>
                    </div>
                  </div>
                  <div className="status-indicators">
                    <div className="indicator-item success">
                      <strong>✓ Worker Active:</strong> <code>source: "worker"</code>
                    </div>
                    <div className="indicator-item warning">
                      <strong>⚠️ Using Fallback:</strong> <code>source: "fallback main_thread"</code>
                    </div>
                    <div className="indicator-item error">
                      <strong>✗ Field Missing:</strong> Deployment issue - Functions not updated
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Current Status */}
              <div className="debug-grid" style={{ marginTop: '1rem' }}>
                <span className="debug-label">Worker Calls Logged:</span>
                <span className={`debug-value ${debugInfo.workerCalls?.length > 0 ? 'status-success' : 'status-warning'}`}>
                  {debugInfo.workerCalls?.length || 0}
                  {debugInfo.workerCalls?.length === 0 && ' (workerCallLog not in API response)'}
                </span>
                
                <span className="debug-label">Last CPU Source:</span>
                <span className={`debug-value ${debugInfo.lastWorkerMetadata?.source === 'worker' ? 'status-success' : 'status-warning'}`}>
                  {debugInfo.lastWorkerMetadata?.source || 'Unknown'}
                </span>
              </div>
            </section>

            {/* Engine Features Debug - NEW */}
            <section className="debug-section">
              <h4>🔬 Engine Features (Phase 2/3)</h4>
              
              {/* Worker Metadata */}
              {debugInfo.lastWorkerMetadata && (
                <div className="debug-subsection">
                  <div className="debug-subtitle">Last CPU Move</div>
                  <div className="debug-grid">
                    <span className="debug-label">Depth Reached:</span>
                    <span className={`debug-value ${debugInfo.lastWorkerMetadata.depthReached >= 5 ? 'status-success' : 'status-warning'}`}>
                      {debugInfo.lastWorkerMetadata.depthReached} ply
                    </span>
                    
                    <span className="debug-label">Time:</span>
                    <span className="debug-value">{formatLatency(debugInfo.lastWorkerMetadata.timeMs)}</span>
                    
                    <span className="debug-label">Complete:</span>
                    <span className={`debug-value ${debugInfo.lastWorkerMetadata.complete ? 'status-success' : 'status-warning'}`}>
                      {debugInfo.lastWorkerMetadata.complete ? '✓ Yes' : '⚠️ Timed Out'}
                    </span>
                    
                    <span className="debug-label">Source:</span>
                    <span className="debug-value">{debugInfo.lastWorkerMetadata.source}</span>
                    
                    {debugInfo.lastWorkerMetadata.evaluation !== undefined && (
                      <>
                        <span className="debug-label">Evaluation:</span>
                        <span className="debug-value">{(debugInfo.lastWorkerMetadata.evaluation / 100).toFixed(2)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Worker Service Binding Calls */}
              {debugInfo.workerCalls && debugInfo.workerCalls.length > 0 && (
                <div className="debug-subsection">
                  <div className="debug-subtitle">🔗 Worker Calls (Last {Math.min(debugInfo.workerCalls.length, 10)})</div>
                  <div className="debug-worker-calls">
                    {debugInfo.workerCalls.slice(-10).reverse().map((call, idx) => (
                      <div key={idx} className={`debug-worker-call ${call.success ? 'success' : 'error'}`}>
                        <div className="call-header">
                          <span className={`call-status ${call.success ? 'status-success' : 'status-error'}`}>
                            {call.success ? '✓' : '✗'}
                          </span>
                          <span className="call-method">{call.method}</span>
                          <span className="call-endpoint">{call.endpoint}</span>
                          <span className="call-time">{formatTime(call.timestamp)}</span>
                        </div>
                        <div className="call-details">
                          <span className="call-latency">⏱️ {formatLatency(call.latencyMs)}</span>
                          {call.error && <span className="call-error">❌ {call.error}</span>}
                          {call.response?.move && <span className="call-move">♟️ {call.response.move}</span>}
                          {call.response?.depthReached && <span className="call-depth">🎯 Depth: {call.response.depthReached}</span>}
                          {call.response?.evaluation !== undefined && (
                            <span className="call-eval">📊 Eval: {(call.response.evaluation / 100).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Quiescence Search */}
              <div className="debug-subsection">
                <div className="debug-subtitle">🎯 Quiescence Search</div>
                <div className="debug-grid">
                  <span className="debug-label">Enabled:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.quiescence.enabled ? 'status-success' : ''}`}>
                    {debugInfo.engineFeatures.quiescence.enabled ? '✓ Yes' : '✗ No'}
                  </span>
                  
                  <span className="debug-label">Max Depth:</span>
                  <span className="debug-value">{debugInfo.engineFeatures.quiescence.maxDepth} ply</span>
                  
                  <span className="debug-label">Errors:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.quiescence.errors.length > 0 ? 'status-error' : 'status-success'}`}>
                    {debugInfo.engineFeatures.quiescence.errors.length}
                  </span>
                </div>
                {debugInfo.engineFeatures.quiescence.errors.length > 0 && (
                  <div className="debug-errors">
                    {debugInfo.engineFeatures.quiescence.errors.slice(-3).map((err, idx) => (
                      <div key={idx} className="debug-error-item">
                        ❌ Depth {err.depth}: {err.error} ({formatTime(err.timestamp)})
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Beam Search */}
              <div className="debug-subsection">
                <div className="debug-subtitle">🎯 Beam Search</div>
                <div className="debug-grid">
                  <span className="debug-label">Enabled:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.beamSearch.enabled ? 'status-success' : ''}`}>
                    {debugInfo.engineFeatures.beamSearch.enabled ? '✓ Yes' : '✗ No'}
                  </span>
                  
                  <span className="debug-label">Beam Width:</span>
                  <span className="debug-value">{debugInfo.engineFeatures.beamSearch.width} moves</span>
                  
                  <span className="debug-label">Evaluated:</span>
                  <span className="debug-value">{debugInfo.engineFeatures.beamSearch.movesEvaluated}</span>
                  
                  <span className="debug-label">Skipped:</span>
                  <span className="debug-value">{debugInfo.engineFeatures.beamSearch.movesSkipped}</span>
                </div>
              </div>

              {/* Aspiration Windows */}
              <div className="debug-subsection">
                <div className="debug-subtitle">🎯 Aspiration Windows</div>
                <div className="debug-grid">
                  <span className="debug-label">Enabled:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.aspiration.enabled ? 'status-success' : ''}`}>
                    {debugInfo.engineFeatures.aspiration.enabled ? '✓ Yes' : '✗ No'}
                  </span>
                  
                  <span className="debug-label">Window:</span>
                  <span className="debug-value">±{debugInfo.engineFeatures.aspiration.window} cp</span>
                  
                  <span className="debug-label">Failed High:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.aspiration.failedHigh > 0 ? 'status-warning' : ''}`}>
                    {debugInfo.engineFeatures.aspiration.failedHigh}
                  </span>
                  
                  <span className="debug-label">Failed Low:</span>
                  <span className={`debug-value ${debugInfo.engineFeatures.aspiration.failedLow > 0 ? 'status-warning' : ''}`}>
                    {debugInfo.engineFeatures.aspiration.failedLow}
                  </span>
                  
                  <span className="debug-label">Re-searches:</span>
                  <span className="debug-value">{debugInfo.engineFeatures.aspiration.reSearches}</span>
                </div>
              </div>

              {/* Feature Errors */}
              {debugInfo.featureErrors.length > 0 && (
                <div className="debug-subsection">
                  <div className="debug-subtitle">⚠️ Feature Errors ({debugInfo.featureErrors.length})</div>
                  <div className="debug-errors">
                    {debugInfo.featureErrors.slice(-5).map((err, idx) => (
                      <div key={idx} className="debug-error-item">
                        <div className="error-header">
                          <span className="error-feature">[{err.feature}]</span>
                          <span className="error-time">{formatTime(err.timestamp)}</span>
                        </div>
                        <div className="error-message">{err.error}</div>
                        {err.context && Object.keys(err.context).length > 0 && (
                          <div className="error-context">
                            {JSON.stringify(err.context, null, 2).slice(0, 200)}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      )}
    </>
  );
};
