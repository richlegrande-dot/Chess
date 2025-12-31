// Board Animation Utilities
// Spring-based animations and visual effects

import type { Square } from 'chess.js';

/**
 * Spring animation presets
 */
export const SPRING_PRESETS = {
  smooth: { tension: 170, friction: 26, mass: 1 },
  snappy: { tension: 300, friction: 30, mass: 1 },
  bouncy: { tension: 200, friction: 10, mass: 1 },
} as const;

/**
 * Calculate spring animation values
 */
export function springAnimation(
  from: number,
  to: number,
  progress: number
): number {
  // Simple easing function approximating spring motion
  const eased = 1 - Math.pow(1 - progress, 3);
  return from + (to - from) * eased;
}

/**
 * Get CSS transform for piece position
 */
export function getPieceTransform(
  fromSquare: Square,
  toSquare: Square,
  progress: number
): string {
  const fromCoords = squareToCoordinates(fromSquare);
  const toCoords = squareToCoordinates(toSquare);

  const x = springAnimation(fromCoords.x, toCoords.x, progress);
  const y = springAnimation(fromCoords.y, toCoords.y, progress);

  return `translate3d(${x}px, ${y}px, 0)`;
}

/**
 * Convert square notation to pixel coordinates
 */
export function squareToCoordinates(square: Square): { x: number; y: number } {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = 8 - parseInt(square[1]); // 8=0, 1=7

  const squareSize = 80; // Default square size in pixels

  return {
    x: file * squareSize,
    y: rank * squareSize,
  };
}

/**
 * Get square from coordinates
 */
export function coordinatesToSquare(x: number, y: number, squareSize: number): Square | null {
  const file = Math.floor(x / squareSize);
  const rank = Math.floor(y / squareSize);

  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;

  const fileLetter = String.fromCharCode(97 + file);
  const rankNumber = 8 - rank;

  return `${fileLetter}${rankNumber}` as Square;
}

/**
 * Animate piece move with spring physics
 */
export function animatePieceMove(
  element: HTMLElement,
  fromSquare: Square,
  toSquare: Square,
  duration: number = 250,
  onComplete?: () => void
): void {
  const startTime = performance.now();

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const transform = getPieceTransform(fromSquare, toSquare, progress);
    element.style.transform = transform;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      onComplete?.();
    }
  }

  requestAnimationFrame(animate);
}

/**
 * Get highlight color for square state
 */
export function getHighlightColor(state: 'selected' | 'legal' | 'check' | 'lastMove'): string {
  switch (state) {
    case 'selected':
      return 'rgba(74, 222, 128, 0.4)'; // Green
    case 'legal':
      return 'rgba(96, 165, 250, 0.3)'; // Blue
    case 'check':
      return 'rgba(239, 68, 68, 0.5)'; // Red
    case 'lastMove':
      return 'rgba(251, 191, 36, 0.3)'; // Yellow
    default:
      return 'transparent';
  }
}

/**
 * Calculate board square gradient
 */
export function getSquareGradient(isDark: boolean): string {
  if (isDark) {
    return 'linear-gradient(135deg, #b58863 0%, #9c6f4f 100%)';
  }
  return 'linear-gradient(135deg, #f0d9b5 0%, #e8d4bb 100%)';
}

/**
 * Get piece shadow based on drag state
 */
export function getPieceShadow(isDragging: boolean, isHovering: boolean): string {
  if (isDragging) {
    return '0 8px 24px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)';
  }
  if (isHovering) {
    return '0 2px 8px rgba(0, 0, 0, 0.2)';
  }
  return 'none';
}

/**
 * Bounce back animation for invalid drop
 */
export function animateBounceBack(
  element: HTMLElement,
  originalSquare: Square,
  duration: number = 200
): void {
  const coords = squareToCoordinates(originalSquare);
  
  element.style.transition = `transform ${duration}ms cubic-bezier(0.34, 1.56, 0.64, 1)`;
  element.style.transform = `translate3d(${coords.x}px, ${coords.y}px, 0)`;

  setTimeout(() => {
    element.style.transition = '';
  }, duration);
}

/**
 * Snap animation for valid drop
 */
export function animateSnap(
  element: HTMLElement,
  targetSquare: Square,
  duration: number = 150
): void {
  const coords = squareToCoordinates(targetSquare);
  
  element.style.transition = `transform ${duration}ms cubic-bezier(0.25, 0.46, 0.45, 0.94)`;
  element.style.transform = `translate3d(${coords.x}px, ${coords.y}px, 0) scale(1)`;

  setTimeout(() => {
    element.style.transition = '';
  }, duration);
}

/**
 * Parse move history to get last move squares
 */
export function getLastMoveSquares(pgn: string): { from: Square; to: Square } | null {
  const moves = pgn.trim().split(/\s+/).filter(m => !m.match(/^\d+\.$/));
  if (moves.length === 0) return null;

  const lastMove = moves[moves.length - 1];
  
  // Simple extraction - would need proper PGN parsing for complex notation
  const match = lastMove.match(/([a-h][1-8])([a-h][1-8])/);
  if (!match) return null;

  return {
    from: match[1] as Square,
    to: match[2] as Square,
  };
}

/**
 * Performance: Reduce motion check
 */
export function shouldReduceMotion(): boolean {
  if (typeof window === 'undefined') return false;
  
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  return mediaQuery.matches || localStorage.getItem('reduce-motion') === 'true';
}

/**
 * Get animation duration based on reduced motion preference
 */
export function getAnimationDuration(defaultMs: number): number {
  return shouldReduceMotion() ? 0 : defaultMs;
}
