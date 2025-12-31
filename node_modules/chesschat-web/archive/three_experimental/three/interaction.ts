import * as THREE from 'three';
import { Chess } from 'chess.js';

export interface InteractionState {
  selectedSquare: string | null;
  legalMoves: string[];
  isDragging: boolean;
  draggedPiece: any | null;
}

export class ChessInteractionManager {
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;
  private camera: THREE.Camera;
  private scene: THREE.Scene;
  private chess: Chess;
  
  public state: InteractionState;
  
  constructor(camera: THREE.Camera, scene: THREE.Scene, chess: Chess) {
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.camera = camera;
    this.scene = scene;
    this.chess = chess;
    
    this.state = {
      selectedSquare: null,
      legalMoves: [],
      isDragging: false,
      draggedPiece: null
    };
  }
  
  public updateMousePosition(clientX: number, clientY: number, canvas: HTMLElement): void {
    const rect = canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }
  
  public raycastSquare(): string | null {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    
    // Find intersected board squares
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    for (const intersect of intersects) {
      const object = intersect.object;
      
      // Check if this is a board square
      if (object.userData.type === 'square') {
        return object.userData.notation; // e.g., 'e4'
      }
    }
    
    return null;
  }
  
  public selectSquare(square: string): void {
    if (this.state.selectedSquare === square) {
      // Deselect if clicking the same square
      this.clearSelection();
      return;
    }
    
    const piece = this.chess.get(square as any);
    
    if (piece && piece.color === (this.chess.turn() === 'w' ? 'w' : 'b')) {
      // Select piece and show legal moves
      this.state.selectedSquare = square;
      this.state.legalMoves = this.chess.moves({ square: square as any, verbose: true })
        .map(move => move.to);
    } else if (this.state.selectedSquare && this.state.legalMoves.includes(square)) {
      // Make move if target square is legal
      this.makeMove(this.state.selectedSquare, square);
    } else {
      // Clear selection if clicking empty square or invalid target
      this.clearSelection();
    }
  }
  
  private makeMove(from: string, to: string): void {
    try {
      const move = this.chess.move({ from: from as any, to: to as any });
      
      if (move) {
        // Move successful
        this.clearSelection();
        
        // Trigger move animation and game state update
        this.onMoveComplete?.(move);
      }
    } catch (error) {
      console.error('Invalid move:', error);
      this.clearSelection();
    }
  }
  
  public clearSelection(): void {
    this.state.selectedSquare = null;
    this.state.legalMoves = [];
    this.state.isDragging = false;
    this.state.draggedPiece = null;
  }
  
  public startDrag(square: string): void {
    if (this.state.selectedSquare === square) {
      this.state.isDragging = true;
      // Store dragged piece info
    }
  }
  
  public updateDrag(): void {
    if (!this.state.isDragging) return;
    
    // Update piece position to follow mouse in 3D space
    // This would involve projecting mouse coordinates to board plane
  }
  
  public endDrag(): void {
    if (!this.state.isDragging) return;
    
    const targetSquare = this.raycastSquare();
    
    if (targetSquare && this.state.selectedSquare) {
      this.selectSquare(targetSquare);
    }
    
    this.state.isDragging = false;
  }
  
  // Callback for when a move is completed
  public onMoveComplete?: (move: any) => void;
}

// Utility functions for coordinate conversion
export const fileRankToPosition = (file: number, rank: number): [number, number, number] => {
  const x = (file - 4 + 0.5);
  const z = (rank - 4 + 0.5);
  return [x, 0.3, z];
};

export const positionToFileRank = (x: number, z: number): { file: number; rank: number } => {
  const file = Math.round(x + 3.5);
  const rank = Math.round(z + 3.5);
  return { file, rank };
};

export const fileRankToNotation = (file: number, rank: number): string => {
  const fileChar = String.fromCharCode(97 + file); // 'a' + file
  return `${fileChar}${rank + 1}`;
};

export const notationToFileRank = (notation: string): { file: number; rank: number } => {
  const file = notation.charCodeAt(0) - 97; // 'a' = 0
  const rank = parseInt(notation[1]) - 1;
  return { file, rank };
};