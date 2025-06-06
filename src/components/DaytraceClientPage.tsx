
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
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
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
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isQnAActive, setIsQnAActive] = useState(false);
  const [justStartedQnA, setJustStartedQnA] = useState(false);

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
      setQuestionStates(prev => ({
        ...prev,
        [currentQuestion.id]: {
          ...(prev[currentQuestion.id] || { answer: '', status: 'pending' }),
          ...updates,
        },
      }));
    }
  }, [currentQuestion]);

  const actuallyStartTranscription = useCallback(() => {
    if (!recognitionRef.current || isTranscribing) return;
    try {
      recognitionRef.current.start();
      setIsTranscribing(true);
    } catch (e) {
      console.error("Error starting recognition:", e);
      toast({ title: "STT Error", description: "Could not start voice recognition.", variant: "destructive"});
      setIsTranscribing(false); 
    }
  }, [isTranscribing, toast]);

  const stopTranscription = useCallback(() => {
    if (recognitionRef.current && isTranscribing) {
      recognitionRef.current.stop();
    }
  }, [isTranscribing]);
  
  const readQuestionAndPotentiallyListen = useCallback((questionText: string) => {
    if (!speechSynthesis || !questionText) {
      if (isQnAActive && SpeechRecognition) {
         actuallyStartTranscription();
      }
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.onend = () => {
      if (isQnAActive && SpeechRecognition) {
        actuallyStartTranscription();
      }
    };
    utterance.onerror = (event) => {
      console.error("Speech synthesis error", event);
      toast({ title: "Error", description: "Failed to read question aloud.", variant: "destructive" });
      if (isQnAActive && SpeechRecognition) {
          actuallyStartTranscription();
      }
    };
    speechSynthesis.speak(utterance);
  }, [isQnAActive, toast, actuallyStartTranscription]);


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
       if (questions[newIndex]) {
          readQuestionAndPotentiallyListen(questions[newIndex].text);
       }
    } else if ((direction === 'next' || direction === 'skip') && currentQuestionIndex === questions.length - 1 && oldIndex === currentQuestionIndex) {
       toast({ title: "End of questions", description: "You've reached the last question."});
       if (questions[newIndex]) { 
          readQuestionAndPotentiallyListen(questions[newIndex].text);
       }
    } else if (direction === 'next' || direction === 'skip') { 
        if (questions[newIndex]) {
            readQuestionAndPotentiallyListen(questions[newIndex].text);
        }
    }
  }, [questions, currentQuestionIndex, questionStates, isQnAActive, readQuestionAndPotentiallyListen, stopTranscription, toast]);

  const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
    let finalTranscriptPart = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscriptPart += event.results[i][0].transcript;
      }
    }
    const processedFinalTranscript = finalTranscriptPart.trim().toLowerCase();

    if (processedFinalTranscript.startsWith("daytrace next")) {
      if (isQnAActive) {
          toast({ title: "Voice Command", description: "Navigating to next question." });
          if (recognitionRef.current && isTranscribing) {
              stopTranscription();
          }
          navigate('next');
      }
    } else if (finalTranscriptPart.trim()) {
      updateCurrentQuestionState({ answer: (currentQuestionState?.answer || '') + finalTranscriptPart });
    }
  }, [isQnAActive, isTranscribing, navigate, updateCurrentQuestionState, currentQuestionState, toast, stopTranscription]);


  useEffect(() => {
    if (SpeechRecognition && !recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognitionRef.current = recognition;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onresult = handleRecognitionResult;
      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        toast({ title: "Error", description: `Speech recognition error: ${event.error}`, variant: "destructive" });
        setIsTranscribing(false);
      };
      recognitionRef.current.onend = () => {
        setIsTranscribing(false);
      };
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
      speechSynthesis?.cancel();
    };
  }, [handleRecognitionResult, toast]);


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
          const questionsWithIds: Question[] = parsedInput.map((q, index) => ({
            text: q.question,
            id: q.id || `q-${Date.now()}-${index}`
          }));
          setQuestions(questionsWithIds);
          setCurrentQuestionIndex(0);
          initQuestionStates(questionsWithIds);
          setIsQnAActive(false); 
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
    const dataToExport = {
      questions: questions.map(q => ({
        id: q.id,
        question: q.text,
        answer: questionStates[q.id]?.answer || '',
        status: questionStates[q.id]?.status || 'pending',
      })),
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daytrace_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Success", description: "Data exported successfully." });
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
  const handleJumpToQuestion = (questionNumber: number) => navigate('jump', questionNumber - 1);

  const handleReadAloud = () => {
    if (!currentQuestion || !isQnAActive) {
      toast({ title: "Info", description: "No question to read or Q&A not active." });
      return;
    }
    stopTranscription(); 
    readQuestionAndPotentiallyListen(currentQuestion.text);
  };

  const handleToggleTranscription = () => {
    if (!SpeechRecognition || !isQnAActive) {
      toast({ title: "Error", description: "Speech recognition not supported or Q&A not active.", variant: "destructive" });
      return;
    }
    if (isTranscribing) {
      stopTranscription();
    } else {
      actuallyStartTranscription();
    }
  };

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
    }
  };

  useEffect(() => {
    if (justStartedQnA && isQnAActive && currentQuestion && currentQuestionIndex === 0 && questions.length > 0) {
      readQuestionAndPotentiallyListen(currentQuestion.text);
      setJustStartedQnA(false); 
    }
  }, [justStartedQnA, isQnAActive, currentQuestion, currentQuestionIndex, questions, readQuestionAndPotentiallyListen]);
  
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
    };
  }, []);

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
  const audioAndPaletteDisabled = !isQnAActive || questions.length === 0;

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
            <Card className="min-h-[150px] flex items-center justify-center">
                <CardContent className="p-6 text-center">
                    <p className="text-lg text-muted-foreground">
                        Import questions to start.
                    </p>
                </CardContent>
            </Card>
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
                        isAudioDisabled={audioAndPaletteDisabled}
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
          isPaletteDisabled={audioAndPaletteDisabled}
          maxQuestions={questions.length}
        />
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t">
        Daytrace &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

    

    