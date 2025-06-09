"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, QuestionInteractionState, AllQuestionStates } from '@/types';
import { AppHeader } from '@/components/Header';
import { FileControls } from '@/components/FileControls';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { AnswerArea } from '@/components/AnswerArea';
import { NavigationControls } from '@/components/NavigationControls';
import { AudioControls } from '@/components/AudioControls';
import { VoiceCommandPalette } from '@/components/VoiceCommandPalette';
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { SessionManager } from '@/components/SessionManager';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { SimpleSpeechRecognition } from '@/lib/simple-speech';
import { SessionStorage, type SavedSession } from '@/lib/storage';

const speechSynthesis = globalThis.speechSynthesis;

interface ImportedQuestionFormat {
  id?: string;
  question: string;
  [key: string]: any;
}

interface ExportedSessionFormat {
  exportedAt: string;
  sessionInfo: {
    id: string;
    timestamp: number;
    title?: string;
    date: string;
  };
  questions: {
    id: string;
    question: string;
    answer: string;
    status: string;
  }[];
  summary: {
    totalQuestions: number;
    answered: number;
    skipped: number;
    pending: number;
  };
}

export default function DaytraceClientPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<AllQuestionStates>({});
  
  const [isTranscribing, setIsTranscribing] = useState(false);
  const speechRecognitionRef = useRef<SimpleSpeechRecognition | null>(null);
  const [isSpeechReady, setIsSpeechReady] = useState(false);

  const [isQnAActive, setIsQnAActive] = useState(false);
  const [justStartedQnA, setJustStartedQnA] = useState(false);
  const readingQuestionRef = useRef(false);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);
  const [pauseDuration, setPauseDuration] = useState<number>(3); // STT now starts immediately after TTS, but keeping for voice commands
  const [isSessionContinuation, setIsSessionContinuation] = useState<{active: boolean, sessionInfo?: any}>({active: false});
  const [isPaused, setIsPaused] = useState(false);
  const [pausedContent, setPausedContent] = useState<{type: 'tts' | 'stt', content: string, questionId: string} | null>(null);
  
  // State tracking for debugging - should always be one of: 'tts', 'stt', 'paused', 'inactive'
  const getCurrentState = useCallback(() => {
    if (!isQnAActive) return 'inactive';
    if (isPaused) return 'paused';
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis && speechSynthesis.speaking) return 'tts';
    if (isTranscribing) return 'stt';
    return 'none'; // This should NEVER happen during active Q&A
  }, [isQnAActive, isPaused, isTranscribing]);

  const { toast } = useToast();

  const currentQuestion = questions[currentQuestionIndex];

  // Utility function to check if a question is unanswered
  const isQuestionUnanswered = useCallback((questionId: string) => {
    const state = questionStates[questionId];
    // Question is unanswered if:
    // 1. No state exists at all, OR
    // 2. Status is 'pending', OR  
    // 3. Answer is empty/whitespace only
    return !state || 
           state.status === 'pending' || 
           !state.answer || 
           state.answer.trim() === '';
  }, [questionStates]);

  // Find first unanswered question index
  const findFirstUnansweredIndex = useCallback(() => {
    const result = questions.findIndex(q => {
      const isUnanswered = isQuestionUnanswered(q.id);
      console.log(`[FIND UNANSWERED] Question ${q.id}: isUnanswered=${isUnanswered}`, {
        state: questionStates[q.id],
        answer: questionStates[q.id]?.answer,
        status: questionStates[q.id]?.status
      });
      return isUnanswered;
    });
    console.log(`[FIND UNANSWERED] First unanswered question index: ${result}`);
    return result;
  }, [questions, isQuestionUnanswered, questionStates]);

  // State monitoring - log and alert if we're ever in an invalid state
  useEffect(() => {
    // Only run on client side to avoid SSR issues
    if (typeof window === 'undefined') return;
    
    const checkState = () => {
      try {
        const state = getCurrentState();
        console.log(`[STATE CHECK] Current state: ${state}, Q&A Active: ${isQnAActive}, Question: ${currentQuestionIndex + 1}`);
        
        if (isQnAActive && state === 'none') {
          console.error('🚨 INVALID STATE: Q&A is active but we are not in TTS, STT, or paused state!');
          console.error('State details:', {
            isQnAActive,
            isPaused,
            isTranscribing,
            speechSynthesisSpeaking: typeof speechSynthesis !== 'undefined' ? speechSynthesis?.speaking : 'unavailable',
            currentQuestion: currentQuestion?.text
          });
          toast({ 
            title: "State Error", 
            description: "Invalid audio state detected. Check console for details.", 
            variant: "destructive" 
          });
        }
      } catch (error) {
        console.error('Error in state check:', error);
      }
    };

    // Check state every 2 seconds during active Q&A
    if (isQnAActive) {
      const interval = setInterval(checkState, 2000);
      return () => clearInterval(interval);
    }
  }, [isQnAActive, getCurrentState, currentQuestionIndex, currentQuestion, toast, isPaused, isTranscribing]);
  const currentQuestionState = currentQuestion ? questionStates[currentQuestion.id] : undefined;

  // Function to play a ding sound using Web Audio API
  const playDingSound = useCallback((onComplete?: () => void) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Create a pleasant ding sound (bell-like frequencies)
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
      
      // Volume envelope for a bell-like sound
      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
      
      if (onComplete) {
        setTimeout(onComplete, 350); // Wait for sound to finish
      }
    } catch (error) {
      console.warn('Could not play ding sound:', error);
      // Fallback: just call the completion callback
      if (onComplete) {
        setTimeout(onComplete, 100);
      }
    }
  }, []);

  const initQuestionStates = useCallback((qs: Question[]) => {
    const initialStates: AllQuestionStates = {};
    qs.forEach(q => {
      initialStates[q.id] = { answer: '', status: 'pending' };
    });
    setQuestionStates(initialStates);
  }, []);
  
  const updateCurrentQuestionState = useCallback((updates: Partial<QuestionInteractionState>) => {
    if (currentQuestion) {
      setQuestionStates(prev => {
        const newStates = {
          ...prev,
          [currentQuestion.id]: {
            ...(prev[currentQuestion.id] || { answer: '', status: 'pending' }),
            ...updates,
          },
        };
        
        // Auto-save to localStorage whenever state changes
        if (questions.length > 0) {
          const sessionId = SessionStorage.saveCurrentSession(
            questions,
            newStates,
            currentQuestionIndex,
            isQnAActive,
            currentSessionId || undefined
          );
          if (sessionId && sessionId !== currentSessionId) {
            setCurrentSessionId(sessionId);
          }
        }
        
        return newStates;
      });
    }
  }, [currentQuestion, questions, currentQuestionIndex, isQnAActive, currentSessionId]);

  useEffect(() => {
    const initSpeech = () => {
      speechRecognitionRef.current = new SimpleSpeechRecognition();
      
      if (speechRecognitionRef.current.isAvailable()) {
        setIsSpeechReady(true);
        toast({ title: "STT Ready", description: "Speech recognition available and ready to use."});
      } else {
        setIsSpeechReady(false);
        toast({ title: "STT Not Available", description: "Speech recognition not supported in this browser. Please use Chrome/Edge.", variant: "destructive"});
      }
    };
    
    const loadSavedSession = () => {
      const savedSession = SessionStorage.getCurrentSession();
      const allSessions = SessionStorage.getAllSessions();
      setSavedSessions(allSessions);
      
      // Load pause duration from localStorage
      // const savedPauseDuration = localStorage.getItem('daytrace_pause_duration');
      // if (savedPauseDuration) {
      //   const duration = parseInt(savedPauseDuration, 10);
      //   if (duration >= 0 && duration <= 60) {
      //     setPauseDuration(duration);
      //   }
      // }
      
      if (savedSession && savedSession.questions.length > 0) {
        console.log('Restoring saved session:', savedSession.id);
        setQuestions(savedSession.questions);
        setQuestionStates(savedSession.questionStates);
        setCurrentQuestionIndex(savedSession.currentQuestionIndex);
        setIsQnAActive(savedSession.isQnAActive);
        setCurrentSessionId(savedSession.id);
        
        toast({ 
          title: "Session Restored", 
          description: `Restored session with ${savedSession.questions.length} questions from ${new Date(savedSession.timestamp).toLocaleString()}`
        });
      }
    };
    
    initSpeech();
    loadSavedSession();
  }, [toast]);

  const stopTranscription = useCallback(() => {
    if (isTranscribing && speechRecognitionRef.current) {
      speechRecognitionRef.current.stopListening();
      setIsTranscribing(false);
    }
  }, [isTranscribing]);

  const navigate = useCallback((direction: 'next' | 'prev' | 'skip' | 'jump', targetIndex?: number) => {
    console.log(`[NAVIGATION] Navigate ${direction} requested`);
    console.log(`[STATE TRANSITION] Navigation interrupting state: ${getCurrentState()}`);
    
    if (questions.length === 0 || !isQnAActive) {
      console.log('[NAVIGATION] Cannot navigate - no questions or Q&A inactive');
      return;
    }

    speechSynthesis?.cancel();
    stopTranscription();

    let newIndex = currentQuestionIndex;
    const oldIndex = currentQuestionIndex;

    const currentQ = questions[oldIndex];
    const currentQStateInteraction = currentQ ? questionStates[currentQ.id] : undefined;

    if (currentQ && currentQStateInteraction) {
      if (currentQStateInteraction.status === 'pending') {
        if (currentQStateInteraction.answer.trim() !== '') {
          setQuestionStates(prev => ({ ...prev, [currentQ.id]: { ...currentQStateInteraction, status: 'answered' } }));
        } else if (direction === 'skip') {
          setQuestionStates(prev => ({ ...prev, [currentQ.id]: { ...currentQStateInteraction, status: 'skipped' } }));
        }
      }
    }

    if (direction === 'next' || direction === 'skip') {
      newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    } else if (direction === 'prev') {
      newIndex = Math.max(0, currentQuestionIndex - 1);
    } else if (direction === 'jump' && targetIndex !== undefined) {
      newIndex = Math.max(0, Math.min(questions.length - 1, targetIndex));
    }
    
    if (newIndex !== oldIndex) {
       setCurrentQuestionIndex(newIndex);
       // Auto-save on navigation
       if (questions.length > 0) {
         SessionStorage.saveCurrentSession(
           questions,
           questionStates,
           newIndex,
           isQnAActive,
           currentSessionId || undefined
         );
       }
       // Will trigger reading in useEffect when currentQuestionIndex changes
    } else if ((direction === 'next' || direction === 'skip') && currentQuestionIndex === questions.length - 1 && oldIndex === currentQuestionIndex) {
       toast({ title: "End of questions", description: "You've reached the last question."});
    }
  }, [questions, currentQuestionIndex, questionStates, isQnAActive, stopTranscription, toast]);

  const processVoiceCommands = useCallback((text: string, currentQuestionId: string) => {
    let cleanedText = text;
    let commandExecuted = false;

    // Check for voice commands (case insensitive)
    // Support variations: daytrace, day trace, they trace
    const lowerText = text.toLowerCase();
    
    // Define command patterns - check longer phrases first
    const commandPatterns = [
      // {
      //   patterns: [/\b(daytrace|day trace|they trace)\s+set\s+wait\s+to\s+(\d+)\b/gi],
      //   command: 'set_wait',
      //   execute: (match: RegExpMatchArray) => {
      //     const seconds = parseInt(match[2], 10);
      //     if (seconds >= 0 && seconds <= 60) {
      //       setPauseDuration(seconds);
      //       // localStorage.setItem('daytrace_pause_duration', seconds.toString());
      //       toast({ title: "Voice Command", description: `Wait time set to ${seconds} seconds` });
      //     } else {
      //       toast({ title: "Voice Command", description: "Wait time must be between 0 and 60 seconds", variant: "destructive" });
      //     }
      //   }
      // },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+previous\s+question\b/gi, /\b(daytrace|day trace|they trace)\s+previous\b/gi],
        command: 'prev'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+clear\s+answer\b/gi],
        command: 'clear',
        execute: () => {
          setQuestionStates(prev => ({
            ...prev,
            [currentQuestionId]: {
              ...(prev[currentQuestionId] || { answer: '', status: 'pending' }),
              answer: '',
              status: 'pending'
            }
          }));
          toast({ title: "Voice Command", description: "Answer cleared" });
        }
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+next\b/gi],
        command: 'next'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+skip\b/gi],
        command: 'skip'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+summary\b/gi],
        command: 'summary'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+repeat\b/gi],
        command: 'repeat'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+pause\b/gi],
        command: 'pause'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace)\s+resume\b/gi],
        command: 'resume'
      }
    ];

    // Check each command pattern
    for (const { patterns, command, execute } of commandPatterns) {
      for (const pattern of patterns) {
        const match = pattern.exec(lowerText);
        if (match) {
          cleanedText = text.replace(pattern, '').trim();
          commandExecuted = true;
          if (execute) {
            execute(match);
          }
          return { cleanedText, commandExecuted, command };
        }
      }
    }

    return { cleanedText, commandExecuted };
  }, [toast, setQuestionStates, handlePause, handleResume]);

  const actuallyStartTranscription = async () => {
    console.log('[STT] actuallyStartTranscription called');
    console.log(`[STATE TRANSITION] Starting STT. Previous state: ${getCurrentState()}`);
    
    if (!isSpeechReady || !speechRecognitionRef.current) {
      console.log('[STT] Speech recognition not ready');
      toast({ title: "STT Not Ready", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }
    if (isTranscribing) {
      console.log('[STT] Already transcribing, ignoring duplicate start request');
      return;
    }

    // Ensure speech synthesis is completely stopped before starting transcription
    if (speechSynthesis && speechSynthesis.speaking) {
      console.log('[STT] Speech synthesis still active, cancelling and waiting');
      speechSynthesis.cancel();
      // Wait for speech to stop, then try again once
      setTimeout(() => {
        if (!speechSynthesis.speaking && !isTranscribing) {
          actuallyStartTranscription();
        }
      }, 500);
      return;
    }

    // Capture current question info at start of transcription
    const questionAtStart = currentQuestion;
    const questionIndexAtStart = currentQuestionIndex;

    try {
      setIsTranscribing(true);
      console.log('[STT] Starting speech recognition');
      console.log(`[STATE TRANSITION] STT started. Current state: ${getCurrentState()}`);
      toast({ title: "Listening...", description: "Speak now. Recognition will stop automatically when you finish." });
      
      const transcribedText = await speechRecognitionRef.current.startListening();
      
      console.log('[STT] Speech recognition completed, processing results');
      console.log('[STT] Transcribed text length:', transcribedText.length, 'Content:', transcribedText);
      console.log(`[STATE TRANSITION] STT ended. Current state: ${getCurrentState()}`);
      
      if (transcribedText.trim() && questionAtStart) {
        console.log('[STT] Raw transcribed text:', transcribedText);
        console.log('[STT] Question at start:', questionAtStart.id);
        
        // Process voice commands first
        const result = processVoiceCommands(transcribedText, questionAtStart.id);
        const { cleanedText, commandExecuted, command } = result as any;
        console.log('Cleaned text after command processing:', cleanedText);
        
        if (cleanedText.trim()) {
          // Get current answer for the question we started with
          const currentAnswer = questionStates[questionAtStart.id]?.answer || '';
          
          // Check if there's already text - if so, append; if not, replace
          let newAnswer;
          if (currentAnswer.trim() === '') {
            newAnswer = cleanedText; // First input - replace empty answer
          } else {
            newAnswer = currentAnswer + ' ' + cleanedText; // Subsequent input - append
          }
          
          console.log('New answer will be:', newAnswer);
          
          // Update the specific question we were answering
          setQuestionStates(prev => ({
            ...prev,
            [questionAtStart.id]: {
              ...(prev[questionAtStart.id] || { answer: '', status: 'pending' }),
              answer: newAnswer.trim(),
              status: 'answered'
            }
          }));
          
          const action = currentAnswer.trim() === '' ? 'Set' : 'Added';
          toast({ title: "Transcription", description: `${action}: "${cleanedText}"` });
          
          // Smart auto-navigation after answering
          if (!commandExecuted) {
            const wasBlankQuestion = currentAnswer.trim() === '';
            const currentIndex = questions.findIndex(q => q.id === questionAtStart.id);
            
            console.log('[AUTO-NAV] Planning auto-navigation:', { wasBlankQuestion, currentIndex });
            
            setTimeout(() => {
              if (wasBlankQuestion) {
                // Completing mode: jump to next blank question after current
                const nextBlankIndex = questions.findIndex((q, idx) => {
                  if (idx <= currentIndex) return false;
                  return isQuestionUnanswered(q.id);
                });
                
                if (nextBlankIndex >= 0) {
                  console.log(`[AUTO-NAV] Completing mode: jumping to next blank question ${nextBlankIndex + 1}`);
                  navigate('jump', nextBlankIndex);
                  toast({ title: "Auto-navigation", description: `Moved to next unanswered question ${nextBlankIndex + 1}` });
                } else {
                  console.log('[AUTO-NAV] Completing mode: all questions answered');
                  toast({ title: "Complete", description: "All questions have been answered!" });
                }
              } else {
                // Reviewing mode: go to next sequential question
                if (currentIndex < questions.length - 1) {
                  console.log(`[AUTO-NAV] Reviewing mode: moving to next sequential question ${currentIndex + 2}`);
                  navigate('next');
                  toast({ title: "Auto-navigation", description: "Moved to next question for review" });
                } else {
                  console.log('[AUTO-NAV] Reviewing mode: reached last question');
                  toast({ title: "End", description: "Reached the last question" });
                }
              }
            }, 1000); // Small delay to let user see the transcription
          }
        }
        
        // Execute voice commands after saving text
        if (commandExecuted && command) {
          setTimeout(() => {
            if (command === 'next') {
              navigate('next');
              toast({ title: "Voice Command", description: "Moving to next question" });
            } else if (command === 'prev') {
              navigate('prev');
              toast({ title: "Voice Command", description: "Moving to previous question" });
            } else if (command === 'skip') {
              navigate('skip');
              toast({ title: "Voice Command", description: "Skipping question" });
            } else if (command === 'summary') {
              handleShowSummary();
              toast({ title: "Voice Command", description: "Showing summary" });
            } else if (command === 'repeat') {
              handleReadAloud();
              toast({ title: "Voice Command", description: "Repeating question" });
            } else if (command === 'pause') {
              handlePause();
              toast({ title: "Voice Command", description: "Pausing..." });
            } else if (command === 'resume') {
              handleResume();
              toast({ title: "Voice Command", description: "Resuming..." });
            }
          }, 100);
        } else if (!commandExecuted && cleanedText.trim()) {
          // Auto-advance to next question after a short delay (only if no command was executed AND not on last question)
          if (questionIndexAtStart < questions.length - 1) {
            setTimeout(() => {
              console.log('Auto-advancing from question', questionIndexAtStart + 1, 'to', questionIndexAtStart + 2);
              navigate('next');
            }, 1500);
          } else {
            // On last question, just show completion message
            setTimeout(() => {
              toast({ title: "Complete!", description: "You've finished all questions! Use navigation to review." });
            }, 1000);
          }
        }
      } else {
        console.log('[STT] No transcribed text received. Details:', {
          transcribedTextLength: transcribedText.length,
          transcribedText: `"${transcribedText}"`,
          questionAtStart: questionAtStart?.id,
          hasQuestion: !!questionAtStart
        });
        
        if (!questionAtStart) {
          console.error('[STT] Question was lost during transcription!');
        }
      }
    } catch (error) {
      console.error("[STT] Error during transcription:", error);
      toast({ title: "STT Error", description: "Speech recognition failed. Please try again.", variant: "destructive"});
    } finally {
      console.log('[STT] Transcription session ended, setting isTranscribing to false');
      setIsTranscribing(false);
      
      // Check if we need to restart STT or enter a different state
      setTimeout(() => {
        const newState = getCurrentState();
        console.log(`[STATE CHECK] After STT ended, current state is: ${newState}`);
        
        if (isQnAActive && newState === 'none') {
          console.log('🚨 [STT] Detected invalid state after STT ended - should restart STT or start TTS');
          // If we're in an invalid state and Q&A is active, restart STT
          if (isSpeechReady && currentQuestion && speechRecognitionRef.current) {
            console.log('[STT] Auto-restarting STT due to invalid state');
            setTimeout(() => {
              if (speechRecognitionRef.current && !isTranscribing) {
                speechRecognitionRef.current.startListening().catch(console.error);
              }
            }, 500);
          }
        }
      }, 100); // Small delay to let state settle
    }
  };

  const readQuestionAndPotentiallyListen = useCallback((questionText: string) => {
    console.log('[TTS] readQuestionAndPotentiallyListen called with:', questionText);
    console.log(`[STATE TRANSITION] Starting TTS. Previous state: ${getCurrentState()}`);
    
    // Prevent multiple simultaneous calls
    if (readingQuestionRef.current) {
      console.log('[TTS] Already reading a question, ignoring this call');
      return;
    }
    
    // Stop any existing transcription first but don't recurse
    if (isTranscribing) {
      console.log('[TTS] Stopping existing transcription before reading question');
      stopTranscription();
      return; // Exit early, don't recurse
    }
    
    readingQuestionRef.current = true;
    
    if (!speechSynthesis || !questionText) {
      console.log('No speech synthesis or question text, starting transcription immediately');
      if (isQnAActive && isSpeechReady && !isTranscribing && speechRecognitionRef.current) {
         setTimeout(() => {
           if (speechRecognitionRef.current && !isTranscribing) {
             setIsTranscribing(true);
             speechRecognitionRef.current.startListening()
               .then((text) => {
                 console.log('[NO-TTS] Direct transcription result:', text);
                 setIsTranscribing(false);
               })
               .catch((error) => {
                 console.error('[NO-TTS] Transcription error:', error);
                 setIsTranscribing(false);
               });
           }
         }, 500);
      }
      readingQuestionRef.current = false;
      return;
    }
    
    // Cancel any existing speech with extra safety
    if (speechSynthesis.speaking) {
      console.log('Cancelling existing speech synthesis');
      speechSynthesis.cancel();
    }
    
    // Wait longer for speech synthesis to clear before starting
    setTimeout(() => {
      // Double-check speech synthesis isn't still speaking
      if (speechSynthesis.speaking) {
        console.log('Speech still active, skipping this read attempt');
        return; // Don't recurse, just skip
      }
      
      const utterance = new SpeechSynthesisUtterance(questionText);
      
      utterance.onstart = () => {
        console.log('[TTS] Started reading question');
        console.log(`[STATE TRANSITION] TTS started. Current state: ${getCurrentState()}`);
      };
      
      utterance.onend = () => {
        console.log('[TTS] Finished reading question, starting transcription immediately');
        console.log(`[STATE TRANSITION] TTS ended, transitioning to STT. Current state: ${getCurrentState()}`);
        readingQuestionRef.current = false;
        if (isQnAActive && isSpeechReady && !isTranscribing) {
          // Play audible ding cue immediately, then start STT
          playDingSound(() => {
            setTimeout(() => actuallyStartTranscription(), 200);
          });
        } else {
          console.log('[TTS→STT] Cannot start STT:', { isQnAActive, isSpeechReady, isTranscribing });
        }
      };
      
      utterance.onerror = (event) => {
        console.error("[TTS] Speech synthesis error", event);
        console.log(`[STATE TRANSITION] TTS error: ${event.error}. Current state: ${getCurrentState()}`);
        readingQuestionRef.current = false;
        // Only show error toast for non-interrupted errors
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          toast({ title: "Error", description: "Failed to read question aloud.", variant: "destructive" });
        }
        // For interrupted/canceled speech, don't auto-start STT to avoid stuck state
        // User can manually start recording if needed
        console.log('[TTS] Speech was interrupted/canceled, not auto-starting STT');
      };
      
      console.log('[TTS] Starting to speak question');
      speechSynthesis.speak(utterance);
    }, 200);
  }, [isQnAActive, isSpeechReady, isTranscribing, stopTranscription, toast, pauseDuration, getCurrentState, playDingSound]);

  useEffect(() => {
    return () => {
      stopTranscription();
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
    };
  }, [stopTranscription]);

  const handleImportJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsedData = JSON.parse(content);
          
          let questionsWithIds: Question[] = [];
          let questionStatesData: AllQuestionStates = {};
          let sessionInfo: any = null;
          let isSessionImport = false;
          
          // Check if it's an exported session format
          if (parsedData && typeof parsedData === 'object' && !Array.isArray(parsedData) && 
              parsedData.sessionInfo && parsedData.questions && Array.isArray(parsedData.questions)) {
            // Handle exported session format
            const exportedSession = parsedData as ExportedSessionFormat;
            isSessionImport = true;
            sessionInfo = exportedSession.sessionInfo;
            
            questionsWithIds = exportedSession.questions.map((q, index) => ({
              text: q.question,
              id: q.id || `q-${Date.now()}-${index}`,
              context: undefined
            }));
            
            // Restore previous answers and states
            questionStatesData = {};
            exportedSession.questions.forEach(q => {
              questionStatesData[q.id] = {
                answer: q.answer || '',
                status: (q.status as any) || 'pending'
              };
            });
            
            setIsSessionContinuation({
              active: true,
              sessionInfo: {
                ...sessionInfo,
                originalDate: sessionInfo.date,
                questionCount: exportedSession.questions.length,
                previouslyAnswered: exportedSession.summary?.answered || 0
              }
            });
            
          } else if (Array.isArray(parsedData)) {
            // Handle simple question array format
            const parsedInput: ImportedQuestionFormat[] = parsedData;
            if (!parsedInput.every(q => typeof q.question === 'string')) {
              throw new Error("Invalid JSON format. Expected an array of objects with a 'question' property.");
            }
            
            questionsWithIds = parsedInput.map((q, index) => {
              const { question, id, ...context } = q;
              return {
                text: question,
                id: id || `q-${Date.now()}-${index}`,
                context: Object.keys(context).length > 0 ? context : undefined
              };
            });
            
            setIsSessionContinuation({active: false});
            
          } else {
            throw new Error("Invalid JSON format. Expected either an array of questions or an exported session object.");
          }
          
          setQuestions(questionsWithIds);
          
          if (Object.keys(questionStatesData).length > 0) {
            setQuestionStates(questionStatesData);
            // Find first unanswered question for session continuation using proper logic
            const firstUnansweredIndex = questionsWithIds.findIndex(q => {
              const state = questionStatesData[q.id];
              // Question is unanswered if:
              // 1. No state exists at all, OR
              // 2. Status is 'pending', OR  
              // 3. Answer is empty/whitespace only
              return !state || 
                     state.status === 'pending' || 
                     !state.answer || 
                     state.answer.trim() === '';
            });
            
            console.log('[IMPORT] First unanswered question index:', firstUnansweredIndex);
            if (firstUnansweredIndex >= 0) {
              console.log('[IMPORT] Jumping to first unanswered question:', firstUnansweredIndex + 1);
            }
            
            setCurrentQuestionIndex(firstUnansweredIndex >= 0 ? firstUnansweredIndex : 0);
          } else {
            initQuestionStates(questionsWithIds);
            setCurrentQuestionIndex(0);
          }
          
          setIsQnAActive(false);
          
          // Create new session when importing questions
          const sessionId = SessionStorage.saveCurrentSession(
            questionsWithIds,
            questionStatesData,
            0,
            false
          );
          setCurrentSessionId(sessionId);
          
          const message = isSessionImport 
            ? `Session continued from ${sessionInfo?.date || 'previous session'} with ${questionsWithIds.length} questions.`
            : "Questions imported successfully.";
          
          toast({ title: "Success", description: message });
        } catch (error) {
          console.error("Failed to parse JSON:", error);
          toast({ title: "Error", description: `Failed to import JSON. ${error instanceof Error ? error.message : 'Unknown error.'}`, variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
    event.target.value = '';
  };

  const handleExportJson = () => {
    if (questions.length === 0) {
      toast({ title: "Info", description: "No data to export." });
      return;
    }
    
    // Use the enhanced session export format
    const currentSession: SavedSession = {
      id: currentSessionId || SessionStorage.generateSessionId(),
      timestamp: Date.now(),
      questions,
      questionStates,
      currentQuestionIndex,
      isQnAActive,
      title: `Current Session - ${questions.length} questions`
    };
    
    const jsonString = SessionStorage.exportSessionAsJSON(currentSession);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daytrace_session_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Session exported successfully with full metadata." });
  };
  
  const handleAnswerChange = (answer: string) => {
    updateCurrentQuestionState({ answer });
    if (currentQuestion && questionStates[currentQuestion.id]?.status === 'pending' && answer.trim() !== '') {
        updateCurrentQuestionState({ status: 'answered' });
    }
  };

  const handleClearAnswer = () => {
    updateCurrentQuestionState({ answer: '' });
  };

  const handleNextQuestion = () => navigate('next');
  const handlePrevQuestion = () => navigate('prev');
  const handleSkipQuestion = () => {
    if (currentQuestion && (questionStates[currentQuestion.id]?.answer || '').trim() === '') {
        updateCurrentQuestionState({ status: 'skipped' });
    }
    navigate('skip');
  };
  const handleJumpToQuestion = (questionNumber: number) => {
    stopTranscription();
    navigate('jump', questionNumber - 1);
  }

  const handleReadAloud = () => {
    if (!currentQuestion || !isQnAActive) {
      toast({ title: "Info", description: "No question to read or Q&A not active." });
      return;
    }
    stopTranscription(); 
    readQuestionAndPotentiallyListen(currentQuestion.text);
  };

  const handlePause = () => {
    console.log('[PAUSE] Pause requested');
    console.log(`[STATE TRANSITION] Pausing from state: ${getCurrentState()}`);
    
    if (isPaused) {
      console.log('[PAUSE] Already paused, ignoring');
      return;
    }

    if (speechSynthesis && speechSynthesis.speaking) {
      // Pause TTS
      console.log('[PAUSE] Pausing TTS');
      speechSynthesis.cancel();
      setPausedContent({
        type: 'tts',
        content: currentQuestion?.text || '',
        questionId: currentQuestion?.id || ''
      });
      setIsPaused(true);
      console.log(`[STATE TRANSITION] Paused from TTS. Current state: ${getCurrentState()}`);
      toast({ title: "Paused", description: "Speech paused" });
    } else if (isTranscribing) {
      // Pause STT - stop listening and save any interim results
      console.log('[PAUSE] Pausing STT');
      stopTranscription();
      setPausedContent({
        type: 'stt',
        content: '', // We'll handle partial transcription in the speech recognition
        questionId: currentQuestion?.id || ''
      });
      setIsPaused(true);
      console.log(`[STATE TRANSITION] Paused from STT. Current state: ${getCurrentState()}`);
      toast({ title: "Paused", description: "Recording paused" });
    } else {
      console.log('[PAUSE] No active TTS or STT to pause');
    }
  };

  const handleResume = () => {
    console.log('[RESUME] Resume requested');
    console.log(`[STATE TRANSITION] Resuming from state: ${getCurrentState()}`);
    
    if (!isPaused || !pausedContent) {
      console.log('[RESUME] Not paused or no paused content, ignoring');
      return;
    }

    if (pausedContent.type === 'tts') {
      console.log('[RESUME] Resuming TTS');
      // Resume TTS from the beginning (since we can't resume mid-speech)
      readQuestionAndPotentiallyListen(pausedContent.content);
    } else if (pausedContent.type === 'stt') {
      console.log('[RESUME] Resuming STT');
      // Resume STT
      if (isSpeechReady && !isTranscribing && speechRecognitionRef.current) {
        setIsTranscribing(true);
        speechRecognitionRef.current.startListening()
          .then((text) => {
            console.log('[RESUME] Transcription result:', text);
            setIsTranscribing(false);
          })
          .catch((error) => {
            console.error('[RESUME] Transcription error:', error);
            setIsTranscribing(false);
          });
      } else {
        console.log('[RESUME] Cannot resume STT:', { isSpeechReady, isTranscribing });
      }
    }

    setPausedContent(null);
    setIsPaused(false);
    console.log(`[STATE TRANSITION] Resumed. Current state: ${getCurrentState()}`);
    toast({ title: "Resumed", description: "Continuing..." });
  };

  const handleToggleTranscription = () => {
    if (!isSpeechReady) {
      toast({ title: "STT Error", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }
    if (!isQnAActive) {
      toast({ title: "Info", description: "Q&A not active.", variant: "default" });
      return;
    }

    if (isTranscribing) {
      stopTranscription();
    } else {
      if (speechRecognitionRef.current && !isTranscribing) {
        setIsTranscribing(true);
        speechRecognitionRef.current.startListening()
          .then((text) => {
            console.log('[TOGGLE] Transcription result:', text);
            setIsTranscribing(false);
          })
          .catch((error) => {
            console.error('[TOGGLE] Transcription error:', error);
            setIsTranscribing(false);
          });
      }
    }
  };

  const refreshSavedSessions = useCallback(() => {
    const allSessions = SessionStorage.getAllSessions();
    setSavedSessions(allSessions);
  }, []);

  const handleStartQnA = () => {
    if (questions.length > 0) {
      // Find first unanswered question using the same logic as import
      const startIndex = findFirstUnansweredIndex();
      const finalStartIndex = startIndex >= 0 ? startIndex : 0;
      const startQuestion = questions[finalStartIndex];
      const startQuestionId = startQuestion.id;

      console.log('[START Q&A] Starting at question index:', finalStartIndex + 1, 'of', questions.length);

      setQuestionStates(prev => ({
        ...prev,
        [startQuestionId]: {
          ...(prev[startQuestionId] || { answer: '' }),
          status: 'pending',
        },
      }));
      setCurrentQuestionIndex(finalStartIndex);
      setIsQnAActive(true);
      setJustStartedQnA(true);
      
      // Save Q&A start state
      if (questions.length > 0) {
        SessionStorage.saveCurrentSession(
          questions,
          questionStates,
          finalStartIndex,
          true,
          currentSessionId || undefined
        );
      }
    }
  };

  useEffect(() => {
    if (justStartedQnA && isQnAActive && currentQuestion && questions.length > 0) {
      console.log('Starting Q&A - reading first unanswered question');
      readQuestionAndPotentiallyListen(currentQuestion.text);
      setJustStartedQnA(false); 
    }
  }, [justStartedQnA]);

  // Read question when index changes (for navigation) - but not on initial load
  useEffect(() => {
    if (isQnAActive && currentQuestion && !justStartedQnA) {
      console.log('Navigation triggered - reading question', currentQuestionIndex + 1);
      // Ensure any ongoing operations are stopped
      stopTranscription();
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
      // Add a longer delay to ensure clean state transition
      setTimeout(() => {
        readQuestionAndPotentiallyListen(currentQuestion.text);
      }, 500);
    }
  }, [currentQuestionIndex]);
  
  const getProgressSummary = () => {
    const answeredCount = Object.values(questionStates).filter(s => s.status === 'answered').length;
    const skippedCount = Object.values(questionStates).filter(s => s.status === 'skipped').length;
    const skippedQuestionTexts = questions
      .filter(q => questionStates[q.id]?.status === 'skipped')
      .map((q, idx) => `Question ${questions.findIndex(origQ => origQ.id === q.id) + 1}`)
      .join(', ');

    let summary = `You have answered ${answeredCount} out of ${questions.length} questions. `;
    if (skippedCount > 0) {
      summary += `${skippedCount} questions were skipped: ${skippedQuestionTexts}.`;
    } else if (questions.length > 0) {
      summary += "No questions were skipped.";
    } else {
      summary = "No questions loaded to summarize."
    }
    return { summaryText: summary, answeredCount, skippedCount };
  };

  const handleShowSummary = () => {
    if (questions.length === 0) {
      toast({ title: "Info", description: "No questions loaded to summarize." });
      return;
    }
    const { summaryText } = getProgressSummary();
    toast({ title: "Progress Summary", description: summaryText, duration: 10000 });
    if (speechSynthesis) {
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(summaryText);
        speechSynthesis.speak(utterance);
    }
  };
  
  const { answeredCount, skippedCount } = getProgressSummary();
  const isSttDisabled = !isSpeechReady || !isQnAActive || questions.length === 0;
  const audioControlsDisabled = !isQnAActive || questions.length === 0;
  const paletteDisabled = !isQnAActive || questions.length === 0;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="flex-grow container mx-auto px-4 py-8 space-y-8 max-w-3xl">
        <Card>
            <CardContent className="p-6">
                <FileControls 
                    onImport={handleImportJson} 
                    onExport={handleExportJson}
                    isExportDisabled={questions.length === 0}
                />
                
                {isSessionContinuation.active && (
                    <Card className="mt-4 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">Session Continuation</span>
                            </div>
                            <div className="mt-2 text-sm text-orange-700 dark:text-orange-300">
                                <p>Continuing from {isSessionContinuation.sessionInfo?.originalDate}</p>
                                <p>{isSessionContinuation.sessionInfo?.questionCount} questions • {isSessionContinuation.sessionInfo?.previouslyAnswered} previously answered</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
                
                 {questions.length > 0 && !isQnAActive && (
                    <Button onClick={handleStartQnA} className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90">
                        Start Q&A
                    </Button>
                )}
            </CardContent>
        </Card>

        {questions.length === 0 && (
            <>
                <Card className="min-h-[150px] flex items-center justify-center">
                    <CardContent className="p-6 text-center">
                        <p className="text-lg text-muted-foreground">
                            Import questions to start.
                        </p>
                    </CardContent>
                </Card>
                
                <Card>
                    <CardContent className="p-6">
                        <h3 className="text-lg font-semibold mb-3">How to Use Daytrace</h3>
                        <div className="space-y-2 text-sm text-muted-foreground">
                            <p><strong>1. Import Questions:</strong> Upload a JSON file with your questions</p>
                            <p><strong>2. Start Q&A:</strong> Click "Start Q&A" to begin the session</p>
                            <p><strong>3. Listen & Respond:</strong> Each question will be read aloud, followed by a "beep" indicating you can speak</p>
                            <p><strong>4. Voice Commands:</strong> Say "daytrace next", "daytrace previous", "daytrace skip", "daytrace repeat", "daytrace clear answer", or "daytrace set wait to X" during recording</p>
                            <p><strong>5. Navigation:</strong> Use voice commands or the control buttons to navigate questions</p>
                            <p className="text-xs mt-3 italic">Note: Voice commands also work with "day trace" or "they trace" if speech recognition mishears the phrase.</p>
                        </div>
                    </CardContent>
                </Card>
                
                <SessionManager 
                  savedSessions={savedSessions}
                  onSessionsUpdate={refreshSavedSessions}
                />
            </>
        )}

        {!isQnAActive && questions.length > 0 && (
             <Card className="min-h-[150px] flex items-center justify-center">
                <CardContent className="p-6 text-center">
                    <p className="text-lg text-muted-foreground">
                        Press "Start Q&A" above to begin.
                    </p>
                </CardContent>
            </Card>
        )}
        
        {isQnAActive && questions.length > 0 && currentQuestion && (
          <>
            <ProgressIndicator
              current={currentQuestionIndex + 1}
              total={questions.length}
              answered={answeredCount}
              skipped={skippedCount}
            />

            <QuestionDisplay
              question={currentQuestion}
              currentQuestionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
            />

            <AnswerArea
              answer={currentQuestionState?.answer || ''}
              onAnswerChange={handleAnswerChange}
              onClearAnswer={handleClearAnswer}
              isReadOnly={false} 
            />
            
            <Card>
                <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <NavigationControls
                        onPrevious={handlePrevQuestion}
                        onNext={handleNextQuestion}
                        onSkip={handleSkipQuestion}
                        canPrevious={currentQuestionIndex > 0}
                        canNext={questions.length > 0}
                    />
                    <AudioControls
                        onReadAloud={handleReadAloud}
                        onToggleTranscription={handleToggleTranscription}
                        onPause={handlePause}
                        onResume={handleResume}
                        isTranscribing={isTranscribing}
                        isPaused={isPaused}
                        isAudioDisabled={audioControlsDisabled}
                        isSttDisabled={isSttDisabled}
                    />
                </CardContent>
            </Card>
          </>
        )}

        <VoiceCommandPalette
          onRepeat={handleReadAloud}
          onClearAnswer={handleClearAnswer}
          onJumpToQuestion={handleJumpToQuestion}
          onSummary={handleShowSummary}
          isPaletteDisabled={paletteDisabled}
          maxQuestions={questions.length}
        />
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t space-y-2">
        <p>Daytrace &copy; {new Date().getFullYear()}</p>
        <p>
          Enjoying Daytrace?{' '}
          <a
            href="https://ko-fi.com/randyj18"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Support development ☕
          </a>
        </p>
      </footer>
    </div>
  );
}