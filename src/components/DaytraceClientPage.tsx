
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Question, QuestionInteractionState, AllQuestionStates } from '@/types';
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

// Mock SpeechRecognition and SpeechSynthesisUtterance for SSR and environments where they don't exist
const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const speechSynthesis = globalThis.speechSynthesis;

interface ImportedQuestionFormat {
  id?: string;
  question: string;
  // Allow other properties to be present but not used directly
  [key: string]: any;
}

export default function DaytraceClientPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [questionStates, setQuestionStates] = useState<AllQuestionStates>({});
  
  const [isTranscribing, setIsTranscribing] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

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
            text: q.question, // Map 'question' to 'text'
            id: q.id || `q-${Date.now()}-${index}`
          }));
          setQuestions(questionsWithIds);
          setCurrentQuestionIndex(0);
          initQuestionStates(questionsWithIds);
          toast({ title: "Success", description: "Questions imported successfully." });
        } catch (error) {
          console.error("Failed to parse JSON:", error);
          toast({ title: "Error", description: `Failed to import JSON. ${error instanceof Error ? error.message : 'Unknown error.'}`, variant: "destructive" });
        }
      };
      reader.readAsText(file);
    }
    event.target.value = ''; // Reset file input
  };

  const handleExportJson = () => {
    if (questions.length === 0) {
      toast({ title: "Info", description: "No data to export." });
      return;
    }
    const dataToExport = {
      questions: questions.map(q => ({
        id: q.id,
        question: q.text, // Map internal 'text' back to 'question' for export
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

  const handleAnswerChange = (answer: string) => {
    updateCurrentQuestionState({ answer });
  };

  const handleClearAnswer = () => {
    updateCurrentQuestionState({ answer: '' });
  };

  const navigate = (direction: 'next' | 'prev' | 'skip' | 'jump', targetIndex?: number) => {
    if (questions.length === 0) return;

    let newIndex = currentQuestionIndex;
    if (direction === 'next' || direction === 'skip') {
      if (currentQuestion && currentQuestionState?.status === 'pending' && currentQuestionState.answer.trim() !== '') {
         updateCurrentQuestionState({ status: 'answered' });
      } else if (direction === 'skip' && currentQuestionState?.status === 'pending') {
         updateCurrentQuestionState({ status: 'skipped' });
      }
      newIndex = Math.min(questions.length - 1, currentQuestionIndex + 1);
    } else if (direction === 'prev') {
      newIndex = Math.max(0, currentQuestionIndex - 1);
    } else if (direction === 'jump' && targetIndex !== undefined) {
      newIndex = Math.max(0, Math.min(questions.length - 1, targetIndex));
    }
    
    if (newIndex !== currentQuestionIndex && currentQuestionIndex < questions.length) {
       setCurrentQuestionIndex(newIndex);
    } else if ((direction === 'next' || direction === 'skip') && currentQuestionIndex === questions.length - 1) {
       toast({ title: "End of questions", description: "You've reached the last question."});
    }
  };

  const handleNextQuestion = () => navigate('next');
  const handlePrevQuestion = () => navigate('prev');
  const handleSkipQuestion = () => navigate('skip');
  const handleJumpToQuestion = (questionNumber: number) => navigate('jump', questionNumber - 1);

  const handleReadAloud = () => {
    if (!currentQuestion || !speechSynthesis) {
      toast({ title: "Info", description: "No question to read or TTS not supported." });
      return;
    }
    speechSynthesis.cancel(); // Cancel any ongoing speech
    const utterance = new SpeechSynthesisUtterance(currentQuestion.text);
    // Potentially configure voice, rate, pitch here
    speechSynthesis.speak(utterance);
  };

  const handleToggleTranscription = () => {
    if (!SpeechRecognition) {
      toast({ title: "Error", description: "Speech recognition not supported in this browser.", variant: "destructive" });
      return;
    }

    if (isTranscribing) {
      recognitionRef.current?.stop();
      setIsTranscribing(false);
    } else {
      recognitionRef.current = new SpeechRecognition();
      const recognition = recognitionRef.current;
      recognition.continuous = true;
      recognition.interimResults = true;
      // recognition.lang = 'en-US'; // Optional: set language

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        // Update with final transcript, potentially append
        if (finalTranscript) {
          // Append to existing answer or replace, based on preference
          updateCurrentQuestionState({ answer: (currentQuestionState?.answer || '') + finalTranscript });
        } else if (interimTranscript) {
          // Optionally show interim results - for now, only updating on final
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        toast({ title: "Error", description: `Speech recognition error: ${event.error}`, variant: "destructive" });
        setIsTranscribing(false);
      };
      
      recognition.onend = () => {
        // If it ended unexpectedly and we still want to transcribe, restart it.
        // For now, just set state to false. User can re-enable.
        setIsTranscribing(false);
      };

      recognition.start();
      setIsTranscribing(true);
    }
  };
  
  // Clean up SpeechRecognition on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      speechSynthesis?.cancel();
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
    } else {
      summary += "No questions were skipped.";
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
  const isAudioDisabled = questions.length === 0;
  const isPaletteDisabled = questions.length === 0;

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
            </CardContent>
        </Card>

        <ProgressIndicator
          current={questions.length > 0 ? currentQuestionIndex + 1 : 0}
          total={questions.length}
          answered={answeredCount}
          skipped={skippedCount}
        />

        <QuestionDisplay
          question={currentQuestion}
          currentQuestionNumber={questions.length > 0 ? currentQuestionIndex + 1 : 0}
          totalQuestions={questions.length}
        />

        <AnswerArea
          answer={currentQuestionState?.answer || ''}
          onAnswerChange={handleAnswerChange}
          onClearAnswer={handleClearAnswer}
          isReadOnly={questions.length === 0}
        />
        
        {questions.length > 0 && (
          <Card>
            <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
                <NavigationControls
                    onPrevious={handlePrevQuestion}
                    onNext={handleNextQuestion}
                    onSkip={handleSkipQuestion}
                    canPrevious={currentQuestionIndex > 0}
                    canNext={currentQuestionIndex < questions.length} 
                    isCurrentQuestionAnswered={currentQuestionState?.status === 'answered' || currentQuestionState?.status === 'skipped'}
                />
                <AudioControls
                    onReadAloud={handleReadAloud}
                    onToggleTranscription={handleToggleTranscription}
                    isTranscribing={isTranscribing}
                    isAudioDisabled={isAudioDisabled}
                />
            </CardContent>
          </Card>
        )}

        <VoiceCommandPalette
          onRepeat={handleReadAloud}
          onClearAnswer={handleClearAnswer}
          onJumpToQuestion={handleJumpToQuestion}
          onSummary={handleShowSummary}
          isPaletteDisabled={isPaletteDisabled}
          maxQuestions={questions.length}
        />
      </main>
      <footer className="text-center py-4 text-sm text-muted-foreground border-t">
        Daytrace &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
