import React, { useMemo } from 'react';
import { createWoodMaterial, createFrameMaterial } from './materials';

interface Chess3DBoardProps {
  onSquareClick?: (file: number, rank: number) => void;
}

export const Chess3DBoard: React.FC<Chess3DBoardProps> = ({ onSquareClick }) => {
  const squareSize = 1;
  const boardSize = 8;
  const frameThickness = 0.3;
  const frameHeight = 0.2;
  
  const lightMaterial = useMemo(() => createWoodMaterial(true), []);
  const darkMaterial = useMemo(() => createWoodMaterial(false), []);
  const frameMaterial = useMemo(() => createFrameMaterial(), []);

  const squares = useMemo(() => {
    const squareArray = [];
    
    for (let rank = 0; rank < boardSize; rank++) {
      for (let file = 0; file < boardSize; file++) {
        const isLight = (rank + file) % 2 === 0;
        const x = (file - boardSize / 2 + 0.5) * squareSize;
        const z = (rank - boardSize / 2 + 0.5) * squareSize;
        
        squareArray.push({
          position: [x, 0, z] as [number, number, number],
          material: isLight ? lightMaterial : darkMaterial,
          key: `square-${file}-${rank}`,
          file,
          rank,
        });
      }
    }
    
    return squareArray;
  }, [lightMaterial, darkMaterial, squareSize, boardSize]);

  const handleSquareClick = (file: number, rank: number) => {
    if (onSquareClick) {
      onSquareClick(file, rank);
    }
  };

  return (
    <group>
      {/* Board squares */}
      {squares.map(({ position, material, key, file, rank }) => (
        <mesh
          key={key}
          position={position}
          receiveShadow
          castShadow
          onClick={() => handleSquareClick(file, rank)}
        >
          <boxGeometry args={[squareSize, 0.1, squareSize]} />
          <primitive object={material} />
        </mesh>
      ))}
      
      {/* Board frame - North */}
      <mesh 
        position={[0, 0, (boardSize / 2 + frameThickness / 2) * squareSize]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[boardSize * squareSize + frameThickness * 2, frameHeight, frameThickness]} />
        <primitive object={frameMaterial} />
      </mesh>
      
      {/* Board frame - South */}
      <mesh 
        position={[0, 0, -(boardSize / 2 + frameThickness / 2) * squareSize]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[boardSize * squareSize + frameThickness * 2, frameHeight, frameThickness]} />
        <primitive object={frameMaterial} />
      </mesh>
      
      {/* Board frame - East */}
      <mesh 
        position={[(boardSize / 2 + frameThickness / 2) * squareSize, 0, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[frameThickness, frameHeight, boardSize * squareSize]} />
        <primitive object={frameMaterial} />
      </mesh>
      
      {/* Board frame - West */}
      <mesh 
        position={[-(boardSize / 2 + frameThickness / 2) * squareSize, 0, 0]}
        receiveShadow
        castShadow
      >
        <boxGeometry args={[frameThickness, frameHeight, boardSize * squareSize]} />
        <primitive object={frameMaterial} />
      </mesh>
      
      {/* Board labels (optional coordinate markers) */}
      {/* Files: a-h */}
      {Array.from({ length: 8 }, (_, i) => {
        const file = String.fromCharCode(97 + i); // 'a' + i
        return (
          <group key={`file-${file}`}>
            {/* You could add 3D text here for coordinates if needed */}
          </group>
        );
      })}
    </group>
  );
};