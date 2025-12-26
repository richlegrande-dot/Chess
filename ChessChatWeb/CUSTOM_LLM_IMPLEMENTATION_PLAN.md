# Custom Chess Coaching LLM - Implementation Plan

**Date**: December 19, 2025  
**Approach**: Hybrid Rule-Based + Custom Trained Model  
**Goal**: Zero dependency on ChatGPT/Gemini/Claude

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Chess Coaching System                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  Rule-Based      │         │  Custom Trained  │         │
│  │  Analyzer        │────────▶│  LLM Model       │         │
│  │  (Immediate)     │         │  (Enhanced)      │         │
│  └──────────────────┘         └──────────────────┘         │
│         │                              │                     │
│         │                              │                     │
│         ▼                              ▼                     │
│  ┌──────────────────────────────────────────────┐          │
│  │     Coaching Report Generator                │          │
│  │  (Combines structured + natural language)    │          │
│  └──────────────────────────────────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Rule-Based Analysis System (Week 1-2)

### 1.1 Tactical Mistake Detector

```typescript
// src/lib/ruleBasedAnalyzer.ts

interface TacticalMistake {
  moveNumber: number;
  move: string;
  type: 'blunder' | 'mistake' | 'inaccuracy' | 'missed_win';
  evaluation: number;  // Material lost in pawns
  explanation: string;
  suggestedMove?: string;
}

class TacticalAnalyzer {
  analyzeMistakes(gameMetrics: GameplayMetrics[]): TacticalMistake[] {
    const mistakes: TacticalMistake[] = [];
    
    for (let i = 0; i < gameMetrics.length; i++) {
      const metric = gameMetrics[i];
      const evalDrop = i > 0 ? gameMetrics[i-1].evaluation - metric.evaluation : 0;
      
      // Blunder: Lost 3+ pawns
      if (evalDrop >= 3.0) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          type: 'blunder',
          evaluation: evalDrop,
          explanation: this.explainBlunder(metric, evalDrop)
        });
      }
      
      // Mistake: Lost 1.5-3 pawns
      else if (evalDrop >= 1.5) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          type: 'mistake',
          evaluation: evalDrop,
          explanation: this.explainMistake(metric, evalDrop)
        });
      }
      
      // Check for missed tactics
      if (metric.isMissedTactic) {
        mistakes.push({
          moveNumber: metric.moveNumber,
          move: metric.move,
          type: 'missed_win',
          evaluation: 0,
          explanation: this.explainMissedTactic(metric),
          suggestedMove: this.findBestTactic(metric.fen)
        });
      }
    }
    
    return mistakes;
  }
  
  private explainBlunder(metric: GameplayMetrics, evalDrop: number): string {
    const chess = new Chess(metric.fen);
    const move = chess.history({ verbose: true }).slice(-1)[0];
    
    // Detect common blunder patterns
    if (this.isPieceHanging(chess, move.to)) {
      const piece = this.getPieceName(move.piece);
      return `${piece} on ${move.to} is undefended and can be captured for free.`;
    }
    
    if (this.allowsBackRankMate(chess)) {
      return `This move allows a back-rank checkmate. Your king needs an escape square.`;
    }
    
    if (this.allowsFork(chess)) {
      return `This move allows an opponent fork, attacking multiple pieces simultaneously.`;
    }
    
    return `This move loses significant material (${Math.abs(evalDrop).toFixed(1)} pawns).`;
  }
  
  private explainMissedTactic(metric: GameplayMetrics): string {
    const chess = new Chess(metric.fen);
    const pattern = this.detectTacticalPattern(chess);
    
    switch (pattern) {
      case 'fork':
        return `There was a knight/queen fork available that attacks two pieces at once.`;
      case 'pin':
        return `You could pin an opponent's piece to their king or more valuable piece.`;
      case 'skewer':
        return `A skewer was available to force the opponent to move a valuable piece.`;
      case 'discovered_attack':
        return `Moving one piece would reveal a powerful attack from another piece.`;
      case 'mate_in_2':
        return `There was a forced checkmate sequence in 2 moves.`;
      default:
        return `There was a strong tactical opportunity to gain material.`;
    }
  }
}
```

### 1.2 Strategic Principle Checker

```typescript
// src/lib/strategicAnalyzer.ts

