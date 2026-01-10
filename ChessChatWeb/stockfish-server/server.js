/**
 * Stockfish HTTP Server (Option B Implementation)
 * 
 * This is a standalone HTTP server that wraps the Stockfish chess engine
 * and exposes it via REST API for the Cloudflare Worker to consume.
 * 
 * Features:
 * - Native Stockfish engine via child_process
 * - RESTful API for move computation and position analysis
 * - Configurable CPU difficulty levels (1-10)
 * - Health check endpoint
 * - Request logging and error handling
 * - X-Request-Id support for tracing
 * - CORS support for development
 */

const express = require('express');
const { Chess } = require('chess.js');
const { spawn } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3001;
const API_KEY = process.env.STOCKFISH_API_KEY || 'development-key-change-in-production';
const MAX_COMPUTE_TIME = parseInt(process.env.MAX_COMPUTE_TIME) || 3000;

// Cold start tracking
let lastRequestTime = 0;
const COLD_START_THRESHOLD_MS = 60000; // 1 minute idle = cold start

// Middleware
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// X-Request-Id middleware
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || crypto.randomBytes(16).toString('hex');
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// API key authentication middleware
const authenticateApiKey = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header',
      requestId: req.requestId
    });
  }
  
  const token = authHeader.substring(7);
  if (token !== API_KEY) {
    return res.status(401).json({ 
      error: 'Invalid API key',
      requestId: req.requestId
    });
  }
  
  next();
};

// Structured logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.json;
  
  res.json = function(data) {
    const duration = Date.now() - startTime;
    
    // Log request
    const logEntry = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: duration,
      clientIp: req.ip || req.headers['x-forwarded-for'] || 'unknown'
    };
    
    // Don't log API key
    if (req.body && req.body.cpuLevel) {
      logEntry.cpuLevel = req.body.cpuLevel;
    }
    
    console.log(JSON.stringify(logEntry));
    
    return originalSend.call(this, data);
  };
  
  next();
});

/**
 * CPU Level Configuration
 * Maps difficulty 1-10 to Stockfish parameters
 * 
 * Strategy:
 * - Lower levels: short movetime + limited depth
 * - Higher levels: longer movetime + deeper search
 * - Level 10: near-maximum strength (2800+ ELO)
 */
const CPU_CONFIG = {
  1: { depth: 4, movetime: 150, skillLevel: 0 },
  2: { depth: 6, movetime: 200, skillLevel: 3 },
  3: { depth: 6, movetime: 300, skillLevel: 6 },
  4: { depth: 8, movetime: 400, skillLevel: 8 },
  5: { depth: 10, movetime: 700, skillLevel: 10 },
  6: { depth: 12, movetime: 1000, skillLevel: 12 },
  7: { depth: 14, movetime: 1500, skillLevel: 15 },
  8: { depth: 16, movetime: 2000, skillLevel: 17 },
  9: { depth: 18, movetime: 2500, skillLevel: 19 },
  10: { depth: 20, movetime: 3000, skillLevel: 20 }
};

/**
 * Stockfish Engine Manager
 * Handles spawning and communication with native Stockfish binary
 */
class StockfishEngine {
  constructor() {
    this.process = null;
    this.ready = false;
    this.outputBuffer = [];
  }

