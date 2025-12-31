/**
 * Unit Tests for Smart Sampling Module
 */

import { describe, it, expect } from 'vitest';
import {
  selectPositions,
  selectFirstNPositions,
  selectPositionsForAnalysis
} from '../smartSampling';

describe('Smart Position Sampling', () => {
  const samplePGN = `1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6 9. h3 Na5 10. Bc2 c5`;
  
  describe('selectFirstNPositions', () => {
    it('should select first N positions', () => {
      const result = selectFirstNPositions(samplePGN, 3);
      
      expect(result.candidates.length).toBe(3);
      expect(result.samplingReason).toBe('first-n-ply');
      expect(result.candidates[0].moveNumber).toBe(1);
      expect(result.candidates[1].moveNumber).toBe(2);
      expect(result.candidates[2].moveNumber).toBe(3);
    });
    
    it('should handle empty PGN gracefully', () => {
      const result = selectFirstNPositions('', 5);
      
      expect(result.candidates.length).toBe(0);
      expect(result.samplingReason).toBe('pgn-parse-error');
    });
    
    it('should not exceed available moves', () => {
      const shortPGN = '1. e4 e5 2. Nf3';
      const result = selectFirstNPositions(shortPGN, 10);
      
      expect(result.candidates.length).toBeLessThanOrEqual(3);
    });
  });
  
  describe('selectPositionsForAnalysis (smart sampling)', () => {
    it('should detect captures', () => {
      const pgnWithCapture = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6';
      const result = selectPositionsForAnalysis(pgnWithCapture, {
        maxPositions: 10,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: false
      });
      
      const captureMove = result.candidates.find(c => 
        c.moveSAN.includes('x')
      );
      
      expect(captureMove).toBeDefined();
      expect(captureMove?.reason).toContain('capture');
    });
    
    it('should detect checks', () => {
      const pgnWithCheck = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7+';
      const result = selectPositionsForAnalysis(pgnWithCheck, {
        maxPositions: 10,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: false
      });
      
      const checkMove = result.candidates.find(c => 
        c.moveSAN.includes('+') && !c.moveSAN.includes('#')
      );
      
      expect(checkMove).toBeDefined();
      expect(checkMove?.reason).toContain('check');
    });
    
    it('should detect checkmate', () => {
      const scholarsMate = '1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#';
      const result = selectPositionsForAnalysis(scholarsMate, {
        maxPositions: 10,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: true
      });
      
      const mateMove = result.candidates.find(c => 
        c.moveSAN.includes('#')
      );
      
      expect(mateMove).toBeDefined();
      expect(mateMove?.reason).toContain('checkmate');
      expect(mateMove?.priority).toBeGreaterThan(5); // High priority
    });
    
    it('should detect castling', () => {
      const pgnWithCastling = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. O-O';
      const result = selectPositionsForAnalysis(pgnWithCastling, {
        maxPositions: 10,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: false
      });
      
      const castlingMove = result.candidates.find(c => 
        c.moveSAN.includes('O-O')
      );
      
      expect(castlingMove).toBeDefined();
      expect(castlingMove?.reason).toContain('castling');
    });
    
    it('should detect promotions', () => {
      const pgnWithPromotion = '1. e4 e5 2. f4 exf4 3. e5 d6 4. exd6 cxd6 5. d4 d5 6. Nf3 f6 7. Nc3 dxc3 8. bxc3 Bd6 9. Ba3 Bxa3 10. Qd2 Bd6 11. O-O-O Nc6 12. Re1+ Nge7 13. Bc4 O-O 14. Ng5 fxg5 15. Qxg5 Qxg5+ 16. Re5 Qg4 17. h3 Qh4 18. g3 fxg3 19. Re4 Qf6 20. Rf4 Qe6 21. Rf7 Rxf7 22. Bxf7+ Kxf7 23. Rf1+ Kg8 24. Rf8+ Kxf8 25. c4 Qe1+ 26. Kb2 Qd2 27. c5 Bxh3 28. cxd6 g2 29. dxe7+ Qxe7 30. Kb3 g1=Q';
      
      const result = selectPositionsForAnalysis(pgnWithPromotion, {
        maxPositions: 10,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: false
      });
      
      const promotionMove = result.candidates.find(c => 
        c.moveSAN.includes('=')
      );
      
      expect(promotionMove).toBeDefined();
      expect(promotionMove?.reason).toContain('promotion');
    });
    
    it('should prioritize moves correctly', () => {
      const tacticalPGN = '1. e4 e5 2. Bc4 Nf6 3. Qh5 Nxh5 4. Bxf7#';
      const result = selectPositionsForAnalysis(tacticalPGN, {
        maxPositions: 3,
        includeOpening: false,
        includeTactical: true,
        includeMaterialSwings: false,
        includeCheckMate: true
      });
      
      // Checkmate should have highest priority
      const priorities = result.candidates.map(c => c.priority);
      const maxPriority = Math.max(...priorities);
      const mateMove = result.candidates.find(c => c.moveSAN.includes('#'));
      
      expect(mateMove?.priority).toBe(maxPriority);
    });
    
    it('should limit to maxPositions', () => {
      const longPGN = samplePGN + ' 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6 14. Nb3 a5 15. Be3 a4 16. Nbd2 Bd7 17. Rc1 Qb8';
      const result = selectPositionsForAnalysis(longPGN, {
        maxPositions: 3,
        includeOpening: true,
        includeTactical: true,
        includeMaterialSwings: true,
        includeCheckMate: true
      });
      
      expect(result.candidates.length).toBeLessThanOrEqual(3);
    });
    
    it('should include opening moves when requested', () => {
      const result = selectPositionsForAnalysis(samplePGN, {
        maxPositions: 10,
        includeOpening: true,
        includeTactical: false,
        includeMaterialSwings: false,
        includeCheckMate: false
      });
      
      const openingMoves = result.candidates.filter(c => 
        c.reason.includes('opening')
      );
      
      expect(openingMoves.length).toBeGreaterThan(0);
      expect(openingMoves.length).toBeLessThanOrEqual(3); // First 3 moves
    });
  });
  
  describe('selectPositions (main entry point)', () => {
    it('should use first-n when smart sampling disabled', () => {
      const result = selectPositions(samplePGN, 3, false);
      
      expect(result.samplingReason).toBe('first-n-ply');
      expect(result.candidates.length).toBe(3);
    });
    
    it('should use smart sampling when enabled', () => {
      const tacticalPGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6';
      const result = selectPositions(tacticalPGN, 5, true);
      
      expect(result.samplingReason).toBe('smart-sampling');
      expect(result.candidates.length).toBeGreaterThan(0);
    });
    
    it('should fallback to first-n if smart sampling finds nothing', () => {
      // Very quiet game with no tactics
      const quietPGN = '1. d3 d6 2. Nd2 Nd7 3. Ngf3 Ngf6';
      const result = selectPositions(quietPGN, 3, true);
      
      // Should either find opening moves or fallback
      expect(result.candidates.length).toBeGreaterThan(0);
    });
    
    it('should identify game phases correctly', () => {
      const fullGamePGN = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 O-O 8. c3 d6 9. h3 Na5 10. Bc2 c5 11. d4 Qc7 12. Nbd2 cxd4 13. cxd4 Nc6 14. Nb3 a5 15. Be3 a4 16. Nbd2 Bd7 17. Rc1 Qb8 18. dxe5 dxe5 19. Qe2 Rc8 20. Rcd1 Rd8';
      const result = selectPositions(fullGamePGN, 10, true);
      
      const openingPhase = result.candidates.filter(c => c.phase === 'opening');
      const middlegamePhase = result.candidates.filter(c => c.phase === 'middlegame');
      
      expect(openingPhase.length + middlegamePhase.length).toBe(result.candidates.length);
    });
  });
});
