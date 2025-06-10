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
  
  // Proper state machine implementation with immediate access
  type AppState = 'inactive' | 'tts' | 'stt' | 'paused' | 'transitioning';
  const appStateRef = useRef<AppState>('inactive');
  const [appState, setAppStateInternal] = useState<AppState>('inactive');
  
  // State setter that updates both ref and React state
  const setAppState = useCallback((newState: AppState) => {
    const previousState = appStateRef.current;
    appStateRef.current = newState;
    setAppStateInternal(newState);
    console.log(`[STATE MACHINE] ${previousState} → ${newState}`);
  }, []);
  
  // Get current state immediately (no async delay)
  const getCurrentState = useCallback(() => {
    return appStateRef.current;
  }, []);

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

  // Simple state monitoring (removed complex recovery logic)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const logState = () => {
      const state = getCurrentState();
      console.log(`[STATE] Current: ${state}, Q&A: ${isQnAActive}, Question: ${currentQuestionIndex + 1}`);
    };

    if (isQnAActive) {
      const interval = setInterval(logState, 3000);
      return () => clearInterval(interval);
    }
  }, [isQnAActive, getCurrentState, currentQuestionIndex]);
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
      if (appStateRef.current === 'stt') {
        setAppState('transitioning');
      }
    }
  }, [isTranscribing, setAppState]);


  const navigate = useCallback((direction: 'next' | 'prev' | 'skip' | 'jump', targetIndex?: number) => {
    console.log(`[NAVIGATION] Navigate ${direction} requested`);
    
    if (questions.length === 0 || !isQnAActive) {
      console.log('[NAVIGATION] Cannot navigate - no questions or Q&A inactive');
      return;
    }

    // Stop any active operations immediately
    if (speechSynthesis?.speaking) {
      speechSynthesis.cancel();
    }
    if (isTranscribing && speechRecognitionRef.current) {
      speechRecognitionRef.current.stopListening();
      setIsTranscribing(false);
    }
    readingQuestionRef.current = false;

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
    } else if ((direction === 'next' || direction === 'skip') && currentQuestionIndex === questions.length - 1 && oldIndex === currentQuestionIndex) {
       toast({ title: "End of questions", description: "You've reached the last question."});
    }
  }, [questions, currentQuestionIndex, questionStates, isQnAActive, isTranscribing, toast]);

  const processVoiceCommands = useCallback((text: string, currentQuestionId: string) => {
    let cleanedText = text;
    let commandExecuted = false;

    const trimmedText = text.trim().toLowerCase();
    
    // Check for jump commands first (with numbers)
    const jumpMatch = trimmedText.match(/^(?:jump to question (\d+)|jump to (\d+))$/);
    if (jumpMatch) {
      const questionNumber = parseInt(jumpMatch[1] || jumpMatch[2], 10);
      console.log(`[VOICE] Jump command detected: jump to question ${questionNumber}`);
      return { cleanedText: '', commandExecuted: true, command: 'jump', targetQuestionNumber: questionNumber };
    }

    // Check for standalone commands (exact matches)
    const standaloneCommands: Record<string, string> = {
      'next': 'next',
      'next question': 'next',
      'previous': 'prev', 
      'previous question': 'prev',
      'skip': 'skip',
      'skip question': 'skip',
      'summary': 'summary',
      'repeat': 'repeat',
      'repeat question': 'repeat',
      'pause': 'pause',
      'resume': 'resume',
      'clear answer': 'clear'
    };

    // Check for exact standalone command matches
    if (standaloneCommands[trimmedText]) {
      const command = standaloneCommands[trimmedText];
      console.log(`[VOICE] Standalone command detected: "${trimmedText}" -> ${command}`);
      
      if (command === 'clear') {
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
      
      return { cleanedText: '', commandExecuted: true, command };
    }

    // Check for prefixed commands (legacy support)
    const prefixedPatterns = [
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+previous\s+question\b/gi, /\b(daytrace|day trace|they trace|hey trace|retrace)\s+previous\b/gi],
        command: 'prev'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+clear\s+answer\b/gi],
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
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+next\s+question\b/gi, /\b(daytrace|day trace|they trace|hey trace|retrace)\s+next\b/gi],
        command: 'next'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+skip\s+question\b/gi, /\b(daytrace|day trace|they trace|hey trace|retrace)\s+skip\b/gi],
        command: 'skip'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+summary\b/gi],
        command: 'summary'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+repeat\b/gi],
        command: 'repeat'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+pause\b/gi],
        command: 'pause'
      },
      {
        patterns: [/\b(daytrace|day trace|they trace|hey trace|retrace)\s+resume\b/gi],
        command: 'resume'
      }
    ];

    // Check prefixed command patterns
    for (const { patterns, command, execute } of prefixedPatterns) {
      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) {
          cleanedText = text.replace(pattern, '').trim();
          commandExecuted = true;
          console.log(`[VOICE] Prefixed command detected: "${match[0]}" -> ${command}`);
          if (execute) {
            execute();
          }
          return { cleanedText, commandExecuted, command };
        }
      }
    }

    return { cleanedText, commandExecuted };
  }, [toast, setQuestionStates]);

  const actuallyStartTranscription = useCallback(async () => {
    console.log('[STT] Simple listen and auto-navigate flow');
    
    if (!isSpeechReady || !speechRecognitionRef.current || isTranscribing) {
      console.log('[STT] Cannot start - not ready or already active');
      return;
    }
    
    if (speechSynthesis?.speaking || readingQuestionRef.current) {
      console.log('[STT] Cannot start - TTS is active');
      return;
    }

    const questionAtStart = currentQuestion;
    if (!questionAtStart) return;

    try {
      setIsTranscribing(true);
      setAppState('stt');
      toast({ title: "Listening", description: "Speak your answer..." });
      
      const transcribedText = await speechRecognitionRef.current.startListening();
      console.log('[STT] Got text:', transcribedText);
      
      if (transcribedText?.trim()) {
        // Process voice commands
        const result = processVoiceCommands(transcribedText, questionAtStart.id);
        const { cleanedText, commandExecuted, command } = result as any;
        
        if (cleanedText.trim()) {
          // Save the answer (append if already has answer)
          const currentAnswer = questionStates[questionAtStart.id]?.answer || '';
          const newAnswer = currentAnswer.trim() === '' ? cleanedText.trim() : currentAnswer + ' ' + cleanedText.trim();
          
          setQuestionStates(prev => ({
            ...prev,
            [questionAtStart.id]: {
              ...(prev[questionAtStart.id] || { answer: '', status: 'pending' }),
              answer: newAnswer,
              status: 'answered'
            }
          }));
          
          toast({ title: "Answer Saved", description: `"${cleanedText}"` });
          
          // Auto-navigate to next question immediately
          if (!commandExecuted) {
            console.log('[STT] Auto-navigating to next question');
            navigate('next');
            return; // Exit early to prevent restart
          }
        }
        
        // Execute voice commands
        if (commandExecuted && command) {
          console.log('[STT] Executing voice command:', command);
          const result = processVoiceCommands(transcribedText, questionAtStart.id);
          
          if (command === 'next') {
            navigate('next');
          } else if (command === 'prev') {
            navigate('prev');
          } else if (command === 'skip') {
            navigate('skip');
          } else if (command === 'jump') {
            const targetNumber = (result as any).targetQuestionNumber;
            if (targetNumber && targetNumber >= 1 && targetNumber <= questions.length) {
              handleJumpToQuestion(targetNumber);
            } else {
              toast({ title: "Invalid Jump", description: `Question ${targetNumber} doesn't exist. Valid range: 1-${questions.length}`, variant: "destructive" });
            }
          } else if (command === 'summary') {
            handleShowSummary();
            // After summary, continue listening
            setTimeout(() => {
              if (isQnAActive && !speechSynthesis?.speaking && !readingQuestionRef.current) {
                actuallyStartTranscription();
              }
            }, 3000); // Wait 3 seconds for summary speech to finish
          } else if (command === 'repeat') {
            handleReadAloud();
          } else if (command === 'pause') {
            handlePause();
          } else if (command === 'resume') {
            handleResume();
          }
          
          // Exit early for navigation commands, but not for summary/pause/resume
          if (['next', 'prev', 'skip', 'jump', 'repeat', 'pause'].includes(command)) {
            return;
          }
        }
      }
      
      // Only restart if we didn't navigate away
      console.log('[STT] No text or no navigation, restarting listening');
      setTimeout(() => {
        if (isQnAActive && !speechSynthesis?.speaking && !readingQuestionRef.current) {
          actuallyStartTranscription();
        }
      }, 1000);
      
    } catch (error) {
      console.error('[STT] Error:', error);
      toast({ title: "STT Error", description: "Speech recognition failed", variant: "destructive" });
    } finally {
      setIsTranscribing(false);
      if (appStateRef.current === 'stt') {
        setAppState('transitioning');
      }
    }
  }, [isSpeechReady, isTranscribing, currentQuestion, isQnAActive, setAppState, toast, processVoiceCommands, setQuestionStates, navigate]);

  const readQuestionAndPotentiallyListen = useCallback((questionText: string) => {
    console.log('[TTS] Simple read and listen flow');
    
    if (readingQuestionRef.current) {
      console.log('[TTS] Already reading, ignoring');
      return;
    }
    
    // Stop any existing STT
    if (isTranscribing && speechRecognitionRef.current) {
      speechRecognitionRef.current.stopListening();
      setIsTranscribing(false);
    }
    
    readingQuestionRef.current = true;
    setAppState('tts');
    
    if (!speechSynthesis || !questionText) {
      readingQuestionRef.current = false;
      setAppState('inactive');
      return;
    }
    
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(questionText);
    
    utterance.onend = () => {
      console.log('[TTS] Finished. Starting STT after delay');
      readingQuestionRef.current = false;
      
      if (isQnAActive && isSpeechReady) {
        setTimeout(() => {
          if (isQnAActive && !readingQuestionRef.current && !isTranscribing) {
            actuallyStartTranscription();
          }
        }, 1000); // Reduced to 1 second
      } else {
        setAppState('inactive');
      }
    };
    
    utterance.onerror = () => {
      readingQuestionRef.current = false;
      setAppState('inactive');
    };
    
    speechSynthesis.speak(utterance);
  }, [isQnAActive, isSpeechReady, isTranscribing, setAppState]);

  // Cleanup effect for component unmount
  useEffect(() => {
    return () => {
      console.log('[CLEANUP] Component unmounting, cleaning up');
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
      }
      readingQuestionRef.current = false;
    };
  }, []);
  
  // Add effect to handle Q&A state changes
  useEffect(() => {
    if (!isQnAActive && appStateRef.current !== 'inactive') {
      console.log('[Q&A STATE] Q&A deactivated, cleaning up state');
      setAppState('inactive');
    }
  }, [isQnAActive, setAppState]);

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
    console.log('[READ-aloud] Read aloud requested, current state:', getCurrentState());
    
    if (!currentQuestion || !isQnAActive) {
      toast({ title: "Info", description: "No question to read or Q&A not active." });
      return;
    }
    
    // Stop any current operations
    if (speechSynthesis?.speaking) {
      speechSynthesis.cancel();
    }
    if (isTranscribing && speechRecognitionRef.current) {
      speechRecognitionRef.current.stopListening();
      setIsTranscribing(false);
    }
    readingQuestionRef.current = false;
    
    // Start reading current question
    setAppState('transitioning');
    setTimeout(() => {
      if (currentQuestion) {
        readQuestionAndPotentiallyListen(currentQuestion.text);
      }
    }, 100);
  };

  const handlePause = useCallback(() => {
    console.log('[PAUSE] Pause requested from state:', getCurrentState());
    
    if (isPaused || appStateRef.current === 'paused') {
      console.log('[PAUSE] Already paused, ignoring');
      return;
    }

    const currentState = getCurrentState();
    
    if (currentState === 'tts' && speechSynthesis && speechSynthesis.speaking) {
      // Pause TTS
      console.log('[PAUSE] Pausing TTS');
      speechSynthesis.cancel();
      setPausedContent({
        type: 'tts',
        content: currentQuestion?.text || '',
        questionId: currentQuestion?.id || ''
      });
      setIsPaused(true);
      setAppState('paused');
      readingQuestionRef.current = false;
      toast({ title: "Paused", description: "Speech paused" });
    } else if (currentState === 'stt' && isTranscribing) {
      // Pause STT - stop listening
      console.log('[PAUSE] Pausing STT');
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
        setIsTranscribing(false);
      }
      setPausedContent({
        type: 'stt',
        content: '',
        questionId: currentQuestion?.id || ''
      });
      setIsPaused(true);
      setAppState('paused');
      toast({ title: "Paused", description: "Recording paused" });
    } else {
      console.log('[PAUSE] No active operation to pause in state:', currentState);
      toast({ title: "Nothing to pause", description: "No active speech or recording" });
    }
  }, [isPaused, getCurrentState, currentQuestion, isTranscribing, setAppState, toast]);

  const handleResume = useCallback(() => {
    console.log('[RESUME] Resume requested from state:', getCurrentState());
    
    if (!isPaused || !pausedContent) {
      console.log('[RESUME] Not paused or no paused content');
      toast({ title: "Nothing to resume", description: "No paused operation found" });
      return;
    }

    const contentToResume = pausedContent;
    setPausedContent(null);
    setIsPaused(false);

    if (contentToResume.type === 'tts') {
      console.log('[RESUME] Resuming TTS');
      setAppState('transitioning');
      setTimeout(() => {
        readQuestionAndPotentiallyListen(contentToResume.content);
      }, 100);
    } else if (contentToResume.type === 'stt') {
      console.log('[RESUME] Resuming STT');
      
      if (isSpeechReady && speechRecognitionRef.current) {
        setAppState('transitioning');
        setTimeout(() => {
          actuallyStartTranscription();
        }, 100);
      } else {
        console.log('[RESUME] Cannot resume STT - not ready');
        toast({ title: "Resume Error", description: "Speech recognition not available", variant: "destructive" });
        // Reset pause state if we can't resume
        setIsPaused(true);
        setPausedContent(contentToResume);
        return;
      }
    }

    toast({ title: "Resumed", description: "Continuing..." });
  }, [isPaused, pausedContent, readQuestionAndPotentiallyListen, isSpeechReady, setAppState, actuallyStartTranscription, toast]);

  const handleToggleTranscription = () => {
    console.log('[TOGGLE STT] Toggle requested, current state:', getCurrentState());
    
    if (!isSpeechReady) {
      toast({ title: "STT Error", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }
    if (!isQnAActive) {
      toast({ title: "Info", description: "Q&A not active.", variant: "default" });
      return;
    }

    const currentState = getCurrentState();
    
    if (currentState === 'stt' || isTranscribing) {
      console.log('[TOGGLE STT] Stopping transcription');
      stopTranscription();
      setAppState('transitioning');
    } else {
      console.log('[TOGGLE STT] Starting transcription manually');
      // Stop any current operations
      if (speechSynthesis?.speaking) {
        speechSynthesis.cancel();
      }
      readingQuestionRef.current = false;
      if (isSpeechReady && speechRecognitionRef.current) {
        setAppState('stt');
        actuallyStartTranscription();
        toast({ title: "Manual STT", description: "Starting speech recognition manually" });
      }
    }
  };

  const refreshSavedSessions = useCallback(() => {
    const allSessions = SessionStorage.getAllSessions();
    setSavedSessions(allSessions);
  }, []);

  const handleStartQnA = () => {
    if (questions.length > 0) {
      // Stop any existing operations
      if (speechSynthesis?.speaking) {
        speechSynthesis.cancel();
      }
      if (isTranscribing && speechRecognitionRef.current) {
        speechRecognitionRef.current.stopListening();
        setIsTranscribing(false);
      }
      readingQuestionRef.current = false;
      
      // Find first unanswered question
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
      setAppState('transitioning'); // Will be set to 'tts' when reading starts
      
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
      setAppState('transitioning');
      setTimeout(() => {
        if (isQnAActive && currentQuestion) {
          readQuestionAndPotentiallyListen(currentQuestion.text);
        }
      }, 100);
      setJustStartedQnA(false); 
    }
  }, [justStartedQnA, isQnAActive, currentQuestion, questions.length, setAppState, readQuestionAndPotentiallyListen]);

  // Read question when index changes (for navigation) - simplified
  useEffect(() => {
    if (isQnAActive && currentQuestion && !justStartedQnA) {
      console.log('Navigation triggered - reading question', currentQuestionIndex + 1);
      
      // Simple direct call without complex cleanup
      const startReading = async () => {
        // Reset state and start fresh
        setAppState('transitioning');
        
        // Small delay to ensure state is clean
        setTimeout(() => {
          if (isQnAActive && currentQuestion) {
            readQuestionAndPotentiallyListen(currentQuestion.text);
          }
        }, 200);
      };
      
      startReading();
    }
  }, [currentQuestionIndex, isQnAActive, currentQuestion, justStartedQnA]);
  
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
                            <p><strong>4. Voice Commands:</strong> Simply say "next", "previous", "skip", "jump to #", "repeat", "summary", "pause", "resume", or "clear answer" during recording</p>
                            <p><strong>5. Navigation:</strong> Use voice commands or the control buttons to navigate questions</p>
                            <p className="text-xs mt-3 italic">Note: Commands work best when spoken alone. Legacy prefixed commands like "daytrace next" still work for compatibility.</p>
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