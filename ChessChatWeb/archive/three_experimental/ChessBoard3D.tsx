import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import type { Square } from 'chess.js';

// 3D Chessboard component with comprehensive error handling
export const ChessBoard3D: React.FC = () => {
  console.log('[ChessBoard3D] Component initializing...');
  
  let gameStore;
  try {
    gameStore = useGameStore();
  } catch (error) {
    console.error('[ChessBoard3D] Failed to access game store:', error);
    return (
      <div style={{ 
        width: '600px', 
        height: '600px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        border: '2px solid #333',
        borderRadius: '8px',
        color: 'white'
      }}>
        Game Store Error
      </div>
    );
  }
  
  const { chess, makePlayerMove, isPlayerTurn, isThinking } = gameStore;
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [hoveredSquare, setHoveredSquare] = useState<Square | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  console.log('[ChessBoard3D] Chess instance available:', !!chess);

  // Comprehensive safety checks
  if (!chess) {
    console.warn('[ChessBoard3D] Chess instance not available - showing placeholder');
    return (
      <div style={{ 
        width: '600px', 
        height: '600px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        border: '2px solid #333',
        borderRadius: '8px',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '4rem' }}>♟️</div>
        <div>Initializing Chess Engine...</div>
      </div>
    );
  }

  let board: (string | null)[][] = [];
  let legalMoves: Square[] = [];
  
  try {
    console.log('[ChessBoard3D] Getting board state...');
    board = chess.getBoard();
    
    // Validate board structure
    if (!Array.isArray(board) || board.length !== 8) {
      throw new Error('Invalid board structure');
    }
    
    // Validate each row
    for (let i = 0; i < 8; i++) {
      if (!Array.isArray(board[i]) || board[i].length !== 8) {
        throw new Error(`Invalid board row ${i}`);
      }
    }
    
    console.log('[ChessBoard3D] Board validated successfully');
    
    // Get legal moves safely
    if (selectedSquare && typeof chess.getLegalMoves === 'function') {
      legalMoves = chess.getLegalMoves(selectedSquare);
    }
    
  } catch (error) {
    console.error('[ChessBoard3D] Error getting board state:', error);
    return (
      <div style={{ 
        width: '600px', 
        height: '600px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        border: '2px solid #333',
        borderRadius: '8px',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '3rem' }}>⚠️</div>
        <div>Board Loading Error</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Error: {error instanceof Error ? error.message : String(error)}</div>
      </div>
    );
  }

  const handleSquareClick = useCallback((square: Square) => {
    if (isThinking || !isPlayerTurn) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        // Deselect if clicking the same square
        setSelectedSquare(null);
      } else if (legalMoves.includes(square)) {
        // Make move if it's legal
        makePlayerMove(selectedSquare, square);
        setSelectedSquare(null);
      } else {
        // Select new square if it has a piece
        const piece = chess.getPiece(square);
        if (piece && piece.startsWith('w')) {
          setSelectedSquare(square);
        } else {
          setSelectedSquare(null);
        }
      }
    } else {
      // Select square if it has a white piece
      const piece = chess.getPiece(square);
      if (piece && piece.startsWith('w')) {
        setSelectedSquare(square);
      }
    }
  }, [selectedSquare, legalMoves, isThinking, isPlayerTurn, makePlayerMove, chess]);

  console.log('[ChessBoard3D] Rendering Canvas component...');

  // Wrap Canvas in error boundary
  try {
    return (
      <div style={{ 
        width: '600px', 
        height: '600px', 
        margin: '0 auto',
        border: '2px solid #333',
        borderRadius: '8px',
        overflow: 'hidden',
        background: '#000'
      }}>
        <Canvas
          ref={canvasRef}
          shadows={false} // Disable shadows initially to prevent issues
          camera={{ position: [8, 8, 8], fov: 50 }}
          style={{ background: '#000' }}
          onCreated={(state) => {
            console.log('[ChessBoard3D] Canvas created successfully');
            // Verify WebGL context is available
            if (!state.gl.getContext) {
              console.warn('[ChessBoard3D] WebGL context not available');
            } else {
              console.log('[ChessBoard3D] WebGL context available');
            }
          }}
          onError={(error) => {
            console.error('[ChessBoard3D] Canvas error:', error);
          }}
          fallback={
            <div style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <div style={{ fontSize: '3rem' }}>🎮</div>
              <div>WebGL not supported</div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Please enable WebGL in your browser</div>
            </div>
          }
        >
        <PerspectiveCamera makeDefault position={[8, 8, 8]} />
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2}
          minDistance={5}
          maxDistance={20}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight 
          position={[10, 10, 5]} 
          intensity={0.8} 
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <pointLight position={[-10, 10, -10]} intensity={0.3} />

        {/* Chess Board */}
        <ChessBoard3DMesh 
          board={board}
          selectedSquare={selectedSquare}
          legalMoves={legalMoves}
          hoveredSquare={hoveredSquare}
          onSquareClick={handleSquareClick}
          onSquareHover={setHoveredSquare}
        />
      </Canvas>
    </div>
  );
  
  } catch (error) {
    console.error('[ChessBoard3D] Canvas rendering error:', error);
    return (
      <div style={{ 
        width: '600px', 
        height: '600px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#000',
        border: '2px solid #333',
        borderRadius: '8px',
        color: 'white',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div style={{ fontSize: '3rem' }}>🔧</div>
        <div>3D Rendering Failed</div>
        <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>Error: {error instanceof Error ? error.message : String(error)}</div>
      </div>
    );
  }
};

// 3D Chess Board Mesh
const ChessBoard3DMesh: React.FC<{
  board: (string | null)[][];
  selectedSquare: Square | null;
  legalMoves: Square[];
  hoveredSquare: Square | null;
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square | null) => void;
}> = ({ board, selectedSquare, legalMoves, hoveredSquare, onSquareClick, onSquareHover }) => {
  
  // Safety check for board data
  if (!board || !Array.isArray(board) || board.length !== 8) {
    console.warn('[ChessBoard3D] Invalid board data received:', board);
    return null;
  }

  const squares = [];
  const pieces = [];

  // Create board squares and pieces
  for (let rank = 0; rank < 8; rank++) {
    const row = board[rank];
    if (!row || !Array.isArray(row) || row.length !== 8) {
      console.warn(`[ChessBoard3D] Invalid row data at rank ${rank}:`, row);
      continue;
    }
    
    for (let file = 0; file < 8; file++) {
      const square = `${String.fromCharCode(97 + file)}${8 - rank}` as Square;
      const piece = row[file];
      const isLight = (rank + file) % 2 === 0;
      const isSelected = selectedSquare === square;
      const isLegalMove = legalMoves.includes(square);
      const isHovered = hoveredSquare === square;

      // Board square
      squares.push(
        <BoardSquare
          key={square}
          position={[file - 3.5, 0, rank - 3.5]}
          isLight={isLight}
          isSelected={isSelected}
          isLegalMove={isLegalMove}
          isHovered={isHovered}
          square={square}
          onSquareClick={onSquareClick}
          onSquareHover={onSquareHover}
        />
      );

      // Chess piece
      if (piece) {
        pieces.push(
          <ChessPiece3D
            key={`${square}-${piece}`}
            position={[file - 3.5, 0.5, rank - 3.5]}
            piece={piece}
            square={square}
            isSelected={isSelected}
            onPieceClick={onSquareClick}
            onPieceHover={onSquareHover}
          />
        );
      }
    }
  }

  return (
    <group>
      {squares}
      {pieces}
    </group>
  );
};

