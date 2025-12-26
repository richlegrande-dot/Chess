// Drag and Drop Hook for Chess Pieces
// GPU-accelerated dragging with touch support

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Square } from 'chess.js';

interface DragState {
  isDragging: boolean;
  draggedPiece: string | null;
  draggedFrom: Square | null;
  dragPosition: { x: number; y: number } | null;
  hoveredSquare: Square | null;
}

interface DragCallbacks {
  onDragStart: (square: Square) => void;
  onDragEnd: (from: Square, to: Square | null) => void;
  onDragMove: (position: { x: number; y: number }, square: Square | null) => void;
}

export function useDragPiece(callbacks: DragCallbacks) {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedPiece: null,
    draggedFrom: null,
    dragPosition: null,
    hoveredSquare: null,
  });

  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const boardRef = useRef<HTMLElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Convert screen coordinates to board square
   */
  const getSquareFromCoordinates = useCallback((x: number, y: number): Square | null => {
    if (!boardRef.current) return null;

    const rect = boardRef.current.getBoundingClientRect();
    const relativeX = x - rect.left;
    const relativeY = y - rect.top;

    // Check if within board bounds
    if (relativeX < 0 || relativeY < 0 || relativeX > rect.width || relativeY > rect.height) {
      return null;
    }

    const col = Math.floor((relativeX / rect.width) * 8);
    const row = Math.floor((relativeY / rect.height) * 8);

    if (row < 0 || row > 7 || col < 0 || col > 7) return null;

    // Convert to chess square notation
    const file = String.fromCharCode(97 + col); // a-h
    const rank = String(8 - row); // 8-1
    return `${file}${rank}` as Square;
  }, []);

  /**
   * Start dragging a piece
   */
  const startDrag = useCallback((square: Square, piece: string, clientX: number, clientY: number) => {
    dragStartPos.current = { x: clientX, y: clientY };
    
    setDragState({
      isDragging: true,
      draggedPiece: piece,
      draggedFrom: square,
      dragPosition: { x: clientX, y: clientY },
      hoveredSquare: square,
    });

    callbacks.onDragStart(square);
  }, [callbacks]);

  /**
   * Update drag position (optimized with RAF)
   */
  const updateDrag = useCallback((clientX: number, clientY: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      const hoveredSquare = getSquareFromCoordinates(clientX, clientY);
      
      setDragState(prev => ({
        ...prev,
        dragPosition: { x: clientX, y: clientY },
        hoveredSquare,
      }));

      callbacks.onDragMove({ x: clientX, y: clientY }, hoveredSquare);
    });
  }, [getSquareFromCoordinates, callbacks]);

  /**
   * End dragging and attempt move
   */
  const endDrag = useCallback((clientX: number, clientY: number) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const targetSquare = getSquareFromCoordinates(clientX, clientY);
    const fromSquare = dragState.draggedFrom;

    setDragState({
      isDragging: false,
      draggedPiece: null,
      draggedFrom: null,
      dragPosition: null,
      hoveredSquare: null,
    });

    if (fromSquare) {
      callbacks.onDragEnd(fromSquare, targetSquare);
    }

    dragStartPos.current = null;
  }, [dragState.draggedFrom, getSquareFromCoordinates, callbacks]);

  /**
   * Cancel drag operation
   */
  const cancelDrag = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    setDragState({
      isDragging: false,
      draggedPiece: null,
      draggedFrom: null,
      dragPosition: null,
      hoveredSquare: null,
    });

    dragStartPos.current = null;
  }, []);

  /**
   * Set board reference for coordinate calculations
   */
  const setBoardRef = useCallback((element: HTMLElement | null) => {
    boardRef.current = element;
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    dragState,
    startDrag,
    updateDrag,
    endDrag,
    cancelDrag,
    setBoardRef,
  };
}
