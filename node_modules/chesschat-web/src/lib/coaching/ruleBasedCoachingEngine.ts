/**
 * Rule-Based Coaching Engine
 * Main entry point for game analysis and coaching feedback
 */

import { Chess } from 'chess.js';
import { TacticalAnalyzer } from './tacticalAnalyzer';
import { StrategicAnalyzer } from './strategicAnalyzer';
import { FeedbackGenerator } from './feedbackGenerator';
import { trainingCollector } from './trainingDataCollector';
import { getMistakeDetector } from './mistakeDetector';
import { getSignatureEngine } from './signatureEngine';
import { getTrainingPlanner } from './trainingPlanner';
import { getVaultEngine } from './vaultRetrieval';
import { saveMistakeSignatureViaAPI } from '../api/walleApiSync';
import { 
  GameplayMetrics, 
  CoachingReport, 
  MistakeEvent, 
  MistakeSignature, 
  EnhancedCoachingPlan,
  MasteryUpdate,
  LearningDebugInfo 
} from './types';

export class RuleBasedCoachingEngine {
  private tacticalAnalyzer: TacticalAnalyzer;
  private strategicAnalyzer: StrategicAnalyzer;
  private feedbackGenerator: FeedbackGenerator;
  private mistakeDetector = getMistakeDetector();
  private signatureEngine = getSignatureEngine();
  private trainingPlanner = getTrainingPlanner();
  private vaultEngine = getVaultEngine();

  constructor() {
    this.tacticalAnalyzer = new TacticalAnalyzer();
    this.strategicAnalyzer = new StrategicAnalyzer();
    this.feedbackGenerator = new FeedbackGenerator();
    
    // Load existing signatures from localStorage
    this.loadSignatures();
  }

  /**
   * Load existing signatures from localStorage
   */
  private loadSignatures(): void {
    try {
      const stored = localStorage.getItem('chess_mistake_signatures');
      if (stored) {
        const signatures: MistakeSignature[] = JSON.parse(stored);
        this.signatureEngine = getSignatureEngine(signatures);
      }
    } catch (error) {
      console.warn('Failed to load mistake signatures:', error);
    }
  }

  /**
   * Save signatures to localStorage
   */
  private saveSignatures(): void {
    try {
      const signatures = this.signatureEngine.getAllSignatures();
      localStorage.setItem('chess_mistake_signatures', JSON.stringify(signatures));
      
      // Sync to database via API (non-blocking)
      signatures.forEach(sig => {
        saveMistakeSignatureViaAPI({
          category: sig.category,
          title: sig.title,
          description: sig.description,
          patternDetails: sig.patternDetails,
          occurrenceCount: sig.occurrenceCount,
          lastOccurrence: sig.lastOccurrence,
          confidenceScore: sig.confidenceScore,
          masteryScore: sig.masteryScore,
          examplePositions: sig.examplePositions,
          relatedConcepts: sig.relatedConcepts
        }).catch(err => console.error('[RuleBasedCoaching] DB write failed:', err));
      });
    } catch (error) {
      console.warn('Failed to save mistake signatures:', error);
    }
  }

