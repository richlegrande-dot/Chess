import * as THREE from 'three';
import { gsap } from 'gsap';

export interface MoveAnimation {
  piece: THREE.Object3D;
  from: THREE.Vector3;
  to: THREE.Vector3;
  duration: number;
  onComplete?: () => void;
}

export class ChessAnimationManager {
  private activeAnimations: Map<string, gsap.core.Timeline> = new Map();
  
  public animatePieceMove(animation: MoveAnimation): Promise<void> {
    return new Promise((resolve) => {
      const { piece, from, to, duration = 0.8 } = animation;
      
      // Create animation timeline
      const timeline = gsap.timeline({
        onComplete: () => {
          this.activeAnimations.delete(piece.uuid);
          animation.onComplete?.();
          resolve();
        }
      });
      
      // Store animation reference
      this.activeAnimations.set(piece.uuid, timeline);
      
      // Animate piece movement with arc
      const midPoint = new THREE.Vector3(
        (from.x + to.x) / 2,
        Math.max(from.y, to.y) + 0.5, // Arc height
        (from.z + to.z) / 2
      );
      
      timeline
        .to(piece.position, {
          duration: duration / 2,
          x: midPoint.x,
          y: midPoint.y,
          z: midPoint.z,
          ease: 'power2.out'
        })
        .to(piece.position, {
          duration: duration / 2,
          x: to.x,
          y: to.y,
          z: to.z,
          ease: 'power2.in'
        });
      
      // Add rotation during movement
      timeline.to(piece.rotation, {
        duration: duration,
        y: piece.rotation.y + Math.PI * 2,
        ease: 'none'
      }, 0);
    });
  }
  
  public animatePieceCapture(piece: THREE.Object3D, duration: number = 0.5): Promise<void> {
    return new Promise((resolve) => {
      const timeline = gsap.timeline({
        onComplete: () => {
          this.activeAnimations.delete(piece.uuid);
          // Remove piece from scene
          piece.parent?.remove(piece);
          resolve();
        }
      });
      
      this.activeAnimations.set(piece.uuid, timeline);
      
      // Capture animation: scale down and fall
      timeline
        .to(piece.scale, {
          duration: duration * 0.3,
          x: 1.2,
          y: 1.2,
          z: 1.2,
          ease: 'back.out(1.7)'
        })
        .to(piece.position, {
          duration: duration * 0.7,
          y: -2,
          ease: 'power2.in'
        }, duration * 0.3)
        .to(piece.rotation, {
          duration: duration * 0.7,
          x: Math.PI * 2,
          z: Math.PI,
          ease: 'power2.in'
        }, duration * 0.3)
        .to(piece.scale, {
          duration: duration * 0.7,
          x: 0,
          y: 0,
          z: 0,
          ease: 'power2.in'
        }, duration * 0.3);
    });
  }
  
  public animateSquareHighlight(square: THREE.Object3D, type: 'select' | 'legal' | 'check'): void {
    const colors = {
      select: 0x00ff00,
      legal: 0xffff00,
      check: 0xff0000
    };
    
    // Create highlight plane if it doesn't exist
    let highlight = square.userData.highlight;
    if (!highlight) {
      const geometry = new THREE.PlaneGeometry(0.9, 0.9);
      const material = new THREE.MeshBasicMaterial({
        color: colors[type],
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      
      highlight = new THREE.Mesh(geometry, material);
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.11; // Slightly above square
      square.add(highlight);
      square.userData.highlight = highlight;
    }
    
    // Animate highlight
    const material = highlight.material as THREE.MeshBasicMaterial;
    material.color.setHex(colors[type]);
    
    gsap.killTweensOf(material);
    gsap.fromTo(material, 
      { opacity: 0 }, 
      { 
        opacity: 0.6, 
        duration: 0.3,
        ease: 'power2.out',
        yoyo: type === 'check',
        repeat: type === 'check' ? -1 : 0
      }
    );
  }
  
  public removeSquareHighlight(square: THREE.Object3D): void {
    const highlight = square.userData.highlight;
    if (highlight) {
      gsap.to(highlight.material, {
        opacity: 0,
        duration: 0.2,
        onComplete: () => {
          square.remove(highlight);
          delete square.userData.highlight;
        }
      });
    }
  }
  
  public animateCameraTransition(camera: THREE.Camera, targetPosition: THREE.Vector3, _targetLookAt: THREE.Vector3, duration: number = 1): Promise<void> {
    return new Promise((resolve) => {
      gsap.to(camera.position, {
        duration,
        x: targetPosition.x,
        y: targetPosition.y,
        z: targetPosition.z,
        ease: 'power2.inOut'
      });
      
      // For look-at, we'd need to handle camera controls
      // This would integrate with OrbitControls target
      
      gsap.delayedCall(duration, resolve);
    });
  }
  
  public stopAnimation(objectId: string): void {
    const animation = this.activeAnimations.get(objectId);
    if (animation) {
      animation.kill();
      this.activeAnimations.delete(objectId);
    }
  }
  
  public stopAllAnimations(): void {
    this.activeAnimations.forEach(animation => animation.kill());
    this.activeAnimations.clear();
  }
  
  public isAnimating(objectId?: string): boolean {
    if (objectId) {
      return this.activeAnimations.has(objectId);
    }
    return this.activeAnimations.size > 0;
  }
}