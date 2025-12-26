import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { useGameStore } from '../store/gameStore';
import { Chess3DScene } from './Chess3DScene';
import './Chess3DView.css';

export const Chess3DView: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const gameStore = useGameStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        // Initialize 3D mode after brief delay
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to initialize 3D view:', error);
        setHasError(true);
        setIsLoading(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  if (hasError) {
    return (
      <div className="chess-3d-loading">
        <div className="error-message">
          <h3>Unable to load 3D Chess</h3>
          <p>Your browser may not support WebGL or Three.js.</p>
          <button 
            onClick={() => window.location.reload()}
            className="retry-button"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="chess-3d-loading">
        <div className="loading-spinner" />
        <p>Loading 3D Chess Environment...</p>
      </div>
    );
  }

  return (
    <div className="chess-3d-container">
      <div className="chess-3d-header">
        <h1>Chess Board</h1>
        <div className="chess-3d-controls">
          <button 
            className="btn-new-game" 
            onClick={() => window.location.href = '/'}
          >
            New Game
          </button>
        </div>
      </div>
      
      <div className="chess-3d-canvas-wrapper">
        <Canvas
          ref={canvasRef}
          shadows
          camera={{ position: [8, 8, 8], fov: 50 }}
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
          }}
          onCreated={({ gl }) => {
            gl.shadowMap.enabled = true;
            gl.shadowMap.type = 2; // PCFSoftShadowMap
          }}
        >
          <PerspectiveCamera makeDefault position={[8, 8, 8]} fov={50} />
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={5}
            maxDistance={20}
            minPolarAngle={0.4}
            maxPolarAngle={1.2}
            enableDamping={true}
            dampingFactor={0.05}
          />
          
          {/* Lighting */}
          <ambientLight intensity={0.3} />
          <directionalLight
            position={[10, 10, 10]}
            intensity={1}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          <pointLight position={[-10, 10, -10]} intensity={0.2} />
          
          <Chess3DScene />
        </Canvas>
      </div>
      
      <div className="chess-3d-info">
        <div className="game-info">
          <div className="turn-indicator">
            {gameStore.isPlayerTurn ? '🤍 Your Turn' : '🖤 AI Thinking...'}
          </div>
          <div className="move-counter">
            Move: {gameStore.debugInfo.moveHistory.length}
          </div>
        </div>
      </div>
    </div>
  );
};