interface StrategicViolation {
  moveNumber: number;
  principle: string;
  severity: 'minor' | 'moderate' | 'major';
  explanation: string;
}

const CHESS_PRINCIPLES = {
  // Opening Principles (moves 1-10)
  CONTROL_CENTER: {
    id: 'center_control',
    phase: 'opening',
    check: (chess: Chess, moveNumber: number) => {
      if (moveNumber > 10) return null;
      const centerSquares = ['d4', 'd5', 'e4', 'e5'];
      const controlled = centerSquares.filter(sq => 
        chess.get(sq as Square)?.color === chess.turn()
      );
      return controlled.length >= 1;
    },
    violation: 'Not controlling the center with pawns in the opening.',
    advice: 'Move central pawns (d4, e4, d5, e5) early to control key squares.'
  },
  
  DEVELOP_PIECES: {
    id: 'piece_development',
    phase: 'opening',
    check: (chess: Chess, moveNumber: number) => {
      if (moveNumber > 10) return null;
      const developedPieces = this.countDevelopedPieces(chess);
      const expectedDevelopment = Math.floor(moveNumber / 2);
      return developedPieces >= expectedDevelopment;
    },
    violation: 'Not developing pieces quickly enough in the opening.',
    advice: 'Develop knights and bishops before moving the same piece twice.'
  },
  
  KING_SAFETY: {
    id: 'king_safety',
    phase: 'opening',
    check: (chess: Chess, moveNumber: number) => {
      if (moveNumber > 12) return null;
      return this.isKingCastled(chess, chess.turn());
    },
    violation: 'King is still in the center after move 10.',
    advice: 'Castle early (before move 10) to protect your king.'
  },
  
  // Middlegame Principles (moves 11-30)
  AVOID_WEAKNESSES: {
    id: 'pawn_structure',
    phase: 'middlegame',
    check: (chess: Chess) => {
      const weaknesses = this.findPawnWeaknesses(chess);
      return weaknesses.length <= 2;
    },
    violation: 'Creating weak pawns (isolated, doubled, or backward).',
    advice: 'Avoid pawn moves that create permanent weaknesses.'
  },
  
  PIECE_ACTIVITY: {
    id: 'piece_activity',
    phase: 'middlegame',
    check: (chess: Chess) => {
      const mobility = this.calculatePieceMobility(chess);
      return mobility >= 15; // Average moves available
    },
    violation: 'Pieces have limited mobility and activity.',
    advice: 'Place pieces on active squares where they control important areas.'
  },
  
  // Endgame Principles (moves 30+)
  ACTIVATE_KING: {
    id: 'king_activity',
    phase: 'endgame',
    check: (chess: Chess, moveNumber: number) => {
      if (moveNumber < 30) return null;
      return this.isKingCentralized(chess, chess.turn());
    },
    violation: 'King is passive in the endgame.',
    advice: 'Activate your king in the endgame - it becomes a strong piece.'
  },
  
  PASSED_PAWNS: {
    id: 'passed_pawns',
    phase: 'endgame',
    check: (chess: Chess, moveNumber: number) => {
      if (moveNumber < 30) return null;
      return this.hasPassedPawn(chess, chess.turn());
    },
    violation: 'Not creating or advancing passed pawns in the endgame.',
    advice: 'Create and push passed pawns in the endgame - they become very powerful.'
  }
};

class StrategicAnalyzer {
  analyzeViolations(gameMetrics: GameplayMetrics[]): StrategicViolation[] {
    const violations: StrategicViolation[] = [];
    
    for (const metric of gameMetrics) {
      const chess = new Chess(metric.fen);
      const phase = this.getGamePhase(metric.moveNumber);
      
      // Check all principles relevant to current phase
      for (const principle of Object.values(CHESS_PRINCIPLES)) {
        if (principle.phase !== phase) continue;
        
        const passes = principle.check(chess, metric.moveNumber);
        if (passes === false) {
          violations.push({
            moveNumber: metric.moveNumber,
            principle: principle.id,
            severity: this.getSeverity(principle.id),
            explanation: principle.violation
          });
        }
      }
    }
    
    return violations;
  }
}
```

### 1.3 Template-Based Feedback Generator

```typescript
// src/lib/feedbackTemplates.ts

