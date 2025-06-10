# Daytrace

**A privacy-first voice Q&A app for personal reflection and interviews**

Daytrace helps you conduct voice-driven question and answer sessions with automatic speech-to-text transcription. Perfect for journaling, interviews, research, coaching sessions, or any scenario where you need to capture spoken responses to structured questions.

🌐 **Try it live**: [daytrace-an8xqropt-randyj18s-projects.vercel.app](https://daytrace-an8xqropt-randyj18s-projects.vercel.app)

## ✨ Key Features

- 🎤 **Instant Voice Recognition** - Speech starts recording immediately after questions are read
- 🗣️ **Smart Voice Commands** - Control navigation with simple commands like "next", "skip", "repeat"
- 🔔 **Audio Cues** - Pleasant ding sound indicates when speech recognition is ready
- 🔒 **100% Private** - All data stays on your device, no external servers
- 💾 **Import/Export** - Upload question sets and export your responses as JSON
- 🎯 **Flexible Navigation** - Skip questions, jump around, or review previous answers
- 📱 **Mobile Friendly** - Works on all devices with microphone access
- 🌍 **Browser Based** - No downloads required, works in any modern browser

## 🚀 How to Use

### For Users (No Setup Required)

1. **Visit the app**: [daytrace-an8xqropt-randyj18s-projects.vercel.app](https://daytrace-an8xqropt-randyj18s-projects.vercel.app)
2. **Allow microphone access** when prompted by your browser
3. **Import questions** - Upload a JSON file or use the sample questions
4. **Start your Q&A session** and begin speaking!

### For Developers

```bash
# Install dependencies
npm install

# Run development server
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

## 📝 Question Format

Create questions in simple JSON format:

```json
[
  { 
    "question": "What is your biggest accomplishment this year?",
    "category": "reflection",
    "context": "Think about both professional and personal achievements"
  },
  { 
    "question": "What challenges did you face?",
    "category": "growth"
  }
]
```

The `question` field is required. Additional fields like `category`, `context`, `notes`, etc. are preserved and included in exports.

## 🎙️ How It Works

1. **Import** your questions via JSON upload
2. **Click "Start Q&A"** to begin the session
3. **Listen** as each question is read aloud
4. **Wait for the ding** - this means speech recognition is ready
5. **Speak your answer** - transcription happens automatically
6. **Use voice commands** to navigate: simply say "next", "skip", "repeat", etc.
7. **Export** your completed session as JSON with all responses

## 🗣️ Voice Commands

Voice commands work best when spoken alone. Simply say the command word(s) during recording:

| Command | Action | Example |
|---------|--------|---------|
| `next` or `next question` | Move to next question | "That's my answer. Next." |
| `previous` or `previous question` | Go to previous question | "Wait, previous question." |
| `skip` or `skip question` | Skip current question | "I don't know. Skip." |
| `jump to #` or `jump to question #` | Jump to specific question | "Jump to 5" or "Jump to question 12" |
| `repeat` or `repeat question` | Repeat current question | "Repeat." |
| `clear answer` | Clear current answer | "That was wrong. Clear answer." |
| `summary` | Show progress summary | "Summary." |
| `pause` | Pause the session | "Pause." |
| `resume` | Resume from pause | "Resume." |

**Advanced**: Legacy prefixed commands like "daytrace next" still work for compatibility, and commands are automatically removed from your answer text.

## 🔧 Privacy & Data

- **Local Storage Only**: All your Q&A data stays on your device
- **No Tracking**: Zero analytics, cookies, or data collection
- **No Sign-up**: Use immediately without accounts or registration
- **Offline Capable**: Core features work without internet connection
- **Open Source**: Full source code available for transparency

## 🏗️ Use Cases

- **Personal Journaling**: Daily reflection questions and thought recording
- **Research Interviews**: Conduct and transcribe qualitative interviews
- **Coaching Sessions**: Structured self-coaching or client sessions  
- **Team Retrospectives**: Capture spoken feedback in meetings
- **Content Creation**: Interview preparation and content research
- **Language Practice**: Speaking practice with self-assessment
- **Accessibility**: Voice-first interface for those who prefer speaking over typing

## 🛠️ For Developers

Built with modern web technologies:

- **Next.js 15** - React framework with static export
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Web Speech API** - Browser-native speech recognition
- **Web Audio API** - Custom audio cues and processing
- **LocalStorage** - Client-side data persistence

### Development Scripts

```bash
npm run dev          # Development server (localhost:9002)
npm run build        # Build for production
npm run typecheck    # TypeScript checking
npm run lint         # Code linting
```

### Mobile Development (Optional)

```bash
npm run build:mobile # Build and sync for mobile
npm run add:ios      # Add iOS platform
npm run add:android  # Add Android platform
npm run ios         # Open in Xcode
npm run android     # Open in Android Studio
```

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Test your changes thoroughly
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🐛 Issues & Support

Found a bug or have a feature request? 
[Open an issue on GitHub](https://github.com/randyj18/daytrace/issues)

---

**Built with ❤️ for privacy-conscious voice applications**