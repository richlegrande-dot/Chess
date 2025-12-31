import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createPieceMaterial } from './materials';

interface Chess3DPieceProps {
  piece: string; // 'p', 'r', 'n', 'b', 'q', 'k'
  color: 'w' | 'b';
  position: [number, number, number];
  isSelected?: boolean;
  onClick?: () => void;
}

export const Chess3DPiece: React.FC<Chess3DPieceProps> = ({
  piece,
  color,
  position,
  isSelected = false,
  onClick
}) => {
  const meshRef = useRef<THREE.Group>(null);
  const material = useMemo(() => createPieceMaterial(color === 'w'), [color]);
  
  // Create piece geometry based on type
  const pieceGeometry = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    
    switch (piece.toLowerCase()) {
      case 'p': // Pawn
        geometries.push(
          new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8),
          new THREE.SphereGeometry(0.1, 8, 6)
        );
        break;
        
      case 'r': // Rook
        geometries.push(
          new THREE.CylinderGeometry(0.18, 0.22, 0.4, 8),
          new THREE.CylinderGeometry(0.25, 0.25, 0.1, 8)
        );
        break;
        
      case 'n': // Knight
        geometries.push(
          new THREE.CylinderGeometry(0.18, 0.22, 0.35, 8),
          new THREE.BoxGeometry(0.15, 0.2, 0.3)
        );
        break;
        
      case 'b': // Bishop
        geometries.push(
          new THREE.CylinderGeometry(0.15, 0.2, 0.45, 8),
          new THREE.SphereGeometry(0.08, 8, 6)
        );
        break;
        
      case 'q': // Queen
        geometries.push(
          new THREE.CylinderGeometry(0.2, 0.25, 0.5, 8),
          new THREE.RingGeometry(0.15, 0.25, 8)
        );
        break;
        
      case 'k': // King
        geometries.push(
          new THREE.CylinderGeometry(0.2, 0.25, 0.55, 8),
          new THREE.BoxGeometry(0.05, 0.15, 0.15)
        );
        break;
        
      default:
        geometries.push(new THREE.CylinderGeometry(0.15, 0.2, 0.3, 8));
    }
    
    return geometries;
  }, [piece]);

  // Idle animation for pieces
  useFrame((_, delta) => {
    if (meshRef.current && !isSelected) {
      meshRef.current.rotation.y += delta * 0.1;
    }
  });

  return (
    <group
      ref={meshRef}
      position={position}
      onClick={onClick}
      scale={isSelected ? [1.1, 1.1, 1.1] : [1, 1, 1]}
    >
      {pieceGeometry.map((geometry, index) => {
        let yOffset = 0;
        
        // Position different parts of the piece
        switch (piece.toLowerCase()) {
          case 'p':
            yOffset = index === 0 ? 0 : 0.2; // Base cylinder, top sphere
            break;
          case 'r':
            yOffset = index === 0 ? 0 : 0.25; // Base, top
            break;
          case 'n':
            yOffset = index === 0 ? 0 : 0.15; // Base, horse head
            break;
          case 'b':
            yOffset = index === 0 ? 0 : 0.3; // Base, top
            break;
          case 'q':
            yOffset = index === 0 ? 0 : 0.35; // Base, crown
            break;
          case 'k':
            yOffset = index === 0 ? 0 : 0.4; // Base, cross
            break;
        }
        
        return (
          <mesh
            key={index}
            position={[0, yOffset, 0]}
            castShadow
            receiveShadow
          >
            <primitive object={geometry} />
            <primitive object={material} />
          </mesh>
        );
      })}
      
      {/* Selection highlight */}
      {isSelected && (
        <mesh position={[0, -0.05, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 0.02, 16]} />
          <meshBasicMaterial 
            color={0x00ff00} 
            transparent 
            opacity={0.5} 
          />
        </mesh>
      )}
    </group>
  );
};