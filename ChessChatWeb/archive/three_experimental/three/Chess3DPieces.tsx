import React, { useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import { Chess3DPiece } from './Chess3DPiece';

interface PiecePosition {
  file: number;
  rank: number;
  piece: string;
  color: 'w' | 'b';
}

export const Chess3DPieces: React.FC = () => {
  const gameStore = useGameStore();
  const [selectedPiece, setSelectedPiece] = useState<PiecePosition | null>(null);
  
  const squareSize = 1;
  
  // Parse FEN to get piece positions
  const piecePositions = useMemo(() => {
    const positions: PiecePosition[] = [];
    
    if (!gameStore.chess) return positions;
    
    // Get board state from FEN instead of direct board() call
    const fen = gameStore.chess.getFEN();
    const chess = new Chess(fen);
    const board = chess.board();
    
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const square = board[rank][file];
        if (square) {
          positions.push({
            file,
            rank: 7 - rank, // Flip rank for proper 3D orientation
            piece: square.type,
            color: square.color
          });
        }
      }
    }
    
    return positions;
  }, [gameStore.chess]);

  // Convert board coordinates to 3D world position
  const boardToWorld = (file: number, rank: number, elevated: boolean = false): [number, number, number] => {
    const x = (file - 4 + 0.5) * squareSize;
    const y = elevated ? 0.7 : 0.3; // Piece height
    const z = (rank - 4 + 0.5) * squareSize;
    return [x, y, z];
  };

  // Convert file/rank to chess notation
  const fileRankToNotation = (file: number, rank: number): string => {
    const files = 'abcdefgh';
    return files[file] + (rank + 1);
  };

  // Handle piece click for selection and moves
  const handlePieceClick = (piece: PiecePosition) => {
    if (!gameStore.isPlayerTurn || gameStore.isThinking) return;
    
    const notation = fileRankToNotation(piece.file, piece.rank);
    
    if (!selectedPiece) {
      // Select piece if it's player's piece (always white for human)
      if (piece.color === 'w' && gameStore.isPlayerTurn) {
        setSelectedPiece(piece);
      }
    } else {
      // Try to make move
      const fromNotation = fileRankToNotation(selectedPiece.file, selectedPiece.rank);
      const toNotation = notation;
      
      // Use game store's move validation
      gameStore.makePlayerMove(fromNotation as any, toNotation as any);
      setSelectedPiece(null);
    }
  };

  // Handle board square clicks (for moving to empty squares)
  const handleSquareClick = (file: number, rank: number) => {
    if (!selectedPiece || !gameStore.isPlayerTurn || gameStore.isThinking) return;
    
    const fromNotation = fileRankToNotation(selectedPiece.file, selectedPiece.rank);
    const toNotation = fileRankToNotation(file, rank);
    
    gameStore.makePlayerMove(fromNotation as any, toNotation as any);
    setSelectedPiece(null);
  };

  return (
    <group>
      {piecePositions.map((piece) => {
        const isSelected = !!(selectedPiece && 
          selectedPiece.file === piece.file && 
          selectedPiece.rank === piece.rank);
        
        const position = boardToWorld(piece.file, piece.rank);
        
        return (
          <Chess3DPiece
            key={`${piece.file}-${piece.rank}-${piece.piece}`}
            piece={piece.piece}
            color={piece.color}
            position={position}
            isSelected={isSelected}
            onClick={() => handlePieceClick(piece)}
          />
        );
      })}
      
      {/* Highlight legal moves if piece is selected */}
      {selectedPiece && (
        <group>
          {(() => {
            const fen = gameStore.chess.getFEN();
            const chess = new Chess(fen);
            return chess.moves({ 
              square: fileRankToNotation(selectedPiece.file, selectedPiece.rank) as any,
              verbose: true 
            }).map((move: any) => {
            const file = move.to.charCodeAt(0) - 97; // 'a' = 0
            const rank = parseInt(move.to[1]) - 1;
            const position = boardToWorld(file, 7 - rank); // Flip rank back
            
            return (
              <mesh
                key={move.to}
                position={position}
                onClick={() => handleSquareClick(file, 7 - rank)}
              >
                <cylinderGeometry args={[0.35, 0.35, 0.02, 16]} />
                <meshBasicMaterial 
                  color={0xffff00} 
                  transparent 
                  opacity={0.5} 
                />
              </mesh>
            );
            });
          })()}
        </group>
      )}
    </group>
  );
};