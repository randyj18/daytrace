// Simple Web Speech API implementation for immediate functionality
export class SimpleSpeechRecognition {
  private recognition: any = null;
  private isListening = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;  // Allow longer speech
      this.recognition.interimResults = true;  // Get partial results
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;
    }
  }

  isAvailable(): boolean {
    return this.recognition !== null;
  }

  startListening(): Promise<string> {
    if (!this.recognition) {
      return Promise.reject(new Error('Speech recognition not available'));
    }

    if (this.isListening) {
      console.warn('Already listening - stopping previous session and retrying');
      this.stopListening();
      // Wait longer for the previous session to stop
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          if (!this.isListening) {
            this.startListening().then(resolve).catch(reject);
          } else {
            // Force reset if still listening
            this.isListening = false;
            setTimeout(() => {
              this.startListening().then(resolve).catch(reject);
            }, 100);
          }
        }, 200);
      });
    }

    return new Promise((resolve, reject) => {
      this.isListening = true;
      let finalTranscript = '';
      let silenceTimer: NodeJS.Timeout;
      let hasSpoken = false;

      // Auto-stop after 3 seconds of silence once user has spoken
      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        if (hasSpoken) {
          silenceTimer = setTimeout(() => {
            if (this.isListening) {
              this.recognition.stop();
            }
          }, 3000); // 3 seconds of silence
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            hasSpoken = true;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Reset silence timer when we get new speech
        if (interimTranscript.trim() || finalTranscript.trim()) {
          hasSpoken = true;
          resetSilenceTimer();
        }
      };

      this.recognition.onerror = (event: any) => {
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        // Handle common errors more gracefully
        if (event.error === 'no-speech' || event.error === 'aborted') {
          resolve(finalTranscript.trim()); // Return whatever we have
        } else {
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        resolve(finalTranscript.trim());
      };

      try {
        this.recognition.start();
        // Initial timeout of 30 seconds if no speech at all
        setTimeout(() => {
          if (this.isListening && !hasSpoken) {
            this.recognition.stop();
          }
        }, 30000);
      } catch (error) {
        this.isListening = false;
        console.error('Error starting speech recognition:', error);
        // If it's an "already started" error, try to recover
        if (error instanceof Error && error.message.includes('already started')) {
          setTimeout(() => {
            this.isListening = false;
            this.startListening().then(resolve).catch(reject);
          }, 500);
        } else {
          reject(error);
        }
      }
    });
  }

  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}