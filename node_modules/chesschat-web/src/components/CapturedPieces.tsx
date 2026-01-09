// Captured Pieces Display Component
// Shows pieces captured by both user and CPU with animations

import React from 'react';
import { getPieceSymbol } from '../lib/chess';
import '../styles/CapturedPieces.css';

export interface CapturedPiecesData {
  red: string[]; // RED/WHITE pieces that were captured
  black: string[]; // BLACK pieces that were captured
}

interface CapturedPiecesProps {
  capturedPieces: CapturedPiecesData;
  recentCapture?: {
    capturedColor: 'red' | 'black'; // Color of piece that was captured
    pieceType: string; // The piece type that was captured
    timestamp: number;
  } | null;
}

// Piece values for material count
const PIECE_VALUES: Record<string, number> = {
  'p': 1,
  'n': 3,
  'b': 3,
  'r': 5,
  'q': 9,
};

const getPieceValue = (piece: string): number => {
  const type = piece.substring(1); // Remove color prefix
  return PIECE_VALUES[type] || 0;
};

const calculateMaterialAdvantage = (captured: CapturedPiecesData): { red: number; black: number } => {
  const redValue = captured.red.reduce((sum, piece) => sum + getPieceValue(piece), 0);
  const blackValue = captured.black.reduce((sum, piece) => sum + getPieceValue(piece), 0);
  
  return {
    red: Math.max(0, blackValue - redValue),
    black: Math.max(0, redValue - blackValue),
  };
};

export const CapturedPieces: React.FC<CapturedPiecesProps> = ({
  capturedPieces,
  recentCapture,
}) => {
  const materialAdvantage = calculateMaterialAdvantage(capturedPieces);
  
  // Determine if recent capture should be animated
  const isRecentCapture = (capturedColor: 'red' | 'black', index: number): boolean => {
    if (!recentCapture) return false;
    const capturedList = capturedColor === 'red' ? capturedPieces.red : capturedPieces.black;
    return recentCapture.capturedColor === capturedColor && index === capturedList.length - 1;
  };

  const renderCapturedRow = (
    label: string,
    pieces: string[],
    capturedColor: 'red' | 'black',
    advantage: number
  ) => {
    return (
      <div className={`captured-row ${capturedColor}`}>
        <div className="captured-label">{label}</div>
        <div className="captured-pieces-container">
          {pieces.length === 0 ? (
            <div className="no-captures">—</div>
          ) : (
            pieces.map((piece, index) => {
              const isRecent = isRecentCapture(capturedColor, index);
              return (
                <div
                  key={`${piece}-${index}`}
                  className={`captured-piece ${isRecent ? 'animate-in' : ''}`}
                  data-delay={index * 50}
                >
                  {getPieceSymbol(piece)}
                </div>
              );
            })
          )}
          {advantage > 0 && (
            <div className="material-advantage">+{advantage}</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="captured-pieces-display">
      {/* RED/WHITE pieces captured (top) */}
      {renderCapturedRow(
        '⚪ Red Captured',
        capturedPieces.red,
        'red',
        materialAdvantage.red
      )}

      {/* BLACK pieces captured (bottom) */}
      {renderCapturedRow(
        '⚫ Black Captured',
        capturedPieces.black,
        'black',
        materialAdvantage.black
      )}
    </div>
  );
};