  /**
   * Analyze a completed game and generate coaching report
   * @param moveHistory Array of moves with FEN strings
   * @param playerColor Color the player was playing ('w' or 'b')
   * @param gameContext Optional context for training data collection
   * @returns Complete coaching report with improvements and encouragement
   */
  async analyzeGame(
    moveHistory: Array<{ move: string; fen: string }>,
    playerColor: 'w' | 'b' = 'w',
    gameContext?: {
      gameId?: string;
      playerLevel?: number;
      gameResult?: string;
      collectTrainingData?: boolean;
    }
  ): Promise<CoachingReport & { 
    learningData?: {
      events: MistakeEvent[];
      signatures: MistakeSignature[];
      coachingPlan: EnhancedCoachingPlan;
      masteryUpdates: MasteryUpdate[];
      debugInfo: LearningDebugInfo;
    }
  }> {
    // Convert move history to gameplay metrics
    const metrics = this.generateMetrics(moveHistory, playerColor);

    // Run tactical analysis
    const tacticalMistakes = this.tacticalAnalyzer.analyzeMistakes(metrics);

    // Run strategic analysis
    const strategicViolations = this.strategicAnalyzer.analyzeViolations(metrics);

    // Generate human-readable coaching report
    const report = this.feedbackGenerator.generateReport(
      tacticalMistakes,
      strategicViolations,
      metrics
    );

    // Enhanced Learning Pipeline (Phase 2-4)
    const gameId = gameContext?.gameId || `game_${Date.now()}`;
    const learningData = await this.processLearningPipeline(
      gameId,
      tacticalMistakes,
      strategicViolations,
      metrics
    );

    // Collect training data if enabled
    if (gameContext?.collectTrainingData !== false) {
      try {
        trainingCollector.collect(
          report,
          {
            gameId: gameContext?.gameId,
            playerLevel: gameContext?.playerLevel || 5,
            playerColor,
            gameResult: gameContext?.gameResult || 'Unknown',
            moveHistory,
          },
          tacticalMistakes,
          strategicViolations,
          metrics
        );
      } catch (error) {
        console.warn('Failed to collect training data:', error);
      }
    }

    return {
      ...report,
      learningData,
    };
  }

  /**
   * Process learning pipeline: mistakes -> signatures -> coaching plan
   */
  private async processLearningPipeline(
    gameId: string,
    tacticalMistakes: any[],
    strategicViolations: any[],
    metrics: GameplayMetrics[]
  ): Promise<{
    events: MistakeEvent[];
    signatures: MistakeSignature[];
    coachingPlan: EnhancedCoachingPlan;
    masteryUpdates: MasteryUpdate[];
    debugInfo: LearningDebugInfo;
  }> {
    // Phase 2: Detect mistake events
    const events = this.mistakeDetector.detectMistakes(
      gameId,
      tacticalMistakes,
      strategicViolations,
      metrics
    );

    // Phase 3: Update signatures and track mastery
    const masteryUpdates: MasteryUpdate[] = [];
    events.forEach(event => {
      const updates = this.signatureEngine.processEvent(event, false);
      masteryUpdates.push(...updates);
    });

    // Save updated signatures
    this.saveSignatures();

    // Get all signatures sorted by priority
    const signatures = this.signatureEngine.getSortedSignatures();

    // Phase 4: Generate coaching plan with spaced repetition
    const coachingPlan = this.trainingPlanner.generatePlan(signatures);

    // Phase 6: Retrieve knowledge vault content for top signatures
    const topSignatures = signatures.slice(0, 3);
    const vaultRetrievals: string[] = [];
    
    try {
      const enriched = await this.vaultEngine.enrichSignatures(topSignatures);
      enriched.forEach(item => {
        if (item.knowledgeChunks.length > 0) {
          vaultRetrievals.push(
            `${item.signature.title}: Retrieved ${item.knowledgeChunks.length} knowledge chunks`
          );
        }
      });
    } catch (error) {
      console.warn('Vault retrieval failed:', error);
    }

    // Debug info for observability
    const debugInfo: LearningDebugInfo = {
      detectedEvents: events.map(e => ({
        moveNumber: e.moveNumber,
        category: e.category,
        severity: e.severity,
        motif: e.motif,
      })),
      signatureUpdates: masteryUpdates.map(u => ({
        signatureId: u.signatureId,
        delta: u.delta,
        reason: u.reason,
      })),
      plannerRationale: `Selected ${coachingPlan.primaryFocus.title} as primary focus based on priority scoring`,
      appliedHeuristics: [
        'Time decay on inactive signatures',
        'EMA mastery update (alpha=0.1)',
        'Spaced repetition spacing (min 3 games)',
      ],
      vaultRetrievals,
    };

    return {
      events,
      signatures: signatures.slice(0, 10), // Top 10 for UI
      coachingPlan,
      masteryUpdates,
      debugInfo,
    };
  }