  /**
   * Spawn Stockfish process
   */
  async spawn() {
    return new Promise((resolve, reject) => {
      try {
        // Use downloaded Stockfish binary (from install-stockfish.js)
        const stockfishPath = require('path').join(__dirname, 'stockfish');
        this.process = spawn(stockfishPath);
        
        this.process.on('error', (err) => {
          reject(new Error(`Failed to spawn Stockfish: ${err.message}`));
        });

        this.process.stdout.on('data', (data) => {
          const lines = data.toString().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              this.outputBuffer.push(line.trim());
              if (line.includes('Stockfish') || line.includes('uciok')) {
                this.ready = true;
              }
            }
          }
        });

        // Initialize UCI mode
        this.send('uci');
        
        // Wait for uciok
        const checkReady = setInterval(() => {
          if (this.ready) {
            clearInterval(checkReady);
            this.send('isready');
            resolve();
          }
        }, 50);

        setTimeout(() => {
          clearInterval(checkReady);
          if (!this.ready) {
            reject(new Error('Stockfish initialization timeout'));
          }
        }, 5000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send UCI command to engine
   */
  send(command) {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(command + '\n');
    }
  }

  /**
   * Compute best move for position
   */
  async computeMove(fen, cpuLevel, requestId) {
    const config = CPU_CONFIG[cpuLevel] || CPU_CONFIG[5];
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      if (!this.process || !this.ready) {
        try {
          await this.spawn();
        } catch (error) {
          return reject(error);
        }
      }

      // Clear output buffer
      this.outputBuffer = [];
      
      // CRITICAL FIX: Reset UCI options BEFORE setting position
      // This ensures the Skill Level is properly applied for this specific move
      // Without this, the previous game's Skill Level persists!
      this.send('ucinewgame'); // Clear hash tables and reset state
      this.send(`setoption name Skill Level value ${config.skillLevel}`);
      this.send(`setoption name MultiPV value 1`);
      this.send(`setoption name Contempt value 0`);
      
      // Wait a moment for options to be set
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Set position AFTER configuring options
      this.send(`position fen ${fen}`);
      
      // Start search with time limit
      const movetime = Math.min(config.movetime, MAX_COMPUTE_TIME);
      this.send(`go movetime ${movetime} depth ${config.depth}`);

      // Setup timeout with cleanup
      const timeout = setTimeout(() => {
        // Kill hanging engine process to prevent zombies
        if (this.process && !this.process.killed) {
          this.process.kill('SIGTERM');
          this.process = null;
          this.ready = false;
        }
        reject(new Error(`Engine timeout after ${MAX_COMPUTE_TIME}ms`));
      }, MAX_COMPUTE_TIME + 1000);

      // Parse output for bestmove
      const checkOutput = setInterval(() => {
        for (let i = 0; i < this.outputBuffer.length; i++) {
          const line = this.outputBuffer[i];
          
          if (line.startsWith('bestmove')) {
            clearInterval(checkOutput);
            clearTimeout(timeout);
            
            const parts = line.split(' ');
            const move = parts[1];
            
            // Extract diagnostics from info lines
            const diagnostics = this.extractDiagnostics(this.outputBuffer, config);
            const engineMs = Date.now() - startTime;
            
            resolve({
              success: true,
              move,
              uci: move,
              diagnostics: {
                ...diagnostics,
                cpuLevel,
                depth: config.depth,
                skillLevel: config.skillLevel,
                movetimeMs: movetime,
                engineMs,
                requestId
              }
            });
            return;
          }
        }
      }, 10);
    });
  }

