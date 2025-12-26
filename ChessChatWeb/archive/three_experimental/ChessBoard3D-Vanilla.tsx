import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { Chess } from 'chess.js';

interface ChessBoard3DProps {
  chess: Chess;
  onMove?: (move: { from: string; to: string }) => void;
}

export const ChessBoard3D: React.FC<ChessBoard3DProps> = ({ chess, onMove }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const boardGroupRef = useRef<THREE.Group | null>(null);
  const piecesRef = useRef<{ [key: string]: THREE.Mesh }>({});
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);

  // Piece geometries and materials
  const pieceGeometries = useRef<{ [key: string]: THREE.BufferGeometry }>({});
  const materials = useRef<{
    white: THREE.MeshPhongMaterial;
    black: THREE.MeshPhongMaterial;
    lightSquare: THREE.MeshPhongMaterial;
    darkSquare: THREE.MeshPhongMaterial;
    selectedSquare: THREE.MeshPhongMaterial;
    validMove: THREE.MeshPhongMaterial;
  }>();

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current) return;

    console.log('🎯 Initializing vanilla Three.js 3D chess board...');

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      400 / 400,
      0.1,
      1000
    );
    camera.position.set(5, 8, 5);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(400, 400);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Materials
    materials.current = {
      white: new THREE.MeshPhongMaterial({ color: 0xf0f0f0 }),
      black: new THREE.MeshPhongMaterial({ color: 0x333333 }),
      lightSquare: new THREE.MeshPhongMaterial({ color: 0xf0d9b5 }),
      darkSquare: new THREE.MeshPhongMaterial({ color: 0xb58863 }),
      selectedSquare: new THREE.MeshPhongMaterial({ color: 0x4CAF50, transparent: true, opacity: 0.7 }),
      validMove: new THREE.MeshPhongMaterial({ color: 0x2196F3, transparent: true, opacity: 0.5 })
    };

    // Piece geometries
    pieceGeometries.current = {
      pawn: new THREE.ConeGeometry(0.15, 0.6, 8),
      rook: new THREE.BoxGeometry(0.3, 0.6, 0.3),
      knight: new THREE.ConeGeometry(0.2, 0.7, 6),
      bishop: new THREE.ConeGeometry(0.18, 0.8, 8),
      queen: new THREE.ConeGeometry(0.22, 1.0, 12),
      king: new THREE.ConeGeometry(0.25, 1.2, 16)
    };

    // Board group
    const boardGroup = new THREE.Group();
    boardGroupRef.current = boardGroup;
    scene.add(boardGroup);

    // Create chess board squares
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const squareGeometry = new THREE.PlaneGeometry(1, 1);
        const isLight = (row + col) % 2 === 0;
        const squareMaterial = isLight ? materials.current.lightSquare : materials.current.darkSquare;
        
        const square = new THREE.Mesh(squareGeometry, squareMaterial);
        square.rotation.x = -Math.PI / 2;
        square.position.set(col - 3.5, 0, row - 3.5);
        
        // Add square identifier for click detection
        const squareName = String.fromCharCode(97 + col) + (8 - row);
        square.userData = { square: squareName, type: 'square' };
        
        boardGroup.add(square);
      }
    }

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(10, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Mouse controls for camera rotation
    let mouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let currentRotationX = 0;
    let currentRotationY = 0;

    const onMouseDown = (event: MouseEvent) => {
      mouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      mouseDown = false;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!mouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      targetRotationY += deltaX * 0.01;
      targetRotationX += deltaY * 0.01;
      targetRotationX = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetRotationX));
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    // Click detection for piece movement
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onCanvasClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects([...boardGroup.children, ...Object.values(piecesRef.current)]);

      if (intersects.length > 0) {
        const clickedObject = intersects[0].object;
        const userData = clickedObject.userData;

        if (userData.square) {
          handleSquareClick(userData.square);
        }
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Smooth camera rotation
      currentRotationX += (targetRotationX - currentRotationX) * 0.1;
      currentRotationY += (targetRotationY - currentRotationY) * 0.1;

      const radius = 12;
      camera.position.x = Math.sin(currentRotationY) * Math.cos(currentRotationX) * radius;
      camera.position.y = Math.sin(currentRotationX) * radius + 8;
      camera.position.z = Math.cos(currentRotationY) * Math.cos(currentRotationX) * radius;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    };

    animate();
    console.log('✅ Vanilla Three.js 3D chess board initialized successfully!');

    // Cleanup
    return () => {
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      // Dispose geometries and materials
      Object.values(pieceGeometries.current).forEach(geometry => geometry.dispose());
      if (materials.current) {
        Object.values(materials.current).forEach(material => material.dispose());
      }
    };
  }, []);

  // Handle square clicks
  const handleSquareClick = (square: string) => {
    console.log('Square clicked:', square);

    if (selectedSquare === null) {
      // Select a piece
      const piece = chess.get(square as any);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square);
        const moves = chess.moves({ square: square as any, verbose: true });
        setValidMoves(moves.map(move => move.to));
        updateSquareHighlights(square, moves.map(move => move.to));
      }
    } else {
      // Attempt to move
      if (selectedSquare === square) {
        // Deselect
        setSelectedSquare(null);
        setValidMoves([]);
        clearHighlights();
      } else if (validMoves.includes(square)) {
        // Valid move
        try {
          const move = chess.move({ from: selectedSquare as any, to: square as any });
          if (move) {
            onMove?.(move);
            setSelectedSquare(null);
            setValidMoves([]);
            clearHighlights();
            updatePieces();
          }
        } catch (error) {
          console.error('Invalid move:', error);
        }
      } else {
        // Select new piece
        const piece = chess.get(square as any);
        if (piece && piece.color === chess.turn()) {
          setSelectedSquare(square);
          const moves = chess.moves({ square: square as any, verbose: true });
          setValidMoves(moves.map(move => move.to));
          updateSquareHighlights(square, moves.map(move => move.to));
        } else {
          setSelectedSquare(null);
          setValidMoves([]);
          clearHighlights();
        }
      }
    }
  };

  // Update piece positions
  const updatePieces = () => {
    if (!boardGroupRef.current || !materials.current || !sceneRef.current) return;

    // Clear existing pieces
    Object.values(piecesRef.current).forEach(piece => {
      sceneRef.current!.remove(piece);
    });
    piecesRef.current = {};

    // Add current pieces
    const board = chess.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          const geometry = pieceGeometries.current[piece.type] || pieceGeometries.current.pawn;
          const material = piece.color === 'w' ? materials.current.white : materials.current.black;
          
          const pieceMesh = new THREE.Mesh(geometry, material);
          pieceMesh.position.set(col - 3.5, 0.3, row - 3.5);
          pieceMesh.castShadow = true;
          pieceMesh.receiveShadow = true;
          
          const square = String.fromCharCode(97 + col) + (8 - row);
          pieceMesh.userData = { square, type: 'piece' };
          
          piecesRef.current[square] = pieceMesh;
          sceneRef.current.add(pieceMesh);
        }
      }
    }
  };

  // Update square highlights
  const updateSquareHighlights = (selected: string, moves: string[]) => {
    clearHighlights();
    
    if (!boardGroupRef.current || !materials.current) return;

    // Highlight selected square
    addSquareHighlight(selected, materials.current.selectedSquare);

    // Highlight valid moves
    moves.forEach(move => {
      addSquareHighlight(move, materials.current!.validMove);
    });
  };

  const addSquareHighlight = (square: string, material: THREE.Material) => {
    if (!boardGroupRef.current) return;

    const col = square.charCodeAt(0) - 97;
    const row = 8 - parseInt(square[1]);

    const highlightGeometry = new THREE.PlaneGeometry(0.9, 0.9);
    const highlight = new THREE.Mesh(highlightGeometry, material);
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(col - 3.5, 0.01, row - 3.5);
    highlight.userData = { type: 'highlight' };
    
    boardGroupRef.current.add(highlight);
  };

  const clearHighlights = () => {
    if (!boardGroupRef.current) return;

    const highlights = boardGroupRef.current.children.filter(
      child => child.userData.type === 'highlight'
    );
    highlights.forEach(highlight => {
      boardGroupRef.current!.remove(highlight);
    });
  };

  // Update pieces when chess position changes
  useEffect(() => {
    updatePieces();
  }, [chess.fen()]);

  return (
    <div style={{ position: 'relative' }}>
      <div 
        ref={mountRef} 
        style={{ 
          width: '400px', 
          height: '400px', 
          margin: '0 auto',
          border: '2px solid #fff',
          borderRadius: '8px',
          overflow: 'hidden',
          cursor: 'pointer'
        }} 
      />
      <div style={{ 
        textAlign: 'center', 
        marginTop: '0.5rem', 
        fontSize: '0.9rem', 
        opacity: 0.8,
        color: 'white' 
      }}>
        {selectedSquare ? `Selected: ${selectedSquare} (${validMoves.length} moves)` : 'Click a piece to select'}
      </div>
    </div>
  );
};