  /**
   * Generate gameplay metrics from move history
   * This includes material evaluation for each position
   */
  private generateMetrics(
    moveHistory: Array<{ move: string; fen: string }>,
    playerColor: 'w' | 'b'
  ): GameplayMetrics[] {
    const metrics: GameplayMetrics[] = [];
    const chess = new Chess();

    for (let i = 0; i < moveHistory.length; i++) {
      const { move, fen } = moveHistory[i];
      
      // Load the position before the move
      if (i > 0) {
        chess.load(moveHistory[i - 1].fen);
      } else {
        chess.reset();
      }

      // Only analyze player's moves
      const isPlayerMove = chess.turn() === playerColor;
      if (!isPlayerMove) continue;

      // Calculate material evaluation
      chess.load(fen);
      const evaluation = this.evaluatePosition(chess, playerColor);

      metrics.push({
        moveNumber: Math.floor(i / 2) + 1,
        move,
        fen,
        evaluation,
        isMissedTactic: false, // Will be enhanced in future with tactical engine
      });
    }

    return metrics;
  }

  /**
   * Evaluate position material balance (in pawns)
   * Positive = good for player, negative = bad for player
   */
  private evaluatePosition(chess: Chess, playerColor: 'w' | 'b'): number {
    const board = chess.board();
    const pieceValues: Record<string, number> = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    let whiteScore = 0;
    let blackScore = 0;

    for (const row of board) {
      for (const square of row) {
        if (square) {
          const value = pieceValues[square.type] || 0;
          if (square.color === 'w') {
            whiteScore += value;
          } else {
            blackScore += value;
          }
        }
      }
    }

    // Return score from player's perspective
    return playerColor === 'w' ? whiteScore - blackScore : blackScore - whiteScore;
  }

  /**
   * Analyze a single position (useful for real-time hints)
   * @param fen Position to analyze
   * @param playerColor Color to analyze for
   * @returns Quick tactical assessment
   */
  async analyzePosition(fen: string, playerColor: 'w' | 'b'): Promise<{
    tactical: string[];
    strategic: string[];
    evaluation: number;
  }> {
    const chess = new Chess(fen);
    const evaluation = this.evaluatePosition(chess, playerColor);

    // Quick tactical checks
    const tactical: string[] = [];
    const pattern = this.tacticalAnalyzer.detectTacticalPattern(fen);
    if (pattern) {
      tactical.push(`Tactical pattern detected: ${pattern}`);
    }

    // Quick strategic checks (simplified for single position)
    const strategic: string[] = [];
    const isKingCastled = this.quickCastleCheck(chess, playerColor);
    if (!isKingCastled && this.getMoveNumber(chess) > 10) {
      strategic.push('Consider castling to improve king safety');
    }

    return {
      tactical,
      strategic,
      evaluation,
    };
  }

  /**
   * Quick check if king has castled
   */
  private quickCastleCheck(chess: Chess, color: 'w' | 'b'): boolean {
    const castlingRights = chess.getCastlingRights(color);
    return !castlingRights.k && !castlingRights.q; // Assume castled if no rights left
  }

  /**
   * Estimate move number from position
   */
  private getMoveNumber(chess: Chess): number {
    // Simple heuristic: count developed pieces
    const board = chess.board();
    let developedPieces = 0;
    
    for (const row of board) {
      for (const square of row) {
        if (square && square.type !== 'p' && square.type !== 'k') {
          developedPieces++;
        }
      }
    }

    // Rough estimate: 1 piece developed per 2 moves
    return Math.max(1, Math.floor(developedPieces / 2));
  }
}

// Export a singleton instance
export const coachingEngine = new RuleBasedCoachingEngine();
