/**
 * Turn Integrity Validator
 * Ensures moves are only made on the correct player's turn
 */

import { gameLogger } from './logger';

type Turn = 'w' | 'b';
type Player = 'human' | 'cpu';

interface TurnState {
  currentTurn: Turn;
  expectedPlayer: Player;
  moveCount: number;
  lastMoveTimestamp: number;
}

class TurnIntegrityValidator {
  private state: TurnState = {
    currentTurn: 'w',
    expectedPlayer: 'human',
    moveCount: 0,
    lastMoveTimestamp: Date.now(),
  };

  /**
   * Initialize or reset turn state
   */
  initialize(currentTurn: Turn, playerColor: 'white' | 'black') {
    this.state = {
      currentTurn,
      expectedPlayer: this.getExpectedPlayer(currentTurn, playerColor),
      moveCount: 0,
      lastMoveTimestamp: Date.now(),
    };
    gameLogger.debug('Turn validator initialized', this.state);
  }

  /**
   * Validate if a move can be made by the specified player
   */
  validateMove(player: Player, currentTurn: Turn): {
    valid: boolean;
    reason?: string;
  } {
    // Check if it's the correct player's turn
    if (this.state.expectedPlayer !== player) {
      gameLogger.warn(`Turn violation: ${player} tried to move but it's ${this.state.expectedPlayer}'s turn`);
      return {
        valid: false,
        reason: `It's ${this.state.expectedPlayer}'s turn, not ${player}'s`,
      };
    }

    // Check if turn matches board state
    if (this.state.currentTurn !== currentTurn) {
      gameLogger.warn(`Turn desync: validator has ${this.state.currentTurn} but board has ${currentTurn}`);
      return {
        valid: false,
        reason: 'Turn state desynchronized - please refresh',
      };
    }

    gameLogger.debug(`Turn validated: ${player} can move (turn: ${currentTurn})`);
    return { valid: true };
  }

  /**
   * Update turn state after a successful move
   */
  recordMove(player: Player, newTurn: Turn, playerColor: 'white' | 'black') {
    const previousState = { ...this.state };
    
    this.state = {
      currentTurn: newTurn,
      expectedPlayer: this.getExpectedPlayer(newTurn, playerColor),
      moveCount: this.state.moveCount + 1,
      lastMoveTimestamp: Date.now(),
    };

    gameLogger.debug('Turn state updated', {
      previous: previousState,
      current: this.state,
    });
  }

  /**
   * Determine which player should move for a given turn
   */
  private getExpectedPlayer(turn: Turn, playerColor: 'white' | 'black'): Player {
    const isPlayersTurn = (turn === 'w' && playerColor === 'white') || 
                         (turn === 'b' && playerColor === 'black');
    return isPlayersTurn ? 'human' : 'cpu';
  }

  /**
   * Get current turn state (for diagnostics)
   */
  getState(): Readonly<TurnState> {
    return { ...this.state };
  }

  /**
   * Check if too much time has passed since last move (potential freeze)
   */
  checkForStall(maxIdleMs: number = 30000): boolean {
    const idleTime = Date.now() - this.state.lastMoveTimestamp;
    if (idleTime > maxIdleMs) {
      gameLogger.warn(`Potential game stall detected: ${idleTime}ms since last move`);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const turnValidator = new TurnIntegrityValidator();
