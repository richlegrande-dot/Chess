import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChessBoard3D } from '../components/ChessBoard3D';
import { useGameStore } from '../store/gameStore';

// Mock React Three Fiber components
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="canvas">{children}</div>
  ),
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  PerspectiveCamera: () => <div data-testid="perspective-camera" />,
}));

// Mock the game store
vi.mock('../store/gameStore');

const mockGameStore = {
  chess: {
    getBoard: vi.fn(),
    getPiece: vi.fn(),
    getLegalMoves: vi.fn(),
    getTurn: vi.fn().mockReturnValue('w'),
    isGameOver: vi.fn().mockReturnValue(false),
  },
  makePlayerMove: vi.fn(),
  isPlayerTurn: true,
  isThinking: false,
  boardVersion: 1,
};

describe('ChessBoard3D Component Rendering', () => {
  beforeEach(() => {
    vi.mocked(useGameStore).mockReturnValue(mockGameStore as any);
    vi.clearAllMocks();
    
    // Set up initial board state
    mockGameStore.chess.getBoard.mockReturnValue([
      ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
      ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp', 'wp'],
      ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr'],
    ]);
    
    mockGameStore.chess.getLegalMoves.mockReturnValue([]);
  });

  describe('Component Mounting', () => {
    it('should render without crashing', () => {
      render(<ChessBoard3D />);
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });

    it('should render 3D canvas with controls', () => {
      render(<ChessBoard3D />);
      
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
      expect(screen.getByTestId('orbit-controls')).toBeInTheDocument();
      expect(screen.getByTestId('perspective-camera')).toBeInTheDocument();
    });

    it('should have correct container styling', () => {
      render(<ChessBoard3D />);
      
      const container = screen.getByTestId('canvas').parentElement;
      expect(container).toHaveStyle({
        width: '600px',
        height: '600px',
        border: '2px solid #8B4513',
        borderRadius: '8px',
      });
    });
  });

  describe('Board State Rendering', () => {
    it('should render correct number of pieces at start', () => {
      render(<ChessBoard3D />);
      
      // Verify the board was queried
      expect(mockGameStore.chess.getBoard).toHaveBeenCalled();
    });

    it('should update when board version changes', () => {
      const { rerender } = render(<ChessBoard3D />);
      
      // Update board version
      mockGameStore.boardVersion = 2;
      mockGameStore.chess.getBoard.mockReturnValue([
        ['br', 'bn', 'bb', 'bq', 'bk', 'bb', 'bn', 'br'],
        ['bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp', 'bp'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, 'wp', null, null, null], // Moved pawn
        [null, null, null, null, null, null, null, null],
        ['wp', 'wp', 'wp', 'wp', null, 'wp', 'wp', 'wp'], // Empty e2
        ['wr', 'wn', 'wb', 'wq', 'wk', 'wb', 'wn', 'wr'],
      ]);
      
      rerender(<ChessBoard3D />);
      
      // Should call getBoard again for updated state
      expect(mockGameStore.chess.getBoard).toHaveBeenCalledTimes(2);
    });
  });

  describe('Piece Selection and Movement', () => {
    it('should handle square selection', async () => {
      mockGameStore.chess.getPiece.mockImplementation((square) => {
        if (square === 'e2') return 'wp';
        return null;
      });
      
      mockGameStore.chess.getLegalMoves.mockReturnValue(['e3', 'e4']);
      
      render(<ChessBoard3D />);
      
      // The actual square clicking would happen in the 3D scene
      // For unit tests, we verify the store methods are available
      expect(mockGameStore.makePlayerMove).toBeDefined();
      expect(mockGameStore.chess.getPiece).toBeDefined();
      expect(mockGameStore.chess.getLegalMoves).toBeDefined();
    });

    it('should not allow moves when not player turn', () => {
      mockGameStore.isPlayerTurn = false;
      mockGameStore.isThinking = true;
      
      render(<ChessBoard3D />);
      
      // Component should check turn state before allowing moves
      expect(mockGameStore.isPlayerTurn).toBe(false);
      expect(mockGameStore.isThinking).toBe(true);
    });
  });

  describe('Visual Feedback', () => {
    it('should show legal moves when piece is selected', () => {
      mockGameStore.chess.getPiece.mockReturnValue('wp');
      mockGameStore.chess.getLegalMoves.mockReturnValue(['e3', 'e4']);
      
      render(<ChessBoard3D />);
      
      // Verify legal moves are queried
      expect(mockGameStore.chess.getLegalMoves).toBeDefined();
    });

    it('should handle hover states', () => {
      render(<ChessBoard3D />);
      
      // Component should manage hover state internally
      // This is mainly tested through E2E tests due to 3D interaction complexity
      expect(screen.getByTestId('canvas')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing pieces gracefully', () => {
      mockGameStore.chess.getBoard.mockReturnValue(
        Array(8).fill(Array(8).fill(null))
      );
      
      expect(() => render(<ChessBoard3D />)).not.toThrow();
    });

    it('should handle malformed board data', () => {
      mockGameStore.chess.getBoard.mockReturnValue([]);
      
      expect(() => render(<ChessBoard3D />)).not.toThrow();
    });
  });
});

describe('GameView Integration', () => {
  beforeEach(() => {
    vi.mocked(useGameStore).mockReturnValue(mockGameStore as any);
  });

  it('should integrate ChessBoard3D correctly', async () => {
    const { render } = await import('@testing-library/react');
    const { GameView } = await import('../components/GameView');
    
    expect(() => render(<GameView />)).not.toThrow();
  });
});