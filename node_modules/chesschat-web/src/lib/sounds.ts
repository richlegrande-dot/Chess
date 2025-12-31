// Sound System for ChessChat
// Lightweight audio manager with preloading and toggle support

class SoundManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;
  private preloaded: boolean = false;

  constructor() {
    // Load preference from localStorage
    const savedPref = localStorage.getItem('sounds-enabled');
    this.enabled = savedPref !== 'false';
  }

  /**
   * Preload all sound assets for instant playback
   * Deferred until first user interaction for better initial load performance
   */
  async preloadSounds() {
    if (this.preloaded) return;

    const soundFiles = {
      move: '/sounds/move.mp3',
      capture: '/sounds/capture.mp3',
      check: '/sounds/check.mp3',
      gameEnd: '/sounds/game-end.mp3',
    };

    const loadPromises = Object.entries(soundFiles).map(([key, path]) => {
      return new Promise<void>((resolve) => {
        const audio = new Audio(path);
        audio.preload = 'metadata'; // Changed to 'metadata' for faster initial load
        audio.volume = 0.4;
        
        // Handle both success and error to avoid blocking
        audio.addEventListener('canplaythrough', () => resolve(), { once: true });
        audio.addEventListener('error', () => {
          console.warn(`Failed to load sound: ${path}`);
          resolve();
        }, { once: true });

        this.sounds.set(key, audio);
      });
    });

    await Promise.all(loadPromises);
    this.preloaded = true;
  }

  /**
   * Play a sound effect
   */
  play(soundName: 'move' | 'capture' | 'check' | 'gameEnd') {
    if (!this.enabled) return;

    const sound = this.sounds.get(soundName);
    if (!sound) {
      console.warn(`Sound not found: ${soundName}`);
      return;
    }

    // Clone and play to allow overlapping sounds
    const clone = sound.cloneNode() as HTMLAudioElement;
    clone.volume = sound.volume;
    clone.play().catch(err => {
      console.warn(`Failed to play sound ${soundName}:`, err);
    });
  }

  /**
   * Toggle sound on/off
   */
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('sounds-enabled', String(this.enabled));
  }

  /**
   * Set sound enabled state
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    localStorage.setItem('sounds-enabled', String(enabled));
  }

  /**
   * Get current enabled state
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set volume for all sounds (0.0 to 1.0)
   */
  setVolume(volume: number) {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.sounds.forEach(sound => {
      sound.volume = clampedVolume;
    });
  }
}

// Singleton instance
export const soundManager = new SoundManager();

// Preload sounds on first user interaction
let preloadInitiated = false;
export function initSounds() {
  if (preloadInitiated) return;
  preloadInitiated = true;
  soundManager.preloadSounds().catch(err => {
    console.warn('Failed to preload sounds:', err);
  });
}
