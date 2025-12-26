// Enhanced ChessBoard Component with Drag & Drop
// Features: GPU-accelerated dragging, smooth animations, accessibility fallback

import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { Square } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import { getPieceSymbol, toSquare, getSquareColor } from '../lib/chess';
import { useDragPiece } from '../lib/useDragPiece';
import { soundManager, initSounds } from '../lib/sounds';
import '../styles/ChessBoard.css';

export const ChessBoard: React.FC = () => {
  const { chess, isPlayerTurn, isThinking, makePlayerMove, boardVersion } = useGameStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [isDragEnabled, setIsDragEnabled] = useState(true);

  // Get board from chess instance - boardVersion ensures re-render when moves are made
  const board = chess.getBoard();
  const pgn = chess.getPGN();
  const fen = chess.getFEN();

  // Debug logging to track board state changes
  useEffect(() => {
    console.log(`[Board Render] Version: ${boardVersion}, FEN: ${fen}`);
    console.log(`[Board Render] PGN: ${pgn}`);
    
    // Create human-readable board representation
    const boardRepresentation = board.map((row, rowIndex) => {
      const rank = 8 - rowIndex;
      const rowStr = row.map((piece, colIndex) => {
        const file = String.fromCharCode(97 + colIndex);
        const square = `${file}${rank}`;
        return piece ? `${square}:${piece}` : `${square}:--`;
      }).join(' ');
      return `${rank}: ${rowStr}`;
    }).join('\n');
    
    console.log(`[Board Render] Visual board:\n${boardRepresentation}`);
    
    // Validate specific squares against FEN for common errors
    console.log(`[Board Validation] e2: ${chess.getPiece('e2')} (should match visual)`);
    console.log(`[Board Validation] e3: ${chess.getPiece('e3')} (should match visual)`);
    console.log(`[Board Validation] b7: ${chess.getPiece('b7')} (should match visual)`);
    console.log(`[Board Validation] b5: ${chess.getPiece('b5')} (should match visual)`);
  }, [boardVersion, fen, pgn]);

  // Initialize sounds on first interaction
  useEffect(() => {
    const handleFirstInteraction = () => {
      initSounds();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { once: true });
    window.addEventListener('touchstart', handleFirstInteraction, { once: true });

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Load drag preference
  useEffect(() => {
    const pref = localStorage.getItem('drag-enabled');
    if (pref !== null) {
      setIsDragEnabled(pref !== 'false');
    }
  }, []);

  // Update last move when PGN changes
  useEffect(() => {
    const moves = pgn.trim().split(/\s+/).filter((m: string) => !m.match(/^\d+\.$/));
    if (moves.length > 0) {
      // Track last move for highlighting
      // Note: This is simplified - proper implementation would parse the move
      setLastMove(null); // Reset for now
    }
  }, [pgn]);

  // Drag and drop callbacks
  const handleDragStart = useCallback((square: Square) => {
    if (!isPlayerTurn || isThinking) return;
    
    const piece = chess.getPiece(square);
    if (piece && piece.startsWith('w')) {
      setSelectedSquare(square);
      setLegalMoves(chess.getLegalMoves(square));
    }
  }, [chess, isPlayerTurn, isThinking, boardVersion]);

  const handleDragEnd = useCallback(async (from: Square, to: Square | null) => {
    if (!to || !isPlayerTurn || isThinking) {
      // Bounce back animation handled by CSS
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    const targetPiece = chess.getPiece(to);
    const isCapture = targetPiece !== null;

    // Attempt the move
    await makePlayerMove(from, to);

    // Check if move was successful by seeing if board changed
    const moveSuccessful = chess.getPGN() !== pgn;

    if (moveSuccessful) {
      setLastMove({ from, to });
      
      // Play sound
      if (chess.isCheck()) {
        soundManager.play('check');
      } else if (isCapture) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }

      // Check for game end
      if (chess.isGameOver()) {
        setTimeout(() => soundManager.play('gameEnd'), 300);
      }
    }

    setSelectedSquare(null);
    setLegalMoves([]);
  }, [chess, isPlayerTurn, isThinking, makePlayerMove, pgn, boardVersion]);

  const handleDragMove = useCallback(() => {
    // Update hovered square for visual feedback
    // Implemented via CSS in drag layer
  }, []);

  const { dragState, startDrag, updateDrag, endDrag, setBoardRef } = useDragPiece({
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
    onDragMove: handleDragMove,
  });

  // Click-to-move fallback (accessibility)
  const handleSquareClick = async (row: number, col: number) => {
    if (!isPlayerTurn || isThinking || (isDragEnabled && dragState.isDragging)) return;

    const square = toSquare(row, col);
    const piece = chess.getPiece(square);

    // If no piece selected, select this square if it's a white piece
    if (!selectedSquare) {
      if (piece && piece.startsWith('w')) {
        setSelectedSquare(square);
        setLegalMoves(chess.getLegalMoves(square));
      }
      return;
    }

    // If clicking the same square, deselect
    if (selectedSquare === square) {
      setSelectedSquare(null);
      setLegalMoves([]);
      return;
    }

    // If clicking another white piece, select it instead
    if (piece && piece.startsWith('w')) {
      setSelectedSquare(square);
      setLegalMoves(chess.getLegalMoves(square));
      return;
    }

    // Try to make the move
    const targetPiece = chess.getPiece(square);
    const isCapture = targetPiece !== null;
    const previousPgn = chess.getPGN();

    await makePlayerMove(selectedSquare, square);

    // Check if move was successful
    const moveSuccessful = chess.getPGN() !== previousPgn;

    if (moveSuccessful) {
      setLastMove({ from: selectedSquare, to: square });
      
      // Play sound
      if (chess.isCheck()) {
        soundManager.play('check');
      } else if (isCapture) {
        soundManager.play('capture');
      } else {
        soundManager.play('move');
      }

      if (chess.isGameOver()) {
        setTimeout(() => soundManager.play('gameEnd'), 300);
      }
    }

    // Clear selection
    setSelectedSquare(null);
    setLegalMoves([]);
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent, row: number, col: number) => {
    if (!isDragEnabled || !isPlayerTurn || isThinking) return;

    const square = toSquare(row, col);
    const piece = chess.getPiece(square);

    if (piece && piece.startsWith('w')) {
      e.preventDefault();
      startDrag(square, piece, e.clientX, e.clientY);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      updateDrag(e.clientX, e.clientY);
    }
  }, [dragState.isDragging, updateDrag]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      endDrag(e.clientX, e.clientY);
    }
  }, [dragState.isDragging, endDrag]);

  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent, row: number, col: number) => {
    if (!isDragEnabled || !isPlayerTurn || isThinking) return;

    const square = toSquare(row, col);
    const piece = chess.getPiece(square);

    if (piece && piece.startsWith('w')) {
      e.preventDefault();
      const touch = e.touches[0];
      startDrag(square, piece, touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      const touch = e.touches[0];
      updateDrag(touch.clientX, touch.clientY);
    }
  }, [dragState.isDragging, updateDrag]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (dragState.isDragging) {
      e.preventDefault();
      const touch = e.changedTouches[0];
      endDrag(touch.clientX, touch.clientY);
    }
  }, [dragState.isDragging, endDrag]);

  // Global event listeners for drag
  useEffect(() => {
    if (dragState.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleTouchEnd);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  // Set board ref
  useEffect(() => {
    if (boardRef.current) {
      setBoardRef(boardRef.current);
    }
  }, [setBoardRef]);

  const isSquareSelected = (row: number, col: number): boolean => {
    return selectedSquare === toSquare(row, col);
  };

  const isSquareLegalMove = (row: number, col: number): boolean => {
    return legalMoves.includes(toSquare(row, col));
  };

  const isSquareInCheck = (row: number, col: number): boolean => {
    if (!chess.isCheck()) return false;
    const square = toSquare(row, col);
    const piece = chess.getPiece(square);
    const turn = chess.getTurn();
    return piece === `${turn}k`;
  };

  const isSquareLastMove = (row: number, col: number): boolean => {
    if (!lastMove) return false;
    const square = toSquare(row, col);
    return square === lastMove.from || square === lastMove.to;
  };

  const isSquareBeingDragged = (row: number, col: number): boolean => {
    return dragState.draggedFrom === toSquare(row, col);
  };

  const isSquareHovered = (row: number, col: number): boolean => {
    return dragState.hoveredSquare === toSquare(row, col) && 
           isSquareLegalMove(row, col);
  };

  // Helper function to get piece name for screen readers
  const getPieceName = (piece: string | null): string => {
    if (!piece) return 'empty';
    const color = piece.startsWith('w') ? 'white' : 'black';
    const pieceType = piece.charAt(1);
    const names: Record<string, string> = {
      'k': 'king', 'q': 'queen', 'r': 'rook',
      'b': 'bishop', 'n': 'knight', 'p': 'pawn'
    };
    return `${color} ${names[pieceType] || 'piece'}`;
  };

  // Helper to get square name for screen readers
  const getSquareLabel = (row: number, col: number, piece: string | null): string => {
    const file = String.fromCharCode(97 + col);
    const rank = 8 - row;
    const pieceName = getPieceName(piece);
    const base = `${file}${rank}`;
    if (piece) {
      return `${base}, ${pieceName}`;
    }
    return `${base}, empty square`;
  };

  return (
    <div className="chessboard-container">
      <div 
        ref={boardRef}
        className={`chessboard ${dragState.isDragging ? 'dragging' : ''} ${isThinking || !isPlayerTurn ? 'turn-locked' : ''}`}
        role="grid"
        aria-label={`Chess board. ${isThinking ? 'AI is thinking, please wait.' : isPlayerTurn ? 'Your turn. Use arrow keys to navigate, Enter or Space to select pieces.' : 'Waiting for opponent.'}`}
        aria-busy={isThinking}
      >
        {board.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((piece, colIndex) => {
              const square = toSquare(rowIndex, colIndex);
              const squareColor = getSquareColor(square);
              const isSelected = isSquareSelected(rowIndex, colIndex);
              const isLegalMove = isSquareLegalMove(rowIndex, colIndex);
              const isInCheck = isSquareInCheck(rowIndex, colIndex);
              const isLastMoveSquare = isSquareLastMove(rowIndex, colIndex);
              const isBeingDragged = isSquareBeingDragged(rowIndex, colIndex);
              const isHovered = isSquareHovered(rowIndex, colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`square ${squareColor} 
                    ${isSelected ? 'selected' : ''} 
                    ${isLegalMove ? 'legal-move' : ''} 
                    ${isInCheck ? 'in-check' : ''} 
                    ${isLastMoveSquare ? 'last-move' : ''}
                    ${isHovered ? 'hovered' : ''}
                    ${isBeingDragged ? 'dragging-from' : ''}
                  `}
                  role="gridcell"
                  aria-label={getSquareLabel(rowIndex, colIndex, piece)}
                  aria-selected={isSelected}
                  tabIndex={isPlayerTurn && piece?.startsWith('w') ? 0 : -1}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
                  onMouseDown={(e) => handleMouseDown(e, rowIndex, colIndex)}
                  onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSquareClick(rowIndex, colIndex);
                    }
                  }}
                  data-square={square}
                >
                  {/* Coordinate labels */}
                  {colIndex === 0 && (
                    <div className="rank-label">{8 - rowIndex}</div>
                  )}
                  {rowIndex === 7 && (
                    <div className="file-label">
                      {String.fromCharCode(97 + colIndex)}
                    </div>
                  )}

                  {/* Chess piece */}
                  {piece && !isBeingDragged && (
                    <div 
                      className={`piece ${isPlayerTurn && piece.startsWith('w') ? 'draggable' : ''}`}
                      role="img"
                      aria-label={getPieceName(piece)}
                    >
                      {getPieceSymbol(piece)}
                    </div>
                  )}

                  {/* Legal move indicator */}
                  {isLegalMove && !piece && <div className="move-dot" />}
                  {isLegalMove && piece && <div className="capture-ring" />}
                </div>
              );
            })}
          </React.Fragment>
        ))}

        {/* Dragged piece overlay */}
        {dragState.isDragging && dragState.draggedPiece && dragState.dragPosition && (
          <div
            className="dragged-piece"
            style={{
              left: dragState.dragPosition.x,
              top: dragState.dragPosition.y,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {getPieceSymbol(dragState.draggedPiece)}
          </div>
        )}
      </div>
    </div>
  );
};
