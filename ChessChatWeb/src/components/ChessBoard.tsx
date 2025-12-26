// ChessBoard Component

import React, { useState } from 'react';
import type { Square } from 'chess.js';
import { useGameStore } from '../store/gameStore';
import { getPieceSymbol, toSquare, getSquareColor } from '../lib/chess';
import '../styles/ChessBoard.css';

export const ChessBoard: React.FC = () => {
  const { chess, isPlayerTurn, isThinking, makePlayerMove } = useGameStore();
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);

  const board = chess.getBoard();

  const handleSquareClick = async (row: number, col: number) => {
    if (!isPlayerTurn || isThinking) return;

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
    await makePlayerMove(selectedSquare, square);

    // Clear selection
    setSelectedSquare(null);
    setLegalMoves([]);
  };

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

  return (
    <div className="chessboard-container">
      <div className="chessboard">
        {board.map((row, rowIndex) => (
          <React.Fragment key={rowIndex}>
            {row.map((piece, colIndex) => {
              const square = toSquare(rowIndex, colIndex);
              const squareColor = getSquareColor(square);
              const isSelected = isSquareSelected(rowIndex, colIndex);
              const isLegalMove = isSquareLegalMove(rowIndex, colIndex);
              const isInCheck = isSquareInCheck(rowIndex, colIndex);

              return (
                <div
                  key={`${rowIndex}-${colIndex}`}
                  className={`square ${squareColor} ${isSelected ? 'selected' : ''} ${
                    isLegalMove ? 'legal-move' : ''
                  } ${isInCheck ? 'in-check' : ''}`}
                  onClick={() => handleSquareClick(rowIndex, colIndex)}
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
                  {piece && (
                    <div className="piece">{getPieceSymbol(piece)}</div>
                  )}

                  {/* Legal move indicator */}
                  {isLegalMove && !piece && <div className="move-dot" />}
                  {isLegalMove && piece && <div className="capture-ring" />}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Turn indicator */}
      <div className="turn-indicator">
        {isThinking ? (
          <div className="thinking">
            <div className="spinner" />
            <span>AI is thinking...</span>
          </div>
        ) : (
          <span>
            {isPlayerTurn ? '⚪ Your turn (White)' : '⚫ AI is playing (Black)'}
          </span>
        )}
      </div>
    </div>
  );
};
