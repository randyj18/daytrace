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

  const { toast } = useToast();

  const currentQuestion = questions[currentQuestionIndex];
  const currentQuestionState = currentQuestion ? questionStates[currentQuestion.id] : undefined;

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
    if (questions.length === 0 || !isQnAActive) return;

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
  }, [toast, setQuestionStates]);

  const actuallyStartTranscription = useCallback(async () => {
    if (!isSpeechReady || !speechRecognitionRef.current) {
      toast({ title: "STT Not Ready", description: "Speech recognition not available.", variant: "destructive" });
      return;
    }
    if (isTranscribing) {
      console.log('Already transcribing, ignoring duplicate start request');
      return;
    }

    // Ensure speech synthesis is completely stopped before starting transcription
    if (speechSynthesis && speechSynthesis.speaking) {
      console.log('Speech synthesis still active, cancelling and waiting');
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
      toast({ title: "Listening...", description: "Speak now. Recognition will stop automatically when you finish." });
      
      const transcribedText = await speechRecognitionRef.current.startListening();
      
      if (transcribedText.trim() && questionAtStart) {
        console.log('Raw transcribed text:', transcribedText);
        console.log('Question at start:', questionAtStart.id);
        
        // Process voice commands first
        const result = processVoiceCommands(transcribedText, questionAtStart.id);
        const { cleanedText, commandExecuted, command } = result as any;
        console.log('Cleaned text after command processing:', cleanedText);
        
        if (cleanedText.trim()) {
          // Get current answer for the question we started with
          const currentAnswer = questionStates[questionAtStart.id]?.answer || '';
          const newAnswer = currentAnswer + (currentAnswer ? ' ' : '') + cleanedText;
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
          
          toast({ title: "Transcription", description: `Added: "${cleanedText}"` });
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
      }
    } catch (error) {
      console.error("Error during transcription:", error);
      toast({ title: "STT Error", description: "Speech recognition failed. Please try again.", variant: "destructive"});
    } finally {
      setIsTranscribing(false);
    }
  }, [isTranscribing, isSpeechReady, currentQuestion, currentQuestionIndex, questionStates, questions, navigate, toast]);

  const readQuestionAndPotentiallyListen = useCallback((questionText: string) => {
    console.log('readQuestionAndPotentiallyListen called with:', questionText);
    
    // Prevent multiple simultaneous calls
    if (readingQuestionRef.current) {
      console.log('Already reading a question, ignoring this call');
      return;
    }
    
    // Stop any existing transcription first but don't recurse
    if (isTranscribing) {
      console.log('Stopping existing transcription before reading question');
      stopTranscription();
      return; // Exit early, don't recurse
    }
    
    readingQuestionRef.current = true;
    
    if (!speechSynthesis || !questionText) {
      console.log('No speech synthesis or question text, starting transcription immediately');
      if (isQnAActive && isSpeechReady && !isTranscribing) {
         setTimeout(() => actuallyStartTranscription(), 500);
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
        console.log('Started reading question');
      };
      
      utterance.onend = () => {
        console.log('Finished reading question, starting transcription immediately');
        readingQuestionRef.current = false;
        if (isQnAActive && isSpeechReady && !isTranscribing) {
          // Play audible cue immediately, then start STT
          if (speechSynthesis) {
            const cue = new SpeechSynthesisUtterance('beep');
            cue.rate = 2;
            cue.pitch = 1.5;
            cue.volume = 0.3;
            cue.onend = () => {
              setTimeout(() => actuallyStartTranscription(), 200);
            };
            speechSynthesis.speak(cue);
          } else {
            actuallyStartTranscription();
          }
        }
      };
      
      utterance.onerror = (event) => {
        console.error("Speech synthesis error", event);
        readingQuestionRef.current = false;
        // Only show error toast for non-interrupted errors
        if (event.error !== 'interrupted' && event.error !== 'canceled') {
          toast({ title: "Error", description: "Failed to read question aloud.", variant: "destructive" });
        }
        // Still start transcription after errors (except for critical ones)
        if (event.error === 'interrupted' || event.error === 'canceled') {
          console.log('Speech was interrupted/canceled, starting transcription anyway');
          if (isQnAActive && isSpeechReady && !isTranscribing) {
            setTimeout(() => actuallyStartTranscription(), 500);
          }
        }
      };
      
      console.log('Starting to speak question');
      speechSynthesis.speak(utterance);
    }, 200);
  }, [isQnAActive, isSpeechReady, isTranscribing, actuallyStartTranscription, stopTranscription, toast, pauseDuration]);

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
          const parsedInput: ImportedQuestionFormat[] = JSON.parse(content);
          if (!Array.isArray(parsedInput) || !parsedInput.every(q => typeof q.question === 'string')) {
            throw new Error("Invalid JSON format. Expected an array of objects with a 'question' property.");
          }
          const questionsWithIds: Question[] = parsedInput.map((q, index) => {
            const { question, id, ...context } = q;
            return {
              text: question,
              id: id || `q-${Date.now()}-${index}`,
              context: Object.keys(context).length > 0 ? context : undefined
            };
          });
          setQuestions(questionsWithIds);
          setCurrentQuestionIndex(0);
          initQuestionStates(questionsWithIds);
          setIsQnAActive(false);
          
          // Create new session when importing questions
          const sessionId = SessionStorage.saveCurrentSession(
            questionsWithIds,
            {},
            0,
            false
          );
          setCurrentSessionId(sessionId);
          
          toast({ title: "Success", description: "Questions imported successfully." });
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
      actuallyStartTranscription();
    }
  };

  const refreshSavedSessions = useCallback(() => {
    const allSessions = SessionStorage.getAllSessions();
    setSavedSessions(allSessions);
  }, []);

  const handleStartQnA = () => {
    if (questions.length > 0) {
      const firstQuestion = questions[0];
      const firstQuestionId = firstQuestion.id;

      setQuestionStates(prev => ({
        ...prev,
        [firstQuestionId]: {
          ...(prev[firstQuestionId] || { answer: '' }),
          status: 'pending',
        },
      }));
      setCurrentQuestionIndex(0);
      setIsQnAActive(true);
      setJustStartedQnA(true);
      
      // Save Q&A start state
      if (questions.length > 0) {
        SessionStorage.saveCurrentSession(
          questions,
          questionStates,
          0,
          true,
          currentSessionId || undefined
        );
      }
    }
  };

  useEffect(() => {
    if (justStartedQnA && isQnAActive && currentQuestion && currentQuestionIndex === 0 && questions.length > 0) {
      console.log('Starting Q&A - reading first question');
      readQuestionAndPotentiallyListen(currentQuestion.text);
      setJustStartedQnA(false); 
    }
  }, [justStartedQnA]);

  // Read question when index changes (for navigation) - but not on initial load
  useEffect(() => {
    if (isQnAActive && currentQuestion && !justStartedQnA) {
      console.log('Navigation triggered - reading question', currentQuestionIndex + 1);
      // Add a small delay to ensure any ongoing speech is properly stopped
      setTimeout(() => {
        readQuestionAndPotentiallyListen(currentQuestion.text);
      }, 200);
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
                        isTranscribing={isTranscribing}
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
          pauseDuration={pauseDuration}
          onPauseDurationChange={setPauseDuration}
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