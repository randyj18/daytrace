// Simple Web Speech API implementation for immediate functionality
export class SimpleSpeechRecognition {
  private recognition: any = null;
  private isListening = false;
  private autoRestart = false;
  private accumulatedTranscript = '';
  private manualStop = false;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;  // Allow longer speech
      this.recognition.interimResults = true;  // Get partial results
      this.recognition.lang = 'en-US';
      this.recognition.maxAlternatives = 1;
      
      // Additional Chrome-specific settings
      if (this.recognition.serviceURI !== undefined) {
        console.log('[STT] Detected Chrome Web Speech API');
      }
      
      console.log('[STT] Speech recognition configured:', {
        continuous: this.recognition.continuous,
        interimResults: this.recognition.interimResults,
        lang: this.recognition.lang,
        maxAlternatives: this.recognition.maxAlternatives
      });
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
      console.warn('[STT] Already listening, stopping previous session');
      this.stopListening();
      // Wait for previous session to stop
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          this.startListening().then(resolve).catch(reject);
        }, 300);
      });
    }

    return new Promise((resolve, reject) => {
      this.isListening = true;
      this.manualStop = false;
      
      // Always start fresh for simplicity
      this.accumulatedTranscript = '';
      console.log('[STT] Starting fresh listening session');
      
      let finalTranscript = '';
      let silenceTimer: NodeJS.Timeout;
      let hasSpoken = false;
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

      this.recognition.onstart = () => {
        console.log('[STT] Speech recognition started successfully');
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        
        console.log('[STT] onresult fired, resultIndex:', event.resultIndex, 'results length:', event.results.length);
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          const isFinal = event.results[i].isFinal;
          console.log(`[STT] Result ${i}: "${transcript}" (final: ${isFinal})`);
          
          if (isFinal) {
            finalTranscript += transcript + ' ';
            hasSpoken = true;
            console.log('[STT] Final transcript updated:', finalTranscript);
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Reset silence timer when we get new speech
        if (interimTranscript.trim() || finalTranscript.trim()) {
          hasSpoken = true;
          console.log('[STT] Speech detected, resetting silence timer. hasSpoken:', hasSpoken);
          resetSilenceTimer();
        }
      };

      this.recognition.onerror = (event: any) => {
        console.log('Speech recognition error:', event.error);
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        
        // Handle common errors more gracefully
        if (event.error === 'no-speech' || event.error === 'aborted') {
          console.log('[STT] Recoverable error:', event.error);
          // Don't reject for common errors, let onend handle it
        } else {
          console.log('[STT] Serious error:', event.error);
          this.autoRestart = false; // Reset auto-restart flag on real errors
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      this.recognition.onend = () => {
        console.log('[STT] Speech recognition ended. Details:', {
          hasSpoken,
          stoppedBySilenceTimer,
          autoRestart: this.autoRestart,
          wasListening: this.isListening,
          accumulatedLength: this.accumulatedTranscript.length,
          finalLength: finalTranscript.trim().length
        });
        
        const wasListening = this.isListening;
        this.isListening = false;
        if (silenceTimer) clearTimeout(silenceTimer);
        
        // Simplified auto-restart logic
        const shouldAutoRestart = !this.manualStop && wasListening && !stoppedBySilenceTimer && hasSpoken;
        
        console.log('[STT] Auto-restart decision:', {
          shouldAutoRestart,
          reason: shouldAutoRestart ? 'Chrome timeout detected' : 
                  this.manualStop ? 'Manually stopped' :
                  !wasListening ? 'Not listening' :
                  stoppedBySilenceTimer ? 'Silence timer' :
                  !hasSpoken ? 'No speech detected' : 'Unknown'
        });
        
        if (shouldAutoRestart) {
          console.log('🔄 [STT AUTO-RESTART] Restarting due to Chrome timeout');
          this.autoRestart = true;
          
          setTimeout(() => {
            if (!this.manualStop) {
              this.startListening().then(resolve).catch(reject);
            } else {
              resolve(finalTranscript.trim());
            }
          }, 100);
        } else {
          this.autoRestart = false;
          console.log('[STT] Normal end, returning transcript:', finalTranscript.trim());
          resolve(finalTranscript.trim());
        }
      };

      try {
        console.log('[STT] Starting speech recognition...');
        this.recognition.start();
        
        // Initial timeout of 2 minutes if no speech at all to give thinking time
        const initialTimeout = setTimeout(() => {
          if (this.isListening && !hasSpoken) {
            console.log('[STT] Initial thinking time expired (2 minutes), stopping recognition');
            stoppedBySilenceTimer = true;
            this.recognition.stop();
          }
        }, 120000);
        
        // Store timeout reference to clear if needed
        this.recognition._initialTimeout = initialTimeout;
        
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
      console.log('[STT] Manual stop requested');
      this.manualStop = true; // Flag to prevent auto-restart
      this.autoRestart = false;
      this.accumulatedTranscript = '';
      
      // Clear any pending timeout
      if (this.recognition._initialTimeout) {
        clearTimeout(this.recognition._initialTimeout);
      }
      
      this.recognition.stop();
      this.isListening = false;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }
}