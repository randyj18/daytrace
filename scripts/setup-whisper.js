#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

function createPlaceholderFile(filepath, content) {
  fs.writeFileSync(filepath, content);
  console.log(`✅ Created placeholder: ${path.basename(filepath)}`);
}

async function setupWhisper() {
  console.log('🎤 Setting up Whisper.cpp for offline STT...\n');
  
  const whisperJsPath = path.join(publicDir, 'whisper.js');
  const whisperWasmPath = path.join(publicDir, 'whisper.wasm');
  const modelPath = path.join(publicDir, 'ggml-base.en.bin');

  // Create placeholder files
  createPlaceholderFile(whisperJsPath, `// Whisper.js placeholder
// Download the real file from: https://github.com/ggerganov/whisper.cpp/releases/
console.warn('Whisper.js placeholder - download real file for STT functionality');
`);

  createPlaceholderFile(whisperWasmPath, '// Whisper WASM placeholder - binary file needed');
  createPlaceholderFile(modelPath, '// Whisper model placeholder - binary file needed');

  console.log('\n📋 MANUAL SETUP REQUIRED:\n');
  console.log('To enable offline speech-to-text, you need to download these files:\n');
  
  console.log('1. Whisper.cpp WebAssembly files:');
  console.log('   - Visit: https://github.com/ggerganov/whisper.cpp/releases/');
  console.log('   - Download whisper.js and whisper.wasm');
  console.log('   - Place in public/ directory\n');
  
  console.log('2. Whisper model file:');
  console.log('   - Visit: https://huggingface.co/ggerganov/whisper.cpp/tree/main');
  console.log('   - Download ggml-base.en.bin (~140MB)');
  console.log('   - Place in public/ directory\n');
  
  console.log('Alternative - Use CDN (for development):');
  console.log('   - Update whisper.ts to load from jsdelivr or unpkg');
  console.log('   - Not recommended for production due to network dependency\n');
  
  console.log('Files needed in public/:');
  console.log(`   - whisper.js`);
  console.log(`   - whisper.wasm`);
  console.log(`   - ggml-base.en.bin`);
  
  console.log('\n🎯 Once files are in place, your app will have offline STT!');
  console.log('\n💡 Tip: Start with ggml-tiny.en.bin (~39MB) for faster loading');
}

setupWhisper().catch(console.error);