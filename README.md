# Daytrace - Offline Speech-to-Text Q&A App

A cross-platform application for conducting voice-driven Q&A sessions with offline speech-to-text capabilities using Whisper.cpp.

## Features

- 🎤 **Offline Speech Recognition** - Uses Whisper.cpp for completely offline STT with Web Speech API fallback
- 🗣️ **Voice Commands** - Control navigation with "daytrace next", "daytrace previous", etc.
- 🔊 **Audio Cues** - Audible beep indicates when speech recognition is ready
- 🌐 **Cross-Platform** - Works on web browsers, iOS, and Android
- 📱 **Mobile Optimized** - Native mobile app support via Capacitor
- 🔒 **Privacy-First** - All speech processing happens locally
- 💾 **Data Export** - Export Q&A sessions as JSON
- 🎯 **Question Navigation** - Skip, jump, and navigate through question sets
- 🎛️ **Smart Text Processing** - Voice commands are extracted from responses automatically

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Whisper.cpp

Download the required Whisper.cpp files and model:

```bash
npm run setup-whisper
```

This downloads:
- `whisper.js` and `whisper.wasm` (Whisper.cpp WebAssembly)
- `ggml-base.en.bin` (English speech recognition model ~140MB)

### 3. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:9002`

## Building for Mobile

### iOS

```bash
# Add iOS platform
npm run add:ios

# Build and sync
npm run build:mobile

# Open in Xcode
npm run ios
```

### Android

```bash
# Add Android platform  
npm run add:android

# Build and sync
npm run build:mobile

# Open in Android Studio
npm run android
```

## Usage

1. **Import Questions**: Upload a JSON file with questions in this format:
   ```json
   [
     { "question": "What is your biggest accomplishment this year?" },
     { "question": "What challenges did you face?" }
   ]
   ```

2. **Start Q&A**: Click "Start Q&A" to begin the session

3. **Voice Interaction**: 
   - Questions are read aloud automatically
   - Configurable pause between question and recording (default 3 seconds)
   - Listen for the "beep" sound indicating speech recognition is ready
   - Speak your answer - it will be transcribed automatically
   - Use voice commands during recording: "daytrace next", "daytrace previous", "daytrace skip", "daytrace repeat", "daytrace clear answer", "daytrace set wait to X"
   - Voice commands also work with "day trace" or "they trace" variations

4. **Navigation**: Use voice commands or control buttons to move between questions, skip, or jump to specific questions

5. **Export**: Save your completed Q&A session as JSON

## Voice Commands

All voice commands work with three variations: "daytrace", "day trace", or "they trace" (in case speech recognition mishears).

| Command | Action | Example |
|---------|--------|---------|
| `daytrace next` | Move to next question | "That's my answer. Daytrace next." |
| `daytrace previous` | Go to previous question | "Wait, daytrace previous question." |
| `daytrace skip` | Skip current question | "I don't know. Daytrace skip." |
| `daytrace repeat` | Repeat current question | "Daytrace repeat." |
| `daytrace clear answer` | Clear current answer | "That was wrong. Daytrace clear answer." |
| `daytrace summary` | Show progress summary | "Daytrace summary." |
| `daytrace set wait to X` | Set pause duration | "Daytrace set wait to 10." |

Commands are automatically removed from your answer text, so you can say them naturally within your response.

## Pause Settings

Control the thinking time between question and recording:

- **Default**: 3 seconds pause after question reading
- **Range**: 0-60 seconds
- **UI Control**: Use the "Wait Time" input in the Controls section
- **Voice Control**: Say "daytrace set wait to X" (where X is seconds)
- **Persistence**: Setting is saved in browser localStorage

Example scenarios:
- Set to 0 for rapid-fire Q&A sessions
- Set to 10+ for complex questions requiring thought
- Adjust mid-session via voice commands without interrupting flow

## Technical Details

### Offline Speech Recognition

- **Web**: Uses Whisper.cpp compiled to WebAssembly
- **Mobile**: Uses the same WASM approach with mobile optimizations
- **Fallback**: Native speech recognition APIs when available
- **Model**: ggml-base.en.bin for English (other languages supported)

### Architecture

```
src/
├── lib/
│   ├── whisper.ts          # Main Whisper.cpp integration
│   └── whisper-mobile.ts   # Mobile-specific optimizations
├── components/
│   ├── AudioControls.tsx   # Speech controls
│   └── DaytraceClientPage.tsx # Main app logic
└── app/                    # Next.js app structure
```

### Cross-Platform Strategy

- **Web**: Next.js static export with Whisper.cpp WASM
- **Mobile**: Capacitor wraps the web app for native deployment
- **Offline**: All processing happens client-side, no internet required

## Development

### Scripts

- `npm run dev` - Development server
- `npm run build` - Build for web
- `npm run build:mobile` - Build and sync for mobile
- `npm run setup-whisper` - Download Whisper.cpp files
- `npm run typecheck` - TypeScript checking
- `npm run lint` - Code linting

### File Structure

- `public/` - Static assets including Whisper.cpp files
- `src/lib/whisper.ts` - Core speech recognition logic
- `src/components/` - React components
- `capacitor.config.ts` - Mobile app configuration

## Performance Notes

- First load may take a moment to initialize Whisper.cpp (~140MB model)
- Speech recognition quality depends on microphone and environment
- Mobile apps have same performance as web due to WASM

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on web and mobile platforms
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and support: [GitHub Issues](https://github.com/your-repo/issues)

---

Built with ❤️ for privacy-conscious voice applications