interface FeedbackTemplate {
  condition: (mistakes: TacticalMistake[], violations: StrategicViolation[]) => boolean;
  generate: (context: AnalysisContext) => string;
}

const FEEDBACK_TEMPLATES = {
  // Tactical Feedback
  MANY_BLUNDERS: {
    condition: (mistakes) => mistakes.filter(m => m.type === 'blunder').length >= 3,
    generate: (ctx) => {
      const blunders = ctx.mistakes.filter(m => m.type === 'blunder');
      return `You made ${blunders.length} blunders in this game. ${
        blunders[0].moveNumber <= 10 
          ? 'Try slowing down in the opening and double-checking each move.'
          : 'Take more time on critical positions - especially when material is equal.'
      } Focus on making sure your pieces are defended before moving.`;
    }
  },
  
  MISSED_TACTICS: {
    condition: (mistakes) => mistakes.filter(m => m.type === 'missed_win').length >= 2,
    generate: (ctx) => {
      const missed = ctx.mistakes.filter(m => m.type === 'missed_win');
      return `You missed ${missed.length} tactical opportunities. Practice recognizing patterns like forks, pins, and skewers. Before making a move, ask yourself: "What is my opponent threatening?" and "What can I threaten?"`;
    }
  },
  
  // Strategic Feedback
  POOR_DEVELOPMENT: {
    condition: (_, violations) => 
      violations.filter(v => v.principle === 'piece_development').length >= 3,
    generate: () => 
      `You're moving the same pieces multiple times in the opening instead of developing all pieces. Follow the principle: "Knights before bishops, and develop towards the center." Get your pieces into the game before attacking.`
  },
  
  WEAK_KING_SAFETY: {
    condition: (_, violations) => 
      violations.some(v => v.principle === 'king_safety'),
    generate: (ctx) => {
      const castleMove = ctx.violations.find(v => v.principle === 'king_safety');
      return `You didn't castle until move ${castleMove?.moveNumber || 'late'}. Always castle by move 10 unless there's a strong tactical reason not to. Your king in the center is vulnerable to attacks.`;
    }
  },
  
  // Encouraging Feedback
  STRONG_OPENING: {
    condition: (mistakes, violations) => {
      const earlyMistakes = mistakes.filter(m => m.moveNumber <= 10);
      const openingViolations = violations.filter(v => v.moveNumber <= 10);
      return earlyMistakes.length === 0 && openingViolations.length <= 1;
    },
    generate: () => 
      `Great opening play! You followed key principles: controlling the center, developing pieces quickly, and castling early. This gave you a solid foundation for the middlegame.`
  },
  
  GOOD_ENDGAME: {
    condition: (mistakes, _, metrics) => {
      const endgameMoves = metrics.filter(m => m.moveNumber >= 30);
      const endgameMistakes = mistakes.filter(m => m.moveNumber >= 30);
      return endgameMoves.length >= 10 && endgameMistakes.length <= 1;
    },
    generate: () => 
      `Excellent endgame technique! You activated your king, created passed pawns, and converted your advantage smoothly. This is a critical skill that many players neglect.`
  }
};

class FeedbackGenerator {
  generateReport(
    mistakes: TacticalMistake[],
    violations: StrategicViolation[],
    metrics: GameplayMetrics[]
  ): CoachingReport {
    const context: AnalysisContext = { mistakes, violations, metrics };
    
    // Generate specific improvements (top 3 critical issues)
    const improvements = this.selectTopImprovements(context);
    
    // Generate strategic focus
    const strategicFocus = this.determineStrategicFocus(violations);
    
    // Generate tactical focus
    const tacticalFocus = this.determineTacticalFocus(mistakes);
    
    // Generate encouragement
    const encouragement = this.generateEncouragement(context);
    
    return {
      improvements,
      strategicFocus,
      tacticalFocus,
      encouragement
    };
  }
  
