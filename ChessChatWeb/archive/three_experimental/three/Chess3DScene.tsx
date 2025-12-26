import React, { useRef } from 'react';
import * as THREE from 'three';
import { Chess3DBoard } from './Chess3DBoard';
import { Chess3DPieces } from './Chess3DPieces';

export const Chess3DScene: React.FC = () => {
  const sceneRef = useRef<THREE.Group>(null);

  return (
    <group ref={sceneRef}>
      {/* Ground plane for shadows */}
      <mesh 
        receiveShadow 
        position={[0, -0.1, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[20, 20]} />
        <shadowMaterial opacity={0.2} />
      </mesh>
      
      {/* 3D Board */}
      <Chess3DBoard />
      
      {/* 3D Pieces */}
      <Chess3DPieces />
    </group>
  );
};