import * as THREE from 'three';

// Wood materials for the chessboard
export const createWoodMaterial = (isLight: boolean = true): THREE.MeshPhysicalMaterial => {
  const baseColor = isLight ? new THREE.Color(0xF5DEB3) : new THREE.Color(0x8B4513);
  
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: 0.8,
    metalness: 0.1,
    clearcoat: 0.1,
    clearcoatRoughness: 0.2,
  });
};

// Piece materials
export const createPieceMaterial = (isWhite: boolean = true): THREE.MeshPhysicalMaterial => {
  const baseColor = isWhite ? new THREE.Color(0xF8F8FF) : new THREE.Color(0x2F2F2F);
  
  return new THREE.MeshPhysicalMaterial({
    color: baseColor,
    roughness: isWhite ? 0.3 : 0.6,
    metalness: isWhite ? 0.1 : 0.2,
    clearcoat: 0.3,
    clearcoatRoughness: 0.1,
  });
};

// Board frame material
export const createFrameMaterial = (): THREE.MeshPhysicalMaterial => {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x654321),
    roughness: 0.7,
    metalness: 0.1,
    clearcoat: 0.2,
  });
};

// Highlight materials
export const createHighlightMaterial = (type: 'selected' | 'legal' | 'check' = 'selected'): THREE.MeshBasicMaterial => {
  const colors = {
    selected: 0x00FF00,
    legal: 0xFFFF00,
    check: 0xFF0000
  };
  
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(colors[type]),
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
};