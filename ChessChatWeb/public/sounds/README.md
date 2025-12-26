# Sound Assets Required

ChessChat requires 4 small audio files in MP3 format. Each should be under 50KB.

## Required Files

### 1. move.mp3
- **Duration**: ~0.3s
- **Description**: Soft wood-click or digital tap sound
- **Volume**: Medium (normalized to -14 LUFS)
- **Suggested tone**: C4-E4, short decay
- **Example**: Piano key tap, wood block click

### 2. capture.mp3
- **Duration**: ~0.4s
- **Description**: Slightly heavier click with more bass
- **Volume**: Medium-high (normalized to -12 LUFS)
- **Suggested tone**: A3-C4, medium decay
- **Example**: Muted drum hit, deep wood knock

### 3. check.mp3
- **Duration**: ~0.5s
- **Description**: Gentle alert, non-alarming notification
- **Volume**: Medium (normalized to -14 LUFS)
- **Suggested tone**: G5-B5, soft chime
- **Example**: Bell ping, xylophone note

### 4. game-end.mp3
- **Duration**: ~1.0s
- **Description**: Soft completion chime, positive feeling
- **Volume**: Medium (normalized to -14 LUFS)
- **Suggested tone**: Chord progression (C-E-G)
- **Example**: Wind chimes, music box ending

## Generation Options

### Option 1: Use Online Tools
- **Freesound.org**: Search for chess, click, tap, chime sounds
- **ZapSplat**: Free sound effects library
- **Sonniss**: Game audio packs

### Option 2: Synthesize with Tools
- **Audacity**: Generate tones, apply envelopes
- **ToneJS**: Web-based synthesizer
- **GarageBand**: Mac built-in DAW

### Option 3: Code Generation (Web Audio API)
```javascript
// Example: Generate move.mp3 programmatically
const audioContext = new AudioContext();
const oscillator = audioContext.createOscillator();
const gainNode = audioContext.createGain();

oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);

oscillator.frequency.value = 440; // A4
oscillator.type = 'sine';

gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

oscillator.start();
oscillator.stop(audioContext.currentTime + 0.3);
```

## Compression Settings

All files should be:
- **Format**: MP3
- **Sample Rate**: 44.1kHz
- **Bitrate**: 128kbps (or lower for smaller size)
- **Channels**: Mono
- **Target Size**: <50KB each

## Fallback

If sounds cannot be loaded, the app will continue to function normally without audio. The sound manager handles missing files gracefully.

## Testing

After adding files, test with:
```javascript
import { soundManager } from './lib/sounds';

// Preload sounds
await soundManager.preloadSounds();

// Test each sound
soundManager.play('move');
soundManager.play('capture');
soundManager.play('check');
soundManager.play('gameEnd');
```

---

**Note**: For production deployment, ensure sounds are committed to the repository and accessible via the `/sounds/` public path.
