/**
 * Download and install Stockfish binary for Linux (Render.com)
 * This script runs during npm install/build phase
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const STOCKFISH_URL = 'https://github.com/official-stockfish/Stockfish/releases/download/sf_16.1/stockfish-ubuntu-x86-64-avx2.tar';
const DOWNLOAD_PATH = path.join(__dirname, 'stockfish.tar');
const BINARY_PATH = path.join(__dirname, 'stockfish');

console.log('📥 Downloading Stockfish binary...');

const file = fs.createWriteStream(DOWNLOAD_PATH);

https.get(STOCKFISH_URL, (response) => {
  if (response.statusCode === 302 || response.statusCode === 301) {
    // Follow redirect
    https.get(response.headers.location, (redirectResponse) => {
      redirectResponse.pipe(file);
      file.on('finish', () => {
        file.close();
        extractAndInstall();
      });
    });
  } else {
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      extractAndInstall();
    });
  }
}).on('error', (err) => {
  fs.unlink(DOWNLOAD_PATH, () => {});
  console.error('❌ Download failed:', err.message);
  process.exit(1);
});

function extractAndInstall() {
  try {
    console.log('📦 Extracting Stockfish...');
    
    // Create temp extraction directory
    const tempDir = path.join(__dirname, 'temp-stockfish-extract');
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Extract tar file to temp directory
    execSync(`tar -xf ${DOWNLOAD_PATH} -C ${tempDir}`, { stdio: 'inherit' });
    
    // Recursively find the stockfish binary
    function findBinary(dir) {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          const result = findBinary(fullPath);
          if (result) return result;
        } else if (item === 'stockfish' || item.includes('stockfish-ubuntu') || item.includes('stockfish_')) {
          return fullPath;
        }
      }
      return null;
    }
    
    const binaryPath = findBinary(tempDir);
    if (!binaryPath) {
      throw new Error('Could not find stockfish binary in extracted files');
    }
    
    // Copy binary to final location
    if (fs.existsSync(BINARY_PATH)) {
      fs.unlinkSync(BINARY_PATH);
    }
    fs.copyFileSync(binaryPath, BINARY_PATH);
    
    // Make executable
    fs.chmodSync(BINARY_PATH, 0o755);
    
    // Clean up
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.unlinkSync(DOWNLOAD_PATH);
    
    console.log('✅ Stockfish installed successfully');
    console.log(`   Binary: ${BINARY_PATH}`);
  } catch (err) {
    console.error('❌ Installation failed:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}
