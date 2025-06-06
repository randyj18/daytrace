
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { Question, QuestionInteractionState, AllQuestionStates } from '@/types';
import { AppHeader } from '@/components/Header';
import { FileControls } from '@/components/FileControls';
import { QuestionDisplay } from '@/components/QuestionDisplay';
import { AnswerArea } from '@/components/AnswerArea';
import { NavigationControls } from '@/components/NavigationControls';
import { AudioControls } from '@/components/AudioControls';
import { VoiceCommandPalette } from '@/components/VoiceCommandPalette'; // This will become mostly non-functional for voice commands
import { ProgressIndicator } from '@/components/ProgressIndicator';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';

// const SpeechRecognition = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition; // Removed, will use whisper.cpp
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
  
  const [isTranscribing, setIsTranscribing] = useState(false); // Will represent whisper.cpp transcribing state
  // const recognitionRef = useRef<SpeechRecognition | null>(null); // Removed
  const whisperModuleRef = useRef<any>(null); // For whisper.cpp Wasm module
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioProcessorNodeRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);


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

  // Placeholder for loading whisper.cpp Wasm module and model
  useEffect(() => {
    const loadWhisper = async () => {
      // TODO: Implement whisper.cpp Wasm loading
      // Example:
      // try {
      //   const module = await import('path/to/your/whisper.wasm');
      //   const model = await fetch('/models/ggml-base.en.bin').then(res => res.arrayBuffer());
      //   // Initialize whisper.cpp instance
      //   // whisperModuleRef.current = new module.WhisperInstance(model); // This is hypothetical
      //   toast({ title: "STT Ready", description: "Speech-to-text module loaded."});
      // } catch (error) {
      //   console.error("Failed to load whisper.cpp module:", error);
      //   toast({ title: "STT Error", description: "Could not load speech-to-text module.", variant: "destructive"});
      // }
      console.log("Placeholder: Load whisper.cpp Wasm module here.");
    };
    loadWhisper();
  }, [toast]);


  const stopTranscription = useCallback(() => {
    // TODO: Implement whisper.cpp transcription stop
    if (isTranscribing) {
      setIsTranscribing(false);
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (audioProcessorNodeRef.current) {
        audioProcessorNodeRef.current.disconnect();
        audioProcessorNodeRef.current = null;
      }
      console.log("Placeholder: Whisper.cpp transcription stopped.");
    }
  }, [isTranscribing]);

  const actuallyStartTranscription = useCallback(async () => {
    // TODO: Implement whisper.cpp transcription start
    // This will involve:
    // 1. Getting microphone access (navigator.mediaDevices.getUserMedia)
    // 2. Setting up AudioContext and ScriptProcessorNode/AudioWorkletNode for audio processing
    // 3. Converting audio chunks to the format whisper.cpp expects (e.g., PCM 16kHz mono)
    // 4. Passing audio data to the whisper.cpp Wasm module
    // 5. Receiving transcribed text and updating the answer
    if (!whisperModuleRef.current) {
      toast({ title: "STT Not Ready", description: "Speech-to-text module not loaded.", variant: "destructive" });
      return;
    }
    if (isTranscribing) return;

    try {
      setIsTranscribing(true);
      toast({ title: "Listening...", description: "Speech-to-text active." });
      console.log("Placeholder: Whisper.cpp transcription started. Implement audio capture and processing.");

      // Example conceptual audio capture setup:
      // audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // audioStreamRef.current = stream;
      // const source = audioContextRef.current.createMediaStreamSource(stream);
      // const processor = audioContextRef.current.createScriptProcessor(4096, 1, 1); // Or AudioWorklet
      // audioProcessorNodeRef.current = processor;
      // source.connect(processor);
      // processor.connect(audioContextRef.current.destination);
      // processor.onaudioprocess = (e) => {
      //   const inputData = e.inputBuffer.getChannelData(0);
      //   // Process inputData and send to whisperModuleRef.current
      //   // const transcribedText = whisperModuleRef.current.process(inputData);
      //   // if (transcribedText) updateCurrentQuestionState({ answer: (currentQuestionState?.answer || '') + transcribedText });
      // };

    } catch (e) {
      console.error("Error starting whisper.cpp transcription:", e);
      toast({ title: "STT Error", description: "Could not start voice recognition.", variant: "destructive"});
      setIsTranscribing(false); 
    }
  }, [isTranscribing, toast, updateCurrentQuestionState, currentQuestionState]);

  const readQuestionAndPotentiallyListen = useCallback((questionText: string) => {
    if (!speechSynthesis || !questionText) {
      if (isQnAActive && whisperModuleRef.current) { // Check for whisper module
         actuallyStartTranscription();
      }
      return;
    }
    speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(questionText);
    utterance.onend = () => {
      if (isQnAActive && whisperModuleRef.current) {
        actuallyStartTranscription();
      }
    };
    utterance.onerror = (event) => {
      console.error("Speech synthesis error", event);
      toast({ title: "Error", description: "Failed to read question aloud.", variant: "destructive" });
      if (isQnAActive && whisperModuleRef.current) {
          actuallyStartTranscription();
      }
    };
    speechSynthesis.speak(utterance);
  }, [isQnAActive, toast, actuallyStartTranscription]);


  const navigate = useCallback((direction: 'next' | 'prev' | 'skip' | 'jump', targetIndex?: number) => {
    if (questions.length === 0 || !isQnAActive) return;

    speechSynthesis?.cancel();
    stopTranscription(); // Stop whisper.cpp transcription if active

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

  // Voice command handling via Web Speech API is removed.
  // Re-implementing with whisper.cpp would require parsing its output.
  // const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => { ... }); Removed

  useEffect(() => {
    // Effect for initializing and cleaning up whisper.cpp related resources if any
    // For example, if whisperModuleRef.current has a cleanup method
    return () => {
      stopTranscription();
      if (speechSynthesis) {
        speechSynthesis.cancel();
      }
      // if (whisperModuleRef.current && typeof whisperModuleRef.current.free === 'function') {
      //   whisperModuleRef.current.free(); // Hypothetical cleanup
      // }
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
    // If whisper.cpp is active and clearing answer, maybe stop it? Or let user restart.
    // For now, it just clears the text.
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
    // Voice command for jump is removed. This function is for the UI button.
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
    if (!whisperModuleRef.current) { // Check if whisper is loaded
      toast({ title: "STT Error", description: "Speech recognition module not available or Q&A not active.", variant: "destructive" });
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
    // Voice command for summary is removed. This function is for the UI button.
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
  // STT is disabled if whisper module isn't loaded OR QnA isn't active.
  const isSttDisabled = !whisperModuleRef.current || !isQnAActive || questions.length === 0;
  const audioControlsDisabled = !isQnAActive || questions.length === 0;
  const paletteDisabled = !isQnAActive || questions.length === 0; // Palette voice commands won't work

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
                        isAudioDisabled={audioControlsDisabled} // For read aloud button
                        isSttDisabled={isSttDisabled} // Specifically for STT button
                    />
                </CardContent>
            </Card>
          </>
        )}

        <VoiceCommandPalette
          onRepeat={handleReadAloud} // This button will still work
          onClearAnswer={handleClearAnswer} // This button will still work
          onJumpToQuestion={handleJumpToQuestion} // This button will still work
          onSummary={handleShowSummary} // This button will still work
          isPaletteDisabled={paletteDisabled} // Disables buttons if Q&A not active
          maxQuestions={questions.length}
          // Note: Actual voice commands like "Daytrace repeat" are no longer functional
          // as the underlying SpeechRecognition API has been removed.
          // This component now serves as a UI for these actions.
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
