import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowLeftRight, EraserIcon, Info, ListChecks, RadioTower } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

interface VoiceCommandPaletteProps {
  onRepeat: () => void;
  onClearAnswer: () => void;
  onJumpToQuestion: (questionNumber: number) => void;
  onSummary: () => void;
  isPaletteDisabled: boolean;
  maxQuestions: number;
}

const jumpSchema = z.object({
  questionNumber: z.coerce.number().min(1, "Must be at least 1")
});
type JumpFormValues = z.infer<typeof jumpSchema>;


export function VoiceCommandPalette({ onRepeat, onClearAnswer, onJumpToQuestion, onSummary, isPaletteDisabled, maxQuestions }: VoiceCommandPaletteProps) {
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<JumpFormValues>({
    resolver: zodResolver(jumpSchema.extend({
      questionNumber: z.coerce.number().min(1, "Must be at least 1").max(maxQuestions, `Must be at most ${maxQuestions}`)
    }))
  });

  const handleJumpSubmit: SubmitHandler<JumpFormValues> = (data) => {
    onJumpToQuestion(data.questionNumber);
    setValue("questionNumber", "" as any); // Clear input after submit
  };
  
  return (
    <Card className="shadow-md animate-fade-in">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-primary" />
          Voice Command Palette (Simulated)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Use these buttons to simulate voice commands. (Wake word: "Daytrace")</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Button variant="ghost" onClick={onRepeat} disabled={isPaletteDisabled} className="justify-start">
            <RefreshCw className="mr-2 h-4 w-4" /> Repeat
          </Button>
          <Button variant="ghost" onClick={onClearAnswer} disabled={isPaletteDisabled} className="justify-start">
            <EraserIcon className="mr-2 h-4 w-4" /> Clear Answer
          </Button>
          <Button variant="ghost" onClick={onSummary} disabled={isPaletteDisabled} className="justify-start">
            <ListChecks className="mr-2 h-4 w-4" /> Summary
          </Button>
        </div>
        <form onSubmit={handleSubmit(handleJumpSubmit)} className="flex items-end gap-2">
          <div className="flex-grow">
            <Label htmlFor="jumpInput" className="text-sm">Jump to Question</Label>
            <Input
              id="jumpInput"
              type="number"
              {...register("questionNumber")}
              placeholder="No."
              min="1"
              max={maxQuestions}
              disabled={isPaletteDisabled || maxQuestions === 0}
              className="w-full mt-1"
            />
            {errors.questionNumber && <p className="text-xs text-destructive mt-1">{errors.questionNumber.message}</p>}
          </div>
          <Button type="submit" variant="outline" size="sm" disabled={isPaletteDisabled || maxQuestions === 0}>
            <ArrowLeftRight className="mr-2 h-4 w-4" /> Jump
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
