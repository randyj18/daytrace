// Simple Web Speech API implementation for immediate functionality
export class SimpleSpeechRecognition {
  private recognition: any = null;
  private isListening = false;
  private autoRestart = false;
  private accumulatedTranscript = '';

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
      
      // Reset accumulated transcript only if this is not an auto-restart
      if (!this.autoRestart) {
        this.accumulatedTranscript = '';
        console.log('[STT] Starting fresh listening session');
      } else {
        console.log('[STT AUTO-RESTART] Continuing session with accumulated transcript:', this.accumulatedTranscript);
      }
      
      let finalTranscript = this.accumulatedTranscript;
      let silenceTimer: NodeJS.Timeout;
      let hasSpoken = this.accumulatedTranscript.length > 0; // If we have accumulated text, user has spoken
      let stoppedBySilenceTimer = false;

      // Auto-stop after 3 seconds of silence once user has spoken
      const resetSilenceTimer = () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        if (hasSpoken) {
          silenceTimer = setTimeout(() => {
            if (this.isListening) {
              stoppedBySilenceTimer = true;
              this.recognition.stop();
            }
          }, 3000); // 3 seconds of silence after speaking
        }
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
            this.accumulatedTranscript = finalTranscript; // Keep track for auto-restart
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
        console.log('Speech recognition error:', event.error);
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        
        // Handle common errors more gracefully
        if (event.error === 'no-speech' || event.error === 'aborted') {
          // For auto-restart scenarios, don't resolve yet - let onend handle it
          if (!this.autoRestart) {
            resolve(finalTranscript.trim()); // Return whatever we have
          }
        } else {
          this.autoRestart = false; // Reset auto-restart flag on real errors
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        console.log('Speech recognition ended. hasSpoken:', hasSpoken, 'stoppedBySilenceTimer:', stoppedBySilenceTimer, 'autoRestart:', this.autoRestart);
        const wasListening = this.isListening;
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        
        // Auto-restart if:
        // 1. User has spoken (so we're not in initial thinking time)
        // 2. This is not already an auto-restart (prevent infinite loops)  
        // 3. We were actively listening (not manually stopped)
        // 4. Recognition didn't end due to our silence timer (likely Chrome timeout)
        const shouldAutoRestart = hasSpoken && !this.autoRestart && wasListening && !stoppedBySilenceTimer;
        
        if (shouldAutoRestart) {
          console.log('🔄 [STT AUTO-RESTART] Chrome timeout detected, auto-restarting speech recognition to maintain continuous listening');
          console.log('[STT AUTO-RESTART] Accumulated transcript so far:', this.accumulatedTranscript);
          this.autoRestart = true;
          
          // Auto-restart quickly to avoid missing speech
          setTimeout(() => {
            if (this.autoRestart) { // Make sure we haven't been manually stopped
              console.log('[STT AUTO-RESTART] Executing restart...');
              this.startListening().then(resolve).catch(reject);
            } else {
              console.log('[STT AUTO-RESTART] Restart cancelled, was manually stopped');
              resolve(finalTranscript.trim());
            }
          }, 50); // Very quick restart
        } else {
          this.autoRestart = false; // Reset for next time
          console.log('[STT] Normal end, returning transcript:', finalTranscript.trim());
          resolve(finalTranscript.trim());
        }
      };

      try {
        this.recognition.start();
        // Initial timeout of 2 minutes if no speech at all to give thinking time
        setTimeout(() => {
          if (this.isListening && !hasSpoken) {
            stoppedBySilenceTimer = true;
            this.recognition.stop();
          }
        }, 120000);
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
      this.autoRestart = false; // Prevent auto-restart when manually stopped
      this.accumulatedTranscript = ''; // Reset accumulated transcript
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}