  /**
   * Analyze position with MultiPV
   */
  async analyzePosition(fen, depth = 15, multiPv = 3, requestId) {
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      if (!this.process || !this.ready) {
        try {
          await this.spawn();
        } catch (error) {
          return reject(error);
        }
      }

      // Clear output buffer
      this.outputBuffer = [];
      
      // Set position
      this.send(`position fen ${fen}`);
      
      // Enable MultiPV
      this.send(`setoption name MultiPV value ${multiPv}`);
      
      // Start search
      this.send(`go depth ${depth}`);

      // Setup timeout
      const timeout = setTimeout(() => {
        reject(new Error('Analysis timeout'));
      }, 10000);

      // Parse output for bestmove
      const checkOutput = setInterval(() => {
        for (let i = 0; i < this.outputBuffer.length; i++) {
          const line = this.outputBuffer[i];
          
          if (line.startsWith('bestmove')) {
            clearInterval(checkOutput);
            clearTimeout(timeout);
            
            const analysis = this.parseAnalysis(this.outputBuffer, multiPv);
            const engineMs = Date.now() - startTime;
            
            resolve({
              success: true,
              ...analysis,
              engineMs,
              requestId
            });
            return;
          }
        }
      }, 10);
    });
  }

  /**
   * Quick evaluation with movetime control (for Learning V3)
   */
  async evaluatePosition(fen, movetimeMs = 300, depth = 12, requestId) {
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      if (!this.process || !this.ready) {
        try {
          await this.spawn();
        } catch (error) {
          return reject(error);
        }
      }

      // Clear output buffer
      this.outputBuffer = [];
      
      // Set position
      this.send(`position fen ${fen}`);
      
      // Configure for quick eval (no skill level reduction)
      this.send(`setoption name Skill Level value 20`);
      this.send(`setoption name MultiPV value 1`);
      
      // Start search with movetime limit (prioritize movetime over depth)
      this.send(`go movetime ${movetimeMs} depth ${depth}`);

      // Setup timeout with generous buffer for engine startup and I/O
      // Stockfish needs time to parse position, search, and output results
      const timeoutMs = Math.max(movetimeMs * 3, movetimeMs + 2000);
      const timeout = setTimeout(() => {
        reject(new Error(`Evaluation timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      // Parse output for bestmove
      const checkOutput = setInterval(() => {
        for (let i = 0; i < this.outputBuffer.length; i++) {
          const line = this.outputBuffer[i];
          
          if (line.startsWith('bestmove')) {
            clearInterval(checkOutput);
            clearTimeout(timeout);
            
            const parts = line.split(' ');
            const bestMove = parts[1];
            
            // Extract diagnostics from info lines
            const diagnostics = this.extractDiagnostics(this.outputBuffer, { depth, movetime: movetimeMs });
            const engineMs = Date.now() - startTime;
            
            resolve({
              success: true,
              bestMove,
              evaluation: diagnostics.evalCp !== null ? diagnostics.evalCp / 100 : null,
              mate: diagnostics.mate,
              pv: diagnostics.pv,
              depth: diagnostics.actualDepth || depth,
              nodes: diagnostics.nodes,
              engineMs,
              requestId
            });
            return;
          }
        }
      }, 10);
    });
  }

  /**
   * Extract diagnostics from UCI output
   */
  extractDiagnostics(outputBuffer, config) {
    const diagnostics = {
      nodes: 0,
      nps: 0,
      evalCp: null,
      mate: null,
      pv: '',
      actualDepth: null
    };

    // Find last info line with score
    for (let i = outputBuffer.length - 1; i >= 0; i--) {
      const line = outputBuffer[i];
      if (line.startsWith('info') && line.includes('score')) {
        // Parse nodes
        const nodesMatch = line.match(/nodes (\d+)/);
        if (nodesMatch) diagnostics.nodes = parseInt(nodesMatch[1]);
        
        // Parse nps
        const npsMatch = line.match(/nps (\d+)/);
        if (npsMatch) diagnostics.nps = parseInt(npsMatch[1]);
        
        // Parse actual depth reached
        const depthMatch = line.match(/depth (\d+)/);
        if (depthMatch) diagnostics.actualDepth = parseInt(depthMatch[1]);
        
        // Parse score
        if (line.includes('score cp')) {
          const cpMatch = line.match(/score cp (-?\d+)/);
          if (cpMatch) diagnostics.evalCp = parseInt(cpMatch[1]);
        } else if (line.includes('score mate')) {
          const mateMatch = line.match(/score mate (-?\d+)/);
          if (mateMatch) diagnostics.mate = parseInt(mateMatch[1]);
        }
        
        // Parse pv
        const pvMatch = line.match(/pv (.+)$/);
        if (pvMatch) diagnostics.pv = pvMatch[1];
        
        break;
      }
    }

    return diagnostics;
  }

  /**
   * Parse analysis output for MultiPV
   */
  parseAnalysis(outputBuffer, multiPv) {
    const lines = [];
    
    for (let pv = 1; pv <= multiPv; pv++) {
      // Find last info line for this PV
      for (let i = outputBuffer.length - 1; i >= 0; i--) {
        const line = outputBuffer[i];
        if (line.startsWith('info') && line.includes(`multipv ${pv}`) && line.includes('score')) {
          const pvData = {
            pv: pv,
            evaluation: null,
            mate: null,
            moves: '',
            depth: 0
          };
          
          // Parse score
          if (line.includes('score cp')) {
            const cpMatch = line.match(/score cp (-?\d+)/);
            if (cpMatch) pvData.evaluation = parseInt(cpMatch[1]) / 100; // Convert to pawns
          } else if (line.includes('score mate')) {
            const mateMatch = line.match(/score mate (-?\d+)/);
            if (mateMatch) pvData.mate = parseInt(mateMatch[1]);
          }
          
          // Parse depth
          const depthMatch = line.match(/depth (\d+)/);
          if (depthMatch) pvData.depth = parseInt(depthMatch[1]);
          
          // Parse PV line
          const pvMatch = line.match(/pv (.+)$/);
          if (pvMatch) pvData.moves = pvMatch[1];
          
          lines.push(pvData);
          break;
        }
      }
    }
    
    return {
      lines,
      topLine: lines[0] || null
    };
  }

  /**
   * Terminate engine
   */
  terminate() {
    if (this.process) {
      this.send('quit');
      this.process.kill();
      this.process = null;
      this.ready = false;
    }
  }
}

// Create engine pool for concurrent requests
const enginePool = [];
// Reduced from 4 to 2 for Render free tier (512MB memory limit)
const MAX_ENGINES = 2;

/**
 * Get available engine from pool or create new one
 */
async function getEngine() {
  // Try to find idle engine
  for (const engine of enginePool) {
    if (engine.idle) {
      engine.idle = false;
      return engine;
    }
  }
  
  // Create new engine if under limit
  if (enginePool.length < MAX_ENGINES) {
    const engine = new StockfishEngine();
    engine.idle = false;
    await engine.spawn();
    enginePool.push(engine);
    return engine;
  }
  
  // Wait for available engine
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      for (const engine of enginePool) {
        if (engine.idle) {
          clearInterval(checkInterval);
          engine.idle = false;
          resolve(engine);
          return;
        }
      }
    }, 100);
  });
}

/**
 * Release engine back to pool
 */
function releaseEngine(engine) {
  engine.idle = true;
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'stockfish-server',
    version: '1.0.0',
    engines: {
      active: enginePool.length,
      max: MAX_ENGINES
    },
    timestamp: new Date().toISOString(),
    requestId: req.requestId
  });
});

/**
 * POST /compute-move
 * Compute the best move for a given position
 * 
 * Body:
 * - fen: string (required) - FEN notation of position
 * - cpuLevel: number (1-10, default 5) - CPU difficulty
 */
app.post('/compute-move', authenticateApiKey, async (req, res) => {
  const startTime = Date.now();
  let engine = null;
  
  try {
    const { fen, cpuLevel = 5 } = req.body;
    
    // Validate input
    if (!fen) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required field: fen',
        requestId: req.requestId
      });
    }
    
    // Validate FEN using chess.js
    let chess;
    try {
      chess = new Chess(fen);
      if (chess.isGameOver()) {
        return res.status(400).json({ 
          success: false,
          error: 'Game is over',
          gameOver: true,
          reason: chess.isCheckmate() ? 'checkmate' : 
                  chess.isStalemate() ? 'stalemate' : 
                  chess.isThreefoldRepetition() ? 'threefold_repetition' :
                  chess.isInsufficientMaterial() ? 'insufficient_material' : 'unknown',
          requestId: req.requestId
        });
      }
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid FEN notation', 
        details: err.message,
        requestId: req.requestId
      });
    }
    
    // Validate CPU level
    const level = Math.max(1, Math.min(10, parseInt(cpuLevel, 10) || 5));
    
    // Detect cold start
    const now = Date.now();
    const coldStartDetected = lastRequestTime === 0 || (now - lastRequestTime) > COLD_START_THRESHOLD_MS;
    lastRequestTime = now;
    
    console.log(JSON.stringify({
      action: 'compute_move_start',
      requestId: req.requestId,
      cpuLevel: level,
      coldStartDetected,
      fen: fen.substring(0, 50) + '...'
    }));
    
    // Get engine from pool
    engine = await getEngine();
    
    // Compute best move
    const result = await engine.computeMove(fen, level, req.requestId);
    
    // Convert UCI to SAN if possible
    let san = result.move;
    try {
      const move = chess.move(result.move);
      if (move) {
        san = move.san;
        chess.undo(); // Undo for verification
      }
    } catch (e) {
      // Keep UCI if SAN conversion fails
    }
    
    const duration = Date.now() - startTime;
    
    console.log(JSON.stringify({
      action: 'compute_move_complete',
      requestId: req.requestId,
      move: result.move,
      san,
      durationMs: duration,
      engineMs: result.diagnostics.engineMs
    }));
    
    res.json({
      success: true,
      move: result.move,
      uci: result.move,
      san,
      source: 'stockfish',
      diagnostics: {
        ...result.diagnostics,
        totalMs: duration,
        coldStartDetected
      },
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
    
  } catch (error) {
    console.error(JSON.stringify({
      action: 'compute_move_error',
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    }));
    
    const duration = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Failed to compute move',
      errorCode: 'ENGINE_ERROR',
      details: error.message,
      computeTimeMs: duration,
      requestId: req.requestId
    });
  } finally {
    if (engine) {
      releaseEngine(engine);
    }
  }
});

/**
 * POST /analyze
 * Analyze a position and return evaluation + best lines
 * 
 * Body:
 * - fen: string (required) - FEN notation of position
 * - depth: number (optional, default 15) - Search depth
 * - multiPv: number (optional, default 3) - Number of lines to return
 */
app.post('/analyze', authenticateApiKey, async (req, res) => {
  const startTime = Date.now();
  let engine = null;
  
  try {
    const { fen, depth = 15, multiPv = 3 } = req.body;
    
    // Validate input
    if (!fen) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required field: fen',
        requestId: req.requestId
      });
    }
    
    // Validate FEN
    try {
      new Chess(fen);
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid FEN notation', 
        details: err.message,
        requestId: req.requestId
      });
    }
    
    const validDepth = Math.max(1, Math.min(25, parseInt(depth, 10) || 15));
    const validMultiPv = Math.max(1, Math.min(5, parseInt(multiPv, 10) || 3));
    
    console.log(JSON.stringify({
      action: 'analyze_start',
      requestId: req.requestId,
      depth: validDepth,
      multiPv: validMultiPv,
      fen: fen.substring(0, 50) + '...'
    }));
    
    // Get engine from pool
    engine = await getEngine();
    
    // Analyze position
    const analysis = await engine.analyzePosition(fen, validDepth, validMultiPv, req.requestId);
    
    const duration = Date.now() - startTime;
    
    console.log(JSON.stringify({
      action: 'analyze_complete',
      requestId: req.requestId,
      lines: analysis.lines.length,
      durationMs: duration
    }));
    
    res.json({
      success: true,
      ...analysis,
      depth: validDepth,
      multiPv: validMultiPv,
      computeTimeMs: duration,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
    
  } catch (error) {
    console.error(JSON.stringify({
      action: 'analyze_error',
      requestId: req.requestId,
      error: error.message
    }));
    
    const duration = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze position',
      errorCode: 'ENGINE_ERROR',
      details: error.message,
      computeTimeMs: duration,
      requestId: req.requestId
    });
  } finally {
    if (engine) {
      releaseEngine(engine);
    }
  }
});

/**
 * POST /evaluate
 * Quick position evaluation (for Learning V3 game analysis)
 * 
 * Body:
 * - fen: string (required) - FEN notation of position
 * - movetimeMs: number (default 300) - Max time in milliseconds
 * - depth: number (default 12) - Max depth to search
 * 
 * Response:
 * - success: boolean
 * - bestMove: string (UCI notation)
 * - evaluation: number (in pawns, positive = white advantage)
 * - mate: number | null (moves to mate if found)
 * - pv: string (principal variation line)
 * - depth: number (actual depth reached)
 * - nodes: number (nodes searched)
 * - engineMs: number (actual engine time)
 */
app.post('/evaluate', authenticateApiKey, async (req, res) => {
  const startTime = Date.now();
  let engine = null;
  
  try {
    const { fen, movetimeMs = 300, depth = 12 } = req.body;
    
    // Validate input
    if (!fen) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required field: fen',
        requestId: req.requestId
      });
    }
    
    // Validate FEN
    try {
      new Chess(fen);
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid FEN notation', 
        details: err.message,
        requestId: req.requestId
      });
    }
    
    // Validate parameters
    const validMovetime = Math.max(100, Math.min(2000, parseInt(movetimeMs, 10) || 300));
    const validDepth = Math.max(1, Math.min(20, parseInt(depth, 10) || 12));
    
    console.log(JSON.stringify({
      action: 'evaluate_start',
      requestId: req.requestId,
      movetimeMs: validMovetime,
      depth: validDepth,
      fen: fen.substring(0, 50) + '...'
    }));
    
    // Get engine from pool
    engine = await getEngine();
    
    // Evaluate position
    const result = await engine.evaluatePosition(fen, validMovetime, validDepth, req.requestId);
    
    const duration = Date.now() - startTime;
    
    console.log(JSON.stringify({
      action: 'evaluate_complete',
      requestId: req.requestId,
      engineMs: result.engineMs,
      totalMs: duration,
      evaluation: result.evaluation
    }));
    
    res.json({
      ...result,
      computeTimeMs: duration,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error(JSON.stringify({
      action: 'evaluate_error',
      requestId: req.requestId,
      error: error.message
    }));
    
    const duration = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Failed to evaluate position',
      errorCode: 'ENGINE_ERROR',
      details: error.message,
      computeTimeMs: duration,
      requestId: req.requestId
    });
  } finally {
    if (engine) {
      releaseEngine(engine);
    }
  }
});

/**
 * POST /analyze-game
 * Analyze a complete game and identify key moments (mistakes, blunders, brilliant moves)
 * 
 * Request Body:
 * - pgn (string, required): PGN of the game to analyze
 * - depth (number, optional): Stockfish depth per position (default: 14)
 * - samplingStrategy (string, optional): 'smart' or 'all' (default: 'smart')
 * 
 * Response:
 * - success (boolean)
 * - gameId (string): unique identifier for this analysis
 * - playerColor (string): 'white' or 'black' (color to analyze)
 * - keyMoments (array): Array of significant positions with evaluations
 * - accuracy (number): Overall accuracy percentage
 * - blunders (number): Count of blunders (eval swing > 300cp)
 * - mistakes (number): Count of mistakes (eval swing > 100cp)
 * - computeTimeMs (number): Total time spent analyzing
 */
app.post('/analyze-game', authenticateApiKey, async (req, res) => {
  const startTime = Date.now();
  let enginesUsed = [];
  
  try {
    const { pgn, depth = 14, samplingStrategy = 'smart', playerColor = 'white' } = req.body;
    
    // Validate input
    if (!pgn) {
      return res.status(400).json({ 
        success: false,
        error: 'Missing required field: pgn',
        requestId: req.requestId
      });
    }
    
    // Parse PGN
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
    } catch (err) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid PGN notation', 
        details: err.message,
        requestId: req.requestId
      });
    }
    
    const moves = chess.history({ verbose: true });
    if (moves.length < 4) {
      return res.status(400).json({ 
        success: false,
        error: 'Game too short for analysis (minimum 4 moves)',
        requestId: req.requestId
      });
    }
    
    const validDepth = Math.max(10, Math.min(20, parseInt(depth, 10) || 14));
    const gameId = req.requestId || crypto.randomBytes(8).toString('hex');
    
    console.log(JSON.stringify({
      action: 'analyze_game_start',
      requestId: req.requestId,
      gameId,
      totalMoves: moves.length,
      depth: validDepth,
      samplingStrategy,
      playerColor
    }));
    
    // Determine which positions to analyze based on sampling strategy
    let positionsToAnalyze = [];
    if (samplingStrategy === 'all') {
      // Analyze every position
      positionsToAnalyze = moves.map((_, index) => index);
    } else {
      // Smart sampling: first 4, last 4, and every 6th ply in between
      const totalPlies = moves.length;
      positionsToAnalyze = [];
      
      // First 4 plies
      for (let i = 0; i < Math.min(4, totalPlies); i++) {
        positionsToAnalyze.push(i);
      }
      
      // Every 6th ply in the middle
      if (totalPlies > 8) {
        for (let i = 6; i < totalPlies - 4; i += 6) {
          if (!positionsToAnalyze.includes(i)) {
            positionsToAnalyze.push(i);
          }
        }
      }
      
      // Last 4 plies
      for (let i = Math.max(4, totalPlies - 4); i < totalPlies; i++) {
        if (!positionsToAnalyze.includes(i)) {
          positionsToAnalyze.push(i);
        }
      }
      
      positionsToAnalyze.sort((a, b) => a - b);
    }
    
    console.log(JSON.stringify({
      action: 'analyze_game_sampling',
      requestId: req.requestId,
      totalMoves: moves.length,
      sampled: positionsToAnalyze.length,
      positions: positionsToAnalyze
    }));
    
    // Analyze positions
    const keyMoments = [];
    chess.reset();
    let prevEval = 0; // Starting position eval (roughly equal)
    
    for (let i = 0; i < moves.length; i++) {
      const move = moves[i];
      const fen = chess.fen();
      
      // Make the move
      chess.move(move.san);
      const fenAfterMove = chess.fen();
      
      // Analyze this position if it's in our sample
      if (positionsToAnalyze.includes(i)) {
        try {
          // Get engine from pool
          const engine = await getEngine();
          enginesUsed.push(engine);
          
          // Evaluate position after move
          const analysis = await engine.evaluatePosition(fenAfterMove, validDepth, req.requestId);
          
          // Calculate evaluation swing (from player's perspective)
          // Flip sign if it's black's move
          let evalCp = analysis.evaluation;
          if (move.color === 'b') {
            evalCp = -evalCp;
          }
          
          const evalSwing = Math.abs(evalCp - prevEval);
          
          // Classify move quality
          let classification = 'good';
          if (evalSwing > 300) {
            classification = 'blunder';
          } else if (evalSwing > 100) {
            classification = 'mistake';
          } else if (evalSwing < -50) {
            classification = 'brilliant';
          }
          
          // Only include if it's the player's move and significant
          const isPlayerMove = (playerColor === 'white' && move.color === 'w') || 
                               (playerColor === 'black' && move.color === 'b');
          
          if (isPlayerMove && (classification === 'blunder' || classification === 'mistake' || classification === 'brilliant')) {
            keyMoments.push({
              ply: i + 1,
              fen: fen,
              move: move.san,
              fenAfterMove: fenAfterMove,
              evalCp: analysis.evaluation,
              evalSwing: Math.round(evalSwing),
              classification,
              bestMove: analysis.bestMove,
              depth: analysis.depth,
              mate: analysis.mate
            });
          }
          
          prevEval = evalCp;
          
          // Release engine back to pool
          releaseEngine(engine);
          enginesUsed = enginesUsed.filter(e => e !== engine);
          
        } catch (error) {
          console.error(JSON.stringify({
            action: 'analyze_game_position_error',
            requestId: req.requestId,
            ply: i + 1,
            error: error.message
          }));
          // Continue analyzing other positions
        }
      }
    }
    
    // Calculate statistics
    const blunders = keyMoments.filter(m => m.classification === 'blunder').length;
    const mistakes = keyMoments.filter(m => m.classification === 'mistake').length;
    const brilliant = keyMoments.filter(m => m.classification === 'brilliant').length;
    
    // Calculate accuracy (simplified: percentage of moves that weren't blunders or mistakes)
    const playerMoves = moves.filter(m => 
      (playerColor === 'white' && m.color === 'w') || 
      (playerColor === 'black' && m.color === 'b')
    ).length;
    const accuracy = Math.round((1 - (blunders + mistakes) / playerMoves) * 100);
    
    const duration = Date.now() - startTime;
    
    console.log(JSON.stringify({
      action: 'analyze_game_complete',
      requestId: req.requestId,
      gameId,
      keyMoments: keyMoments.length,
      blunders,
      mistakes,
      brilliant,
      accuracy,
      durationMs: duration
    }));
    
    res.json({
      success: true,
      gameId,
      playerColor,
      keyMoments,
      statistics: {
        totalMoves: moves.length,
        playerMoves,
        positionsAnalyzed: positionsToAnalyze.length,
        blunders,
        mistakes,
        brilliant,
        accuracy
      },
      depth: validDepth,
      samplingStrategy,
      computeTimeMs: duration,
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    });
    
  } catch (error) {
    console.error(JSON.stringify({
      action: 'analyze_game_error',
      requestId: req.requestId,
      error: error.message,
      stack: error.stack
    }));
    
    const duration = Date.now() - startTime;
    
    res.status(500).json({
      success: false,
      error: 'Failed to analyze game',
      errorCode: 'ENGINE_ERROR',
      details: error.message,
      computeTimeMs: duration,
      requestId: req.requestId
    });
  } finally {
    // Release any engines still in use
    enginesUsed.forEach(engine => releaseEngine(engine));
  }
});

/**
 * 404 handler
 */
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    requestId: req.requestId
  });
});

/**
 * Error handler
 */
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    action: 'unhandled_error',
    requestId: req.requestId,
    error: err.message,
    stack: err.stack
  }));
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message,
    requestId: req.requestId
  });
});

/**
 * Graceful shutdown
 */
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  enginePool.forEach(engine => engine.terminate());
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  enginePool.forEach(engine => engine.terminate());
  process.exit(0);
});

/**
 * Start server
 */
app.listen(PORT, () => {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         Stockfish HTTP Server (Option B)                  ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Port:        ${PORT}                                       ║`);
  console.log(`║  Status:      Running with REAL Stockfish                  ║`);
  console.log(`║  Health:      http://localhost:${PORT}/health              ║`);
  console.log(`║  Engine Pool: Max ${MAX_ENGINES} concurrent engines        ║`);
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                                ║');
  console.log('║  POST /compute-move  - Compute best move                   ║');
  console.log('║  POST /analyze       - Analyze position (MultiPV)          ║');
  console.log('║  POST /analyze-game  - Analyze full game                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('✅ Real Stockfish engine integration active');
  console.log('✅ Structured JSON logging enabled');
  console.log('✅ X-Request-Id tracing enabled');
  console.log('');
  console.log('Server ready to accept requests.');
  console.log('Press Ctrl+C to stop.');
});
