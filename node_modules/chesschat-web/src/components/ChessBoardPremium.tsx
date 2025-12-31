// Premium 2D Chess Board with Wooden Theme and Smooth Animations
// Features: Wooden board, drag-and-drop, spring animations, move highlights, check flash, fake 3D

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Square } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import { getPieceSymbol, toSquare, getSquareColor } from '../lib/chess';
import '../styles/ChessBoardPremium.css';

interface DragState {
  isDragging: boolean;
  piece: string;
  startSquare: Square;
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
}

export const ChessBoardPremium: React.FC = () => {
  const { chess, isPlayerTurn, isThinking, makePlayerMove, boardVersion } = useGameStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const [checkSquare, setCheckSquare] = useState<Square | null>(null);
  const [capturedPiece, setCapturedPiece] = useState<{ square: Square; piece: string } | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const dragPreviewRef = useRef<HTMLDivElement>(null);

  const board = chess.getBoard();

  // Update check state
  useEffect(() => {
    if (chess.isCheck()) {
      // Find the king in check
      const kingSquare = chess.getKingSquare(chess.getTurn());
      setCheckSquare(kingSquare);
    } else {
      setCheckSquare(null);
    }
  }, [boardVersion]);

  // Update last move
  useEffect(() => {
    const history = chess.getMoveHistory();
    if (history.length > 0) {
      const lastMoveObj = history[history.length - 1];
      setLastMove({ from: lastMoveObj.from, to: lastMoveObj.to });
    }
  }, [boardVersion]);

  // Handle square click (non-drag interaction)
  const handleSquareClick = useCallback(async (square: Square) => {
    if (!isPlayerTurn || isThinking || dragState) return;

    const piece = chess.getPiece(square);

    // UI ERROR TRACKING: Log the click for diagnostics
    console.log(`[UI Click] Square: ${square}, Piece: ${piece}, Selected: ${selectedSquare}`);

    // If clicking on a selected piece again, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If no piece selected and clicking on player piece, select it
    if (!selectedSquare && piece && piece.startsWith('w')) {
      setSelectedSquare(square);
      const moves = chess.getLegalMoves(square);
      setLegalMoves(moves);
      // soundManager.playMove(); // TODO: Implement sound
      return;
    }

    // If piece selected, try to move
    if (selectedSquare) {
      const targetPiece = chess.getPiece(square);
      
      // UI ERROR TRACKING: Verify the selected square still has the expected piece
      const currentPiece = chess.getPiece(selectedSquare);
      if (!currentPiece) {
        const uiError = `UI ERROR: Selected square ${selectedSquare} no longer has a piece. Visual state diverged from game state.`;
        console.error(`❌ [UI Error] ${uiError}`);
        console.error(`[UI Error Details] Target: ${square}, FEN: ${chess.getFEN()}`);
        // Reset UI state to match game state
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      
      try {
        // Check if this is a capture
        if (targetPiece) {
          setCapturedPiece({ square, piece: getPieceSymbol(targetPiece) });
          setTimeout(() => setCapturedPiece(null), 300);
        }
        
        try {
          console.log(`[UI Move] Attempting: ${selectedSquare} → ${square}`);
          await makePlayerMove(selectedSquare, square);
          console.log(`[UI Move] ✅ Success: ${selectedSquare} → ${square}`);
          // soundManager.playCapture(); // TODO: Implement sound
          setSelectedSquare(null);
          setLegalMoves([]);
        } catch (error) {
          console.error(`❌ [UI Move Failed] ${selectedSquare} → ${square}:`, error);
          // Invalid move - show bounce animation with detailed feedback
          animateInvalidMove(selectedSquare, square);
        }
      } catch (error) {
        console.error('Move error:', error);
        animateInvalidMove(selectedSquare, square);
      }
    }
  }, [selectedSquare, isPlayerTurn, isThinking, makePlayerMove, dragState]);

  // Animate invalid move (bounce back) with detailed feedback
  const animateInvalidMove = useCallback((fromSquare: Square, toSquare?: Square) => {
    const squareElement = document.querySelector(`[data-square="${fromSquare}"]`) as HTMLElement;
    if (squareElement) {
      squareElement.classList.add('bounce-back');
      
      // Show detailed feedback about why the move failed
      const piece = chess.getPiece(fromSquare);
      const legalMoves = chess.getLegalMoves(fromSquare);
      
      if (toSquare) {
        console.log(`❌ Invalid move: ${fromSquare} to ${toSquare}`);
        console.log(`📋 Legal moves for ${piece} on ${fromSquare}:`, legalMoves);
        
        // Show user-friendly error message
        const moveNames = legalMoves.map(sq => `${fromSquare}-${sq}`).join(', ');
        if (legalMoves.length > 0) {
          console.log(`💡 Valid moves available: ${moveNames}`);
        } else {
          console.log(`🚫 No legal moves available for ${piece} on ${fromSquare}`);
        }
      }
      
      setTimeout(() => {
        squareElement.classList.remove('bounce-back');
        setSelectedSquare(null);
        setLegalMoves([]);
      }, 300);
    }
  }, [chess]);

  // Drag handlers
  const handleMouseDown = useCallback((e: React.MouseEvent, square: Square) => {
    if (!isPlayerTurn || isThinking) return;

    const piece = chess.getPiece(square);
    if (!piece || !piece.startsWith('w')) return;

    e.preventDefault();
    
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setDragState({
      isDragging: true,
      piece: getPieceSymbol(piece),
      startSquare: square,
      currentX: startX,
      currentY: startY,
      startX,
      startY
    });

    // Show legal moves
    const moves = chess.getLegalMoves(square);
    setLegalMoves(moves);
    setSelectedSquare(square);

    // soundManager.playMove(); // TODO: Implement sound
  }, [isPlayerTurn, isThinking]);

  // Mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragState(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
  }, [dragState]);

  // Mouse up - complete drag
  const handleMouseUp = useCallback(async (e: MouseEvent) => {
    if (!dragState || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find target square
    const squareSize = rect.width / 8;
    const file = Math.floor(x / squareSize);
    const rank = Math.floor(y / squareSize);
    
    // UI ERROR TRACKING: Log drag operation
    console.log(`[UI Drag] From: ${dragState.startSquare}, To coords: (${file}, ${rank})`);
    
    if (file >= 0 && file < 8 && rank >= 0 && rank < 8) {
      const targetSquare = toSquare(file, 7 - rank);
      console.log(`[UI Drag] Target square: ${targetSquare}`);
      
      // UI ERROR TRACKING: Verify drag source still has the piece
      const sourcePiece = chess.getPiece(dragState.startSquare);
      if (!sourcePiece) {
        const uiError = `UI ERROR: Drag source ${dragState.startSquare} no longer has a piece. Visual state diverged.`;
        console.error(`❌ [UI Error] ${uiError}`);
        console.error(`[UI Error Details] Expected piece: ${dragState.piece}, Target: ${targetSquare}, FEN: ${chess.getFEN()}`);
        setDragState(null);
        setSelectedSquare(null);
        setLegalMoves([]);
        return;
      }
      
      if (targetSquare !== dragState.startSquare) {
        const targetPiece = chess.getPiece(targetSquare);
        
        // Check if this is a capture
        if (targetPiece) {
          setCapturedPiece({ square: targetSquare, piece: getPieceSymbol(targetPiece) });
          setTimeout(() => setCapturedPiece(null), 300);
        }
        
        try {
          console.log(`[UI Drag] Attempting move: ${dragState.startSquare} → ${targetSquare}`);
          await makePlayerMove(dragState.startSquare, targetSquare);
          console.log(`[UI Drag] ✅ Success: ${dragState.startSquare} → ${targetSquare}`);
          // soundManager.playCapture(); // TODO: Implement sound
        } catch (error) {
          console.error(`❌ [UI Drag Failed] ${dragState.startSquare} → ${targetSquare}:`, error);
          animateInvalidMove(dragState.startSquare);
        }
      }
    } else {
      console.log('[UI Drag] Outside board, canceling');
      // Dragged outside board - bounce back
      animateInvalidMove(dragState.startSquare);
    }

    // Clean up drag state
    setDragState(null);
    setSelectedSquare(null);
    setLegalMoves([]);
  }, [dragState, makePlayerMove, animateInvalidMove]);

  // Set up mouse event listeners
  useEffect(() => {
    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragState, handleMouseMove, handleMouseUp]);

  // Render square
  const renderSquare = (piece: any, file: number, rank: number) => {
    const square = toSquare(file, rank) as Square;
    const isLight = getSquareColor(square) === 'light';
    const isSelected = selectedSquare === square;
    const isLegalMove = legalMoves.includes(square);
    const isLastMoveSquare = lastMove && (lastMove.from === square || lastMove.to === square);
    const isCheck = checkSquare === square;
    const isCaptured = capturedPiece && capturedPiece.square === square;
    const isDragStart = dragState && dragState.startSquare === square;

    const pieceSymbol = piece ? getPieceSymbol(piece) : '';
    
    return (
      <div
        key={square}
        data-square={square}
        className={`
          chess-square
          ${isLight ? 'light' : 'dark'}
          ${isSelected ? 'selected' : ''}
          ${isLegalMove ? 'legal-move' : ''}
          ${isLastMoveSquare ? 'last-move' : ''}
          ${isCheck ? 'check' : ''}
          ${isCaptured ? 'captured' : ''}
        `}
        onClick={() => handleSquareClick(square)}
        onMouseDown={(e) => handleMouseDown(e, square)}
      >
        {/* Square coordinates for debugging */}
        <div className="square-coord">{square}</div>
        
        {/* Piece */}
        {piece && !isDragStart && (
          <div className={`chess-piece ${piece.startsWith('w') ? 'white' : 'black'}`}>
            {pieceSymbol}
          </div>
        )}

        {/* Legal move indicator */}
        {isLegalMove && (
          <div className="legal-move-indicator">
            {chess.getPiece(square) ? '×' : '•'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="chess-board-container">
      {/* Perspective wrapper with wooden frame */}
      <div className="board-wrapper">
        <div className="board-frame">
          <div 
            ref={boardRef} 
            className="chess-board-premium"
          >
            {/* Render all squares */}
            {board.map((row, rowIndex) =>
              row.map((piece, colIndex) => 
                renderSquare(piece, colIndex, 7 - rowIndex)
              )
            )}

            {/* Drag preview */}
            {dragState && (
              <div
                ref={dragPreviewRef}
                className="drag-preview"
                style={{
                  left: dragState.currentX - 30,
                  top: dragState.currentY - 30
                }}
              >
                {dragState.piece}
              </div>
            )}
          </div>
          
          {/* File and rank labels */}
          <div className="board-labels">
            <div className="files">
              {'abcdefgh'.split('').map(file => (
                <div key={file} className="file-label">{file}</div>
              ))}
            </div>
            <div className="ranks">
              {[8,7,6,5,4,3,2,1].map(rank => (
                <div key={rank} className="rank-label">{rank}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ChessBoardPremium as ChessBoardEnhanced };