  private selectTopImprovements(context: AnalysisContext): Improvement[] {
    const improvements: Improvement[] = [];
    
    // Find applicable templates
    for (const [key, template] of Object.entries(FEEDBACK_TEMPLATES)) {
      if (template.condition(context.mistakes, context.violations, context.metrics)) {
        const feedback = template.generate(context);
        
        // Determine which move caused this issue
        const relatedMove = this.findRelatedMove(key, context);
        
        improvements.push({
          title: this.getImprovementTitle(key),
          description: feedback,
          moveNumber: relatedMove?.moveNumber,
          severity: this.calculateSeverity(key, context)
        });
      }
    }
    
    // Sort by severity and return top 3
    return improvements
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 3);
  }
  
  private generateEncouragement(context: AnalysisContext): string {
    // Always find something positive
    const { mistakes, violations, metrics } = context;
    
    // Check for strong phases
    if (FEEDBACK_TEMPLATES.STRONG_OPENING.condition(mistakes, violations, metrics)) {
      return FEEDBACK_TEMPLATES.STRONG_OPENING.generate(context);
    }
    
    if (FEEDBACK_TEMPLATES.GOOD_ENDGAME.condition(mistakes, violations, metrics)) {
      return FEEDBACK_TEMPLATES.GOOD_ENDGAME.generate(context);
    }
    
    // Default positive messages based on effort
    const movesPlayed = metrics.length;
    if (movesPlayed >= 40) {
      return `You played a long game with ${movesPlayed} moves, showing persistence and fighting spirit. Every game is a learning opportunity!`;
    }
    
    if (mistakes.length <= 2) {
      return `You played very accurately with only ${mistakes.length} significant mistake(s). Focus on identifying and capitalizing on your opponent's errors next time.`;
    }
    
    return `You're making progress! Each game helps you recognize patterns faster. Keep practicing tactical puzzles and you'll see rapid improvement.`;
  }
}
```

---

## Phase 2: Data Collection Pipeline (Week 2-3)

### 2.1 Game Data Extraction

```typescript
// src/lib/trainingDataCollector.ts

interface TrainingExample {
  // Input features
  gameMetrics: GameplayMetrics[];
  tacticalMistakes: TacticalMistake[];
  strategicViolations: StrategicViolation[];
  playerLevel: number;
  
  // Target output (human-written coaching)
  feedbackText: string;
  improvements: string[];
  encouragement: string;
}

class TrainingDataCollector {
  private examples: TrainingExample[] = [];
  
  async collectFromGame(
    gameId: string,
    metrics: GameplayMetrics[],
    playerLevel: number
  ): Promise<void> {
    // Run rule-based analysis
    const tacticalAnalyzer = new TacticalAnalyzer();
    const strategicAnalyzer = new StrategicAnalyzer();
    
    const mistakes = tacticalAnalyzer.analyzeMistakes(metrics);
    const violations = strategicAnalyzer.analyzeViolations(metrics);
    
    // Generate rule-based feedback
    const feedbackGen = new FeedbackGenerator();
    const report = feedbackGen.generateReport(mistakes, violations, metrics);
    
    // Store as training example
    const example: TrainingExample = {
      gameMetrics: metrics,
      tacticalMistakes: mistakes,
      strategicViolations: violations,
      playerLevel,
      feedbackText: this.combineReport(report),
      improvements: report.improvements.map(i => i.description),
      encouragement: report.encouragement
    };
    
    this.examples.push(example);
    
    // Save to file every 10 games
    if (this.examples.length % 10 === 0) {
      await this.saveToFile();
    }
  }
  