// Individual board square
const BoardSquare: React.FC<{
  position: [number, number, number];
  isLight: boolean;
  isSelected: boolean;
  isLegalMove: boolean;
  isHovered: boolean;
  square: Square;
  onSquareClick: (square: Square) => void;
  onSquareHover: (square: Square | null) => void;
}> = ({ position, isLight, isSelected, isLegalMove, isHovered, square, onSquareClick, onSquareHover }) => {
  
  const getSquareColor = () => {
    if (isSelected) return '#FFD700'; // Gold for selected
    if (isLegalMove) return '#90EE90'; // Light green for legal moves
    if (isHovered) return '#ADD8E6'; // Light blue for hovered
    return isLight ? '#F0D9B5' : '#B58863'; // Standard board colors
  };

  return (
    <mesh 
      position={position}
      onClick={() => onSquareClick(square)}
      onPointerOver={() => onSquareHover(square)}
      onPointerOut={() => onSquareHover(null)}
    >
      <boxGeometry args={[1, 0.1, 1]} />
      <meshStandardMaterial color={getSquareColor()} />
    </mesh>
  );
};

// 3D Chess Piece
const ChessPiece3D: React.FC<{
  position: [number, number, number];
  piece: string;
  square: Square;
  isSelected: boolean;
  onPieceClick: (square: Square) => void;
  onPieceHover: (square: Square | null) => void;
}> = ({ position, piece, square, isSelected, onPieceClick, onPieceHover }) => {
  
  const getPieceColor = () => {
    return piece.startsWith('w') ? '#F5F5DC' : '#2F2F2F';
  };

  const getPieceGeometry = () => {
    const pieceType = piece.charAt(1);
    switch (pieceType) {
      case 'p': // Pawn
        return <coneGeometry args={[0.25, 0.6, 8]} />;
      case 'r': // Rook
        return <boxGeometry args={[0.4, 0.7, 0.4]} />;
      case 'n': // Knight
        return <boxGeometry args={[0.35, 0.6, 0.3]} />;
      case 'b': // Bishop
        return <coneGeometry args={[0.3, 0.8, 6]} />;
      case 'q': // Queen
        return <cylinderGeometry args={[0.35, 0.25, 0.9, 8]} />;
      case 'k': // King
        return <cylinderGeometry args={[0.4, 0.3, 1.0, 8]} />;
      default:
        return <cylinderGeometry args={[0.3, 0.3, 0.6, 8]} />;
    }
  };

  return (
    <mesh 
      position={[position[0], position[1] + (isSelected ? 0.2 : 0), position[2]]}
      onClick={() => onPieceClick(square)}
      onPointerOver={() => onPieceHover(square)}
      onPointerOut={() => onPieceHover(null)}
      castShadow
      receiveShadow
    >
      {getPieceGeometry()}
      <meshStandardMaterial 
        color={getPieceColor()} 
        metalness={0.2}
        roughness={0.3}
      />
    </mesh>
  );
};