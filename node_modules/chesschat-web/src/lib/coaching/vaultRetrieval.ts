/**
 * Knowledge Vault Retrieval
 * Integrates learning system with knowledge vault for deeper explanations
 * 
 * Phase 6 of Enhanced Learning System
 */

import { MistakeSignature, MistakeCategory } from './types';

/**
 * Knowledge chunk from vault
 */
export interface KnowledgeChunk {
  id: string;
  category: MistakeCategory;
  topic: string;
  content: string;
  examples?: string[];
  relatedPrinciples?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Local knowledge vault storage
 * This serves as a placeholder for future backend integration
 */
const LOCAL_KNOWLEDGE_VAULT: KnowledgeChunk[] = [
  {
    id: 'tactics_fork_basics',
    category: 'tactics',
    topic: 'Fork Tactics',
    content: 'A fork is when one piece attacks two or more enemy pieces simultaneously. Knights are especially good at forking because they can attack squares that other pieces cannot reach in one move.',
    examples: [
      'Nf3-e5 attacking both king on g6 and rook on c6',
      'Qd1-a4+ attacking both king on e8 and rook on a8',
    ],
    relatedPrinciples: ['tactical-vision', 'piece-coordination'],
    difficulty: 'beginner',
  },
  {
    id: 'tactics_pin_basics',
    category: 'tactics',
    topic: 'Pin Tactics',
    content: 'A pin occurs when a piece cannot move without exposing a more valuable piece behind it. Bishops and rooks are natural pinning pieces along diagonals and files.',
    examples: [
      'Bc1-g5 pinning knight on f6 to queen on d8',
      'Ra1-a8 pinning bishop on a7 to king on a8',
    ],
    relatedPrinciples: ['tactical-vision', 'piece-activity'],
    difficulty: 'beginner',
  },
  {
    id: 'tactics_hung_piece',
    category: 'tactics',
    topic: 'Hanging Pieces',
    content: 'A hanging piece is undefended and can be captured for free. Always check if your pieces are defended before moving. Use the "safety check" method: before moving, verify each piece has at least one defender or is moved to a safe square.',
    examples: [
      'Moving knight from d4 without protecting it = hanging piece',
      'Moving queen to c5 where it can be captured by pawn on b6',
    ],
    relatedPrinciples: ['piece-safety', 'calculation'],
    difficulty: 'beginner',
  },
  {
    id: 'opening_castle_early',
    category: 'opening',
    topic: 'King Safety - Early Castling',
    content: 'Castling early (ideally within the first 10 moves) protects your king and connects your rooks. Delaying castling leaves your king vulnerable to attacks. The general rule is: develop knights and bishops, then castle.',
    examples: [
      'Good: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.0-0 (castled move 4)',
      'Risky: Delaying castling until move 15+ with king in center',
    ],
    relatedPrinciples: ['king-safety', 'opening-principles'],
    difficulty: 'beginner',
  },
  {
    id: 'strategy_control_center',
    category: 'strategy',
    topic: 'Center Control',
    content: 'Controlling the center squares (d4, d5, e4, e5) gives your pieces more mobility and limits opponent options. You can control the center with pawns or pieces. The center is the most important area of the board in the opening and middlegame.',
    examples: [
      'White: d4 and e4 pawns occupying center',
      'Black: Knights on c6 and d5 controlling center squares',
    ],
    relatedPrinciples: ['space-advantage', 'piece-mobility'],
    difficulty: 'beginner',
  },
  {
    id: 'endgame_pawn_structure',
    category: 'endgame',
    topic: 'Pawn Structure in Endgames',
    content: 'In endgames, pawn structure becomes critical. Passed pawns (pawns with no enemy pawns blocking their path) are extremely valuable. Connected passed pawns are even stronger. Avoid creating isolated or backward pawns.',
    examples: [
      'Passed pawn on d6 with no black pawns on c, d, or e files',
      'Connected passed pawns on b5 and c5',
    ],
    relatedPrinciples: ['endgame-technique', 'pawn-play'],
    difficulty: 'intermediate',
  },
  {
    id: 'time_management',
    category: 'time',
    topic: 'Time Management',
    content: 'Manage your time wisely. Spend more time on critical positions (tactical complications, endgame decisions) and less on routine moves. A good rule of thumb: use 10% of your remaining time per move for routine positions, up to 30% for critical moments.',
    examples: [
      '15 minutes left, routine move = 1.5 minutes max',
      '15 minutes left, critical tactic = 4-5 minutes acceptable',
    ],
    relatedPrinciples: ['practical-play', 'decision-making'],
    difficulty: 'intermediate',
  },
];

/**
 * Vault Retrieval Engine
 * Fetches relevant knowledge for mistake signatures
 */
export class VaultRetrievalEngine {
  private localVault: KnowledgeChunk[] = LOCAL_KNOWLEDGE_VAULT;
  private remoteEndpoint: string | null = null;

  constructor(remoteEndpoint?: string) {
    this.remoteEndpoint = remoteEndpoint || null;
  }

  /**
   * Retrieve knowledge chunks for a mistake signature
   */
  async retrieve(signature: MistakeSignature, limit: number = 3): Promise<KnowledgeChunk[]> {
    // Try remote endpoint first if available
    if (this.remoteEndpoint) {
      try {
        return await this.retrieveRemote(signature, limit);
      } catch (error) {
        console.warn('Remote vault retrieval failed, falling back to local:', error);
      }
    }

    // Fallback to local vault
    return this.retrieveLocal(signature, limit);
  }

  /**
   * Retrieve from local knowledge vault
   */
  private retrieveLocal(signature: MistakeSignature, limit: number): KnowledgeChunk[] {
    const results: Array<{ chunk: KnowledgeChunk; score: number }> = [];

    for (const chunk of this.localVault) {
      let score = 0;

      // Category match (high weight)
      if (chunk.category === signature.category) {
        score += 10;
      }

      // Topic/title match
      const signatureLower = signature.title.toLowerCase();
      const chunkTopicLower = chunk.topic.toLowerCase();
      
      if (chunkTopicLower.includes(signatureLower) || signatureLower.includes(chunkTopicLower)) {
        score += 8;
      }

      // Related principles match
      if (signature.relatedPrinciples && chunk.relatedPrinciples) {
        const commonPrinciples = signature.relatedPrinciples.filter(p => 
          chunk.relatedPrinciples?.includes(p)
        );
        score += commonPrinciples.length * 3;
      }

      // Difficulty appropriateness (prefer beginner content for low mastery)
      if (signature.masteryScore < 40 && chunk.difficulty === 'beginner') {
        score += 2;
      } else if (signature.masteryScore >= 40 && signature.masteryScore < 70 && chunk.difficulty === 'intermediate') {
        score += 2;
      } else if (signature.masteryScore >= 70 && chunk.difficulty === 'advanced') {
        score += 2;
      }

      if (score > 0) {
        results.push({ chunk, score });
      }
    }

    // Sort by score and return top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit).map(r => r.chunk);
  }

  /**
   * Retrieve from remote knowledge vault (future implementation)
   */
  private async retrieveRemote(signature: MistakeSignature, limit: number): Promise<KnowledgeChunk[]> {
    if (!this.remoteEndpoint) {
      throw new Error('No remote endpoint configured');
    }

    const response = await fetch(this.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        signatureId: signature.signatureId,
        category: signature.category,
        title: signature.title,
        principles: signature.relatedPrinciples,
        masteryScore: signature.masteryScore,
        limit,
      }),
    });

    if (!response.ok) {
      throw new Error(`Remote vault error: ${response.status}`);
    }

    const data = await response.json();
    return data.chunks || [];
  }

  /**
   * Enrich signature with vault knowledge
   */
  async enrichSignature(signature: MistakeSignature): Promise<{
    signature: MistakeSignature;
    knowledgeChunks: KnowledgeChunk[];
  }> {
    const chunks = await this.retrieve(signature);
    
    return {
      signature,
      knowledgeChunks: chunks,
    };
  }

  /**
   * Batch enrich multiple signatures
   */
  async enrichSignatures(signatures: MistakeSignature[]): Promise<Array<{
    signature: MistakeSignature;
    knowledgeChunks: KnowledgeChunk[];
  }>> {
    const promises = signatures.map(sig => this.enrichSignature(sig));
    return Promise.all(promises);
  }

  /**
   * Add custom knowledge chunk to local vault
   */
  addToLocalVault(chunk: KnowledgeChunk): void {
    this.localVault.push(chunk);
    
    // Persist to localStorage
    try {
      localStorage.setItem('chess_knowledge_vault_custom', JSON.stringify(this.localVault));
    } catch (error) {
      console.warn('Failed to persist custom knowledge chunk:', error);
    }
  }

  /**
   * Load custom chunks from localStorage
   */
  loadCustomChunks(): void {
    try {
      const stored = localStorage.getItem('chess_knowledge_vault_custom');
      if (stored) {
        const custom: KnowledgeChunk[] = JSON.parse(stored);
        this.localVault = [...LOCAL_KNOWLEDGE_VAULT, ...custom];
      }
    } catch (error) {
      console.warn('Failed to load custom knowledge chunks:', error);
    }
  }
}

// Singleton instance
let vaultEngineInstance: VaultRetrievalEngine | null = null;

export function getVaultEngine(remoteEndpoint?: string): VaultRetrievalEngine {
  if (!vaultEngineInstance) {
    vaultEngineInstance = new VaultRetrievalEngine(remoteEndpoint);
    vaultEngineInstance.loadCustomChunks();
  }
  return vaultEngineInstance;
}

/**
 * Reset singleton (for testing)
 */
export function resetVaultEngine(): void {
  vaultEngineInstance = null;
}
