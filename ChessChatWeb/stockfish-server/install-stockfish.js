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
    
    // Extract tar file
    execSync(`tar -xf ${DOWNLOAD_PATH}`, { cwd: __dirname });
    
    // Find the extracted binary (it's usually in a subfolder)
    const extractedDir = fs.readdirSync(__dirname).find(f => 
      f.startsWith('stockfish') && fs.statSync(path.join(__dirname, f)).isDirectory()
    );
    
    if (extractedDir) {
      const binaryInDir = path.join(__dirname, extractedDir, 'stockfish-ubuntu-x86-64-avx2');
      if (fs.existsSync(binaryInDir)) {
        fs.renameSync(binaryInDir, BINARY_PATH);
        fs.rmSync(path.join(__dirname, extractedDir), { recursive: true });
      }
    }
    
    // Make executable
    fs.chmodSync(BINARY_PATH, 0o755);
    
    // Clean up
    fs.unlinkSync(DOWNLOAD_PATH);
    
    console.log('✅ Stockfish installed successfully');
    console.log(`   Binary: ${BINARY_PATH}`);
  } catch (err) {
    console.error('❌ Installation failed:', err.message);
    process.exit(1);
  }
}