  async saveToFile(): Promise<void> {
    // Save as JSONL (JSON Lines) format for training
    const jsonl = this.examples
      .map(ex => JSON.stringify(this.formatForTraining(ex)))
      .join('\n');
    
    const blob = new Blob([jsonl], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `training_data_${Date.now()}.jsonl`;
    a.click();
  }
  
  private formatForTraining(example: TrainingExample): any {
    // Format for transformer training
    return {
      prompt: this.createPrompt(example),
      completion: this.createCompletion(example)
    };
  }
  
  private createPrompt(example: TrainingExample): string {
    // Create structured input for the model
    return `Analyze this chess game:

Player Level: ${example.playerLevel}
Total Moves: ${example.gameMetrics.length}
Blunders: ${example.tacticalMistakes.filter(m => m.type === 'blunder').length}
Mistakes: ${example.tacticalMistakes.filter(m => m.type === 'mistake').length}
Missed Tactics: ${example.tacticalMistakes.filter(m => m.type === 'missed_win').length}
Strategic Violations: ${example.strategicViolations.length}

Key Mistakes:
${example.tacticalMistakes.slice(0, 5).map(m => 
  `- Move ${m.moveNumber}: ${m.move} (${m.type})`
).join('\n')}

Provide coaching feedback:`;
  }
  
  private createCompletion(example: TrainingExample): string {
    // The model should learn to generate this format
    return `## Top 3 Improvements

${example.improvements.map((imp, i) => `${i+1}. ${imp}`).join('\n\n')}

## What You Did Well

${example.encouragement}`;
  }
}
```

### 2.2 Target Data Structure

```json
// Example training data format
{
  "prompt": "Analyze this chess game:\n\nPlayer Level: 1200\nTotal Moves: 45\nBlunders: 3\nMistakes: 2\nMissed Tactics: 1\n\nKey Mistakes:\n- Move 8: Nf3 (blunder)\n- Move 15: e4 (mistake)\n- Move 23: Qh5 (missed_win)\n\nProvide coaching feedback:",
  
  "completion": "## Top 3 Improvements\n\n1. **Protect Your Pieces (Move 8)**: Your knight on f3 was undefended and got captured. Before moving a piece, always check if it will be safe on the new square.\n\n2. **Look for Forks (Move 23)**: There was a knight fork available that would have won material. Practice recognizing when your knights can attack two pieces at once.\n\n3. **Think Ahead (Move 15)**: This pawn push weakened your king. In the middlegame, focus on piece activity before pushing pawns unnecessarily.\n\n## What You Did Well\n\nYou castled early and controlled the center in the opening. Your piece development was solid for the first 10 moves. Keep building on these fundamentals!"
}
```

---

## Phase 3: Train Custom Small Model (Week 3-5)

### 3.1 Model Architecture

We'll use a **small transformer** specifically designed for chess coaching:

```python
# train_chess_coach.py

import torch
import torch.nn as nn
from transformers import GPT2LMHeadModel, GPT2Tokenizer, GPT2Config
from datasets import load_dataset

class ChessCoachModel:
    def __init__(self):
        # Small GPT-2 architecture (117M parameters)
        config = GPT2Config(
            vocab_size=50257,
            n_positions=512,      # Max sequence length
            n_embd=768,           # Embedding dimension
            n_layer=12,           # Number of transformer layers
            n_head=12,            # Number of attention heads
            resid_pdrop=0.1,
            embd_pdrop=0.1,
            attn_pdrop=0.1,
        )
        
        self.model = GPT2LMHeadModel(config)
        self.tokenizer = GPT2Tokenizer.from_pretrained('gpt2')
        
        # Add special tokens for chess notation
        special_tokens = {
            'additional_special_tokens': [
                '[BLUNDER]', '[MISTAKE]', '[GOOD_MOVE]',
                '[OPENING]', '[MIDDLEGAME]', '[ENDGAME]'
            ]
        }
        self.tokenizer.add_special_tokens(special_tokens)
        self.model.resize_token_embeddings(len(self.tokenizer))
    
    def train(self, training_data_path: str, epochs: int = 3):
        # Load training data
        dataset = load_dataset('json', data_files=training_data_path)
        
        # Training configuration
        from transformers import TrainingArguments, Trainer
        
        training_args = TrainingArguments(
            output_dir='./chess_coach_model',
            num_train_epochs=epochs,
            per_device_train_batch_size=4,
            per_device_eval_batch_size=4,
            warmup_steps=500,
            weight_decay=0.01,
            logging_dir='./logs',
            logging_steps=100,
            save_steps=1000,
            eval_steps=500,
            evaluation_strategy='steps',
            gradient_accumulation_steps=4,
            fp16=True,  # Mixed precision training
        )
        
