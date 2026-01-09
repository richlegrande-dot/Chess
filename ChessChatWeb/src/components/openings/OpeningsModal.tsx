/**
 * Openings Preview Modal Component
 * Displays chess openings with board preview, navigation controls, and grid coordinates
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { OPENINGS_SEED } from '../../data/openings.seed';
import { getPieceSymbol, getSquareColor } from '../../lib/chess';
import './OpeningsModal.css';

interface OpeningsModalProps {
  open: boolean;
  onClose: () => void;
}

// Build stamp for production verification
const OPENINGS_MODAL_BUILD = '2026-01-09';

export const OpeningsModal: React.FC<OpeningsModalProps> = ({ open, onClose }) => {
  const [selectedOpeningId, setSelectedOpeningId] = useState<string>(OPENINGS_SEED[0]?.id || '');
  const [currentPlyIndex, setCurrentPlyIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter openings based on search query
  const filteredOpenings = useMemo(() => {
    if (!searchQuery.trim()) return OPENINGS_SEED;
    
    const query = searchQuery.toLowerCase();
    return OPENINGS_SEED.filter((opening) => {
      return (
        opening.name.toLowerCase().includes(query) ||
        opening.eco?.toLowerCase().includes(query) ||
        opening.description?.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const selectedOpening = useMemo(
    () => OPENINGS_SEED.find((op) => op.id === selectedOpeningId),
    [selectedOpeningId]
  );

  // Separate chess instance for preview only
  const { fen, sanHistory, isValidPosition } = useMemo(() => {
    const chess = new Chess();
    const history: string[] = [];
    let valid = true;

    if (!selectedOpening) {
      return { fen: chess.fen(), sanHistory: history, isValidPosition: valid };
    }

    try {
      for (let i = 0; i < currentPlyIndex && i < selectedOpening.movesSAN.length; i++) {
        const san = selectedOpening.movesSAN[i];
        const result = chess.move(san);
        if (!result) {
          valid = false;
          break;
        }
        history.push(san);
      }
    } catch (e) {
      valid = false;
    }

    return { fen: chess.fen(), sanHistory: history, isValidPosition: valid };
  }, [selectedOpening, currentPlyIndex]);

  // Reset ply index when changing opening
  useEffect(() => {
    setCurrentPlyIndex(0);
    setErrorMessage(null);
  }, [selectedOpeningId]);

  // Update error message
  useEffect(() => {
    if (!isValidPosition && selectedOpening) {
      setErrorMessage(
        `Invalid move at ply ${currentPlyIndex + 1}. This opening line contains an error.`
      );
    } else {
      setErrorMessage(null);
    }
  }, [isValidPosition, currentPlyIndex, selectedOpening]);

  const handlePrevious = () => {
    if (currentPlyIndex > 0) {
      setCurrentPlyIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (selectedOpening && currentPlyIndex < selectedOpening.movesSAN.length) {
      setCurrentPlyIndex((prev) => prev + 1);
    }
  };

  const handleReset = () => {
    setCurrentPlyIndex(0);
    setErrorMessage(null);
  };

  if (!open) return null;

  return (
    <div className="openings-modal-overlay" onClick={onClose}>
      <div className="openings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="openings-modal-header">
          <h2>📚 Chess Openings Preview</h2>
          <button className="openings-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="openings-modal-body">
          {/* Left side: Opening selector */}
          <div className="openings-selector-panel">
            <h3>Select Opening</h3>
            
            {/* Search input */}
            <div className="openings-search">
              <input
                type="text"
                placeholder="Search openings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="openings-search-input"
              />
              {searchQuery && (
                <button
                  className="openings-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            
            <div className="openings-list">
              {filteredOpenings.length === 0 ? (
                <div className="openings-no-results">
                  No openings match "{searchQuery}"
                </div>
              ) : (
                filteredOpenings.map((opening) => (
                <div
                  key={opening.id}
                  className={`opening-item ${
                    selectedOpeningId === opening.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedOpeningId(opening.id)}
                >
                  <div className="opening-name">{opening.name}</div>
                  {opening.eco && <div className="opening-eco">{opening.eco}</div>}
                  {opening.description && (
                    <div className="opening-description">{opening.description}</div>
                  )}
                </div>
              ))
              )}
            </div>
            <div className="openings-count-note">
              {searchQuery ? (
                <>Showing {filteredOpenings.length} of {OPENINGS_SEED.length} openings</>
              ) : (
                <>Showing {OPENINGS_SEED.length} openings. More coming soon!</>
              )}
            </div>
          </div>

          {/* Right side: Board preview and controls */}
          <div className="openings-preview-panel">
            {selectedOpening && (
              <>
                <div className="opening-header">
                  <h3>{selectedOpening.name}</h3>
                  {selectedOpening.eco && <span className="eco-badge">{selectedOpening.eco}</span>}
                </div>

                {errorMessage && (
                  <div className="opening-error-banner">{errorMessage}</div>
                )}

                <div className="opening-move-counter">
                  Move {currentPlyIndex} of {selectedOpening.movesSAN.length}
                  {currentPlyIndex === 0 && ' (Starting Position)'}
                </div>

                {/* Chessboard with coordinates */}
                <div className="openings-board-container">
                  <OpeningsBoard fen={fen} />
                </div>

                {/* Move controls */}
                <div className="opening-controls">
                  <button
                    className="control-btn"
                    onClick={handleReset}
                    disabled={currentPlyIndex === 0}
                  >
                    ⏮ Reset
                  </button>
                  <button
                    className="control-btn"
                    onClick={handlePrevious}
                    disabled={currentPlyIndex === 0}
                  >
                    ← Previous
                  </button>
                  <button
                    className="control-btn"
                    onClick={handleNext}
                    disabled={
                      !selectedOpening || currentPlyIndex >= selectedOpening.movesSAN.length
                    }
                  >
                    Next →
                  </button>
                </div>

                {/* Move list */}
                <div className="opening-moves-list">
                  <h4>Moves:</h4>
                  <div className="moves-san">
                    {selectedOpening.movesSAN.map((san, idx) => (
                      <span
                        key={idx}
                        className={`san-move ${idx < currentPlyIndex ? 'played' : ''} ${
                          idx === currentPlyIndex - 1 ? 'current' : ''
                        }`}
                      >
                        {idx % 2 === 0 && <span className="move-number">{Math.floor(idx / 2) + 1}.</span>}
                        {san}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Debug info (optional, can be removed) */}
                <details className="opening-debug">
                  <summary>Debug Info</summary>
                  <div className="debug-content">
                    <div><strong>Build:</strong> {OPENINGS_MODAL_BUILD}</div>
                    <div><strong>Current FEN:</strong></div>
                    <div className="debug-fen">{fen}</div>
                    <div><strong>History:</strong> {sanHistory.join(' ')}</div>
                  </div>
                </details>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Simple board component for openings preview with A-H/1-8 coordinates
 */
interface OpeningsBoardProps {
  fen: string;
}

const OpeningsBoard: React.FC<OpeningsBoardProps> = ({ fen }) => {
  const chess = useMemo(() => {
    const c = new Chess();
    try {
      c.load(fen);
    } catch (e) {
      // If FEN is invalid, use starting position
    }
    return c;
  }, [fen]);

  const board = useMemo(() => {
    const b: (string | null)[][] = [];
    for (let rank = 0; rank < 8; rank++) {
      const row: (string | null)[] = [];
      for (let file = 0; file < 8; file++) {
        const square = String.fromCharCode(97 + file) + (8 - rank) as Square;
        const piece = chess.get(square);
        row.push(piece ? `${piece.color}${piece.type}` : null);
      }
      b.push(row);
    }
    return b;
  }, [chess]);

  return (
    <div className="openings-chessboard">
      {board.map((row, rowIndex) => (
        <React.Fragment key={rowIndex}>
          {row.map((piece, colIndex) => {
            const square = String.fromCharCode(97 + colIndex) + (8 - rowIndex) as Square;
            const squareColor = getSquareColor(square);

            return (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`openings-square ${squareColor}`}
              >
                {/* Rank labels (1-8) on left edge */}
                {colIndex === 0 && (
                  <div className="rank-label">{8 - rowIndex}</div>
                )}

                {/* File labels (A-H) on bottom edge */}
                {rowIndex === 7 && (
                  <div className="file-label">
                    {String.fromCharCode(97 + colIndex).toUpperCase()}
                  </div>
                )}

                {/* Chess piece */}
                {piece && (
                  <div className="openings-piece">{getPieceSymbol(piece)}</div>
                )}
              </div>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};
