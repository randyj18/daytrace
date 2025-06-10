
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ArrowLeftRight, EraserIcon, Info, ListChecks, RadioTower } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface VoiceCommandPaletteProps {
  onRepeat: () => void;
  onClearAnswer: () => void;
  onJumpToQuestion: (questionNumber: number) => void;
  onSummary: () => void;
  isPaletteDisabled: boolean;
  maxQuestions: number;
}

export function VoiceCommandPalette({ onRepeat, onClearAnswer, onJumpToQuestion, onSummary, isPaletteDisabled, maxQuestions }: VoiceCommandPaletteProps) {
  const [selectedQuestion, setSelectedQuestion] = useState<string>("");

  const handleJumpSubmit = () => {
    if (selectedQuestion) {
      onJumpToQuestion(parseInt(selectedQuestion));
      setSelectedQuestion(""); // Clear selection after jump
    }
  };

  // Generate question options
  const questionOptions = Array.from({ length: maxQuestions }, (_, i) => i + 1);
  
  return (
    <Card className="shadow-md animate-fade-in">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-primary" />
          Controls
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Use these buttons or voice commands during recording. Voice commands: "next", "previous", "skip", "repeat", "summary", "clear answer".
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Button variant="ghost" onClick={onRepeat} disabled={isPaletteDisabled} className="justify-start">
            <RefreshCw className="mr-2 h-4 w-4" /> Repeat Question
          </Button>
          <Button variant="ghost" onClick={onClearAnswer} disabled={isPaletteDisabled} className="justify-start">
            <EraserIcon className="mr-2 h-4 w-4" /> Clear Answer
          </Button>
          <Button variant="ghost" onClick={onSummary} disabled={isPaletteDisabled} className="justify-start">
            <ListChecks className="mr-2 h-4 w-4" /> Summary
          </Button>
        </div>
        <div className="flex justify-center">
          <div className="flex items-end gap-2 max-w-sm">
            <div className="flex-grow">
              <Label htmlFor="jumpSelect" className="text-sm">Jump to Question</Label>
              <Select 
                value={selectedQuestion} 
                onValueChange={setSelectedQuestion}
                disabled={isPaletteDisabled || maxQuestions === 0}
              >
                <SelectTrigger id="jumpSelect" className="w-full mt-1">
                  <SelectValue placeholder="Select question..." />
                </SelectTrigger>
                <SelectContent>
                  {questionOptions.map((questionNum) => (
                    <SelectItem key={questionNum} value={questionNum.toString()}>
                      Question {questionNum}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleJumpSubmit} 
              variant="outline" 
              size="sm" 
              disabled={isPaletteDisabled || maxQuestions === 0 || !selectedQuestion}
            >
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Jump
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