        trainer = Trainer(
            model=self.model,
            args=training_args,
            train_dataset=dataset['train'],
            eval_dataset=dataset['validation'],
            tokenizer=self.tokenizer
        )
        
        trainer.train()
        
        # Save final model
        self.model.save_pretrained('./chess_coach_model_final')
        self.tokenizer.save_pretrained('./chess_coach_model_final')
```

### 3.2 Training Script

```bash
# train.sh

#!/bin/bash

# Install dependencies
pip install torch transformers datasets accelerate

# Prepare training data (collect 1000+ games first)
python prepare_training_data.py

# Train the model
python train_chess_coach.py \
  --data_path ./training_data.jsonl \
  --output_dir ./chess_coach_model \
  --epochs 3 \
  --batch_size 4 \
  --learning_rate 5e-5

# Convert to ONNX for browser deployment
python export_to_onnx.py \
  --model_path ./chess_coach_model_final \
  --output_path ./public/models/chess_coach.onnx
```

### 3.3 Browser Deployment with ONNX Runtime

```typescript
// src/lib/customCoachModel.ts
import * as ort from 'onnxruntime-web';

class CustomChessCoach {
  private session: ort.InferenceSession | null = null;
  private tokenizer: any; // Tokenizer loaded from JSON
  
  async initialize() {
    // Load ONNX model (runs in browser with WebAssembly)
    this.session = await ort.InferenceSession.create(
      '/models/chess_coach.onnx',
      {
        executionProviders: ['wasm'],
        graphOptimizationLevel: 'all'
      }
    );
    
    // Load tokenizer config
    const tokenizerResponse = await fetch('/models/tokenizer.json');
    this.tokenizer = await tokenizerResponse.json();
  }
  
  async generateCoaching(
    mistakes: TacticalMistake[],
    violations: StrategicViolation[],
    playerLevel: number
  ): Promise<string> {
    // Create prompt
    const prompt = this.createPrompt(mistakes, violations, playerLevel);
    
    // Tokenize
    const tokens = this.tokenize(prompt);
    const inputIds = new ort.Tensor('int64', tokens, [1, tokens.length]);
    
    // Run inference
    const outputs = await this.session!.run({ input_ids: inputIds });
    const outputTokens = Array.from(outputs.logits.data);
    
    // Decode to text
    const coaching = this.decode(outputTokens);
    
    return coaching;
  }
  
  private tokenize(text: string): BigInt64Array {
    // Simple tokenization (in production, use full tokenizer)
    const words = text.split(/\s+/);
    return new BigInt64Array(
      words.map(w => BigInt(this.tokenizer.vocab[w] || 0))
    );
  }
  
  private decode(tokens: number[]): string {
    // Convert token IDs back to text
    const vocab = Object.entries(this.tokenizer.vocab);
    return tokens
      .map(id => vocab.find(([_, v]) => v === id)?.[0] || '')
      .join(' ')
      .trim();
  }
}
```

---

## Phase 4: Integration & Hybrid System (Week 5-6)

### 4.1 Combined Coaching Engine

```typescript
// src/lib/hybridCoachingEngine.ts

class HybridCoachingEngine {
  private ruleBasedAnalyzer: RuleBasedAnalyzer;
  private customModel: CustomChessCoach;
  private useCustomModel: boolean = false;
  
  async initialize() {
    this.ruleBasedAnalyzer = new RuleBasedAnalyzer();
    
    // Try to load custom model (if available)
    try {
      this.customModel = new CustomChessCoach();
      await this.customModel.initialize();
      this.useCustomModel = true;
      console.log('✅ Custom chess coach model loaded');
    } catch (error) {
      console.log('ℹ️ Custom model not available, using rule-based analysis only');
      this.useCustomModel = false;
    }
  }
  
  async analyzeGame(
    metrics: GameplayMetrics[],
    playerLevel: number
  ): Promise<CoachingReport> {
    // Step 1: Always run rule-based analysis (fast, reliable)
    const mistakes = this.ruleBasedAnalyzer.analyzeTactical(metrics);
    const violations = this.ruleBasedAnalyzer.analyzeStrategic(metrics);
    
    // Step 2: Generate base feedback from templates
    const baseReport = this.ruleBasedAnalyzer.generateFeedback(
      mistakes, 
      violations, 
      metrics
    );
    
    // Step 3: Enhance with custom model (if available)
    if (this.useCustomModel) {
      try {
        const enhancedFeedback = await this.customModel.generateCoaching(
          mistakes,
          violations,
          playerLevel
        );
        
        // Merge rule-based structure with model's natural language
        return this.mergeReports(baseReport, enhancedFeedback);
      } catch (error) {
        console.warn('Custom model failed, using rule-based only:', error);
        return baseReport;
      }
    }
    
    return baseReport;
  }
  
  private mergeReports(
    ruleBasedReport: CoachingReport,
    modelOutput: string
  ): CoachingReport {
    // Parse model output (expects structured format)
    const sections = this.parseModelOutput(modelOutput);
    
    return {
      // Use model's improvements if available, otherwise use rule-based
      improvements: sections.improvements || ruleBasedReport.improvements,
      
      // Combine strategic insights
      strategicFocus: sections.strategicFocus || ruleBasedReport.strategicFocus,
      
      // Combine tactical insights
      tacticalFocus: sections.tacticalFocus || ruleBasedReport.tacticalFocus,
      
      // Use model's encouragement (more natural language)
      encouragement: sections.encouragement || ruleBasedReport.encouragement,
      
      // Include raw rule-based data for debugging
      metadata: {
        source: 'hybrid',
        ruleBasedInsights: ruleBasedReport,
        modelEnhanced: !!sections.improvements
      }
    };
  }
}
```

---

## Implementation Timeline

### Week 1: Rule-Based Foundation
- ✅ Tactical mistake detector
- ✅ Strategic principle checker
- ✅ Template-based feedback
- ✅ UI integration

**Deliverable**: Fully functional coaching system using rules

### Week 2-3: Data Collection
- ✅ Training data collector
- ✅ Export system
- ✅ Collect 500-1000 games
- ✅ Format for training

**Deliverable**: High-quality training dataset

### Week 4-5: Model Training
- ✅ Train custom GPT-2 small model
- ✅ Fine-tune on chess data
- ✅ Export to ONNX format
- ✅ Validate accuracy

**Deliverable**: Trained model ready for deployment

### Week 6: Integration
- ✅ Load ONNX model in browser
- ✅ Hybrid coaching engine
- ✅ A/B test rule-based vs. hybrid
- ✅ Performance optimization

**Deliverable**: Production-ready hybrid system

---

## Technical Requirements

### Dependencies
```json
{
  "dependencies": {
    "onnxruntime-web": "^1.16.0",
    "chess.js": "^1.4.0"
  },
  "devDependencies": {
    "python": "^3.10",
    "torch": "^2.1.0",
    "transformers": "^4.35.0",
    "datasets": "^2.14.0"
  }
}
```

### Model Size & Performance
- **Model Size**: ~50-100MB (compressed ONNX)
- **Inference Time**: 200-500ms per game analysis
- **Memory Usage**: ~150MB in browser
- **Training Data Needed**: 500-1000 annotated games

---

## Advantages of This Approach

### Immediate Benefits (Rule-Based)
✅ **Zero latency** - instant feedback  
✅ **100% reliable** - no hallucinations  
✅ **Free** - no API costs  
✅ **Privacy** - no data sent to servers  

### Long-Term Benefits (Custom Model)
✅ **Natural language** - sounds like a human coach  
✅ **Personalized** - trained on your player base  
✅ **Adaptive** - learns from new games  
✅ **Owned** - complete control over IP  

---

## Next Steps

1. **Start with Phase 1** - Build rule-based system first
2. **Collect data** - Every game becomes training data
3. **Train incrementally** - Retrain model monthly with new games
4. **Measure improvement** - Compare rule-based vs. hybrid effectiveness

Would you like me to start implementing the rule-based tactical analyzer first?
