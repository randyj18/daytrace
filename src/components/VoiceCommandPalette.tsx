
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RefreshCw, ArrowLeftRight, EraserIcon, Info, ListChecks, RadioTower, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
  pauseDuration: number;
  onPauseDurationChange: (duration: number) => void;
}

const jumpSchema = z.object({
  questionNumber: z.coerce.number().min(1, "Must be at least 1")
});
type JumpFormValues = z.infer<typeof jumpSchema>;

const pauseSchema = z.object({
  pauseDuration: z.coerce.number().min(0, "Must be at least 0").max(60, "Must be at most 60")
});
type PauseFormValues = z.infer<typeof pauseSchema>;


export function VoiceCommandPalette({ onRepeat, onClearAnswer, onJumpToQuestion, onSummary, isPaletteDisabled, maxQuestions, pauseDuration, onPauseDurationChange }: VoiceCommandPaletteProps) {
  const { register, handleSubmit, formState: { errors }, setValue } = useForm<JumpFormValues>({
    resolver: zodResolver(jumpSchema.extend({
      questionNumber: z.coerce.number().min(1, "Must be at least 1").max(maxQuestions > 0 ? maxQuestions : 1 , `Must be at most ${maxQuestions || 1}`)
    }))
  });

  const { register: registerPause, handleSubmit: handleSubmitPause, formState: { errors: pauseErrors } } = useForm<PauseFormValues>({
    resolver: zodResolver(pauseSchema),
    defaultValues: { pauseDuration }
  });

  const handleJumpSubmit: SubmitHandler<JumpFormValues> = (data) => {
    onJumpToQuestion(data.questionNumber);
    setValue("questionNumber", "" as any); 
  };

  const handlePauseSubmit: SubmitHandler<PauseFormValues> = (data) => {
    onPauseDurationChange(data.pauseDuration);
    // localStorage.setItem('daytrace_pause_duration', data.pauseDuration.toString());
  };
  
  return (
    <Card className="shadow-md animate-fade-in">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center gap-2">
          <RadioTower className="h-5 w-5 text-primary" />
          Controls
        </CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Use these buttons or voice commands during recording. Voice commands: "daytrace next", "daytrace previous", "daytrace skip", "daytrace repeat", "daytrace summary", "daytrace clear answer", "daytrace set wait to X". Also works with "day trace" or "they trace".
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
        <div className="grid sm:grid-cols-2 gap-4">
          <form onSubmit={handleSubmit(handleJumpSubmit)} className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="jumpInput" className="text-sm">Jump to Question</Label>
              <Input
                id="jumpInput"
                type="number"
                {...register("questionNumber")}
                placeholder="No."
                min="1"
                max={maxQuestions > 0 ? maxQuestions : undefined}
                disabled={isPaletteDisabled || maxQuestions === 0}
                className="w-full mt-1"
              />
              {errors.questionNumber && <p className="text-xs text-destructive mt-1">{errors.questionNumber.message}</p>}
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={isPaletteDisabled || maxQuestions === 0}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> Jump
            </Button>
          </form>
          
          <form onSubmit={handleSubmitPause(handlePauseSubmit)} className="flex items-end gap-2">
            <div className="flex-grow">
              <Label htmlFor="pauseInput" className="text-sm">Wait Time (seconds)</Label>
              <Input
                id="pauseInput"
                type="number"
                {...registerPause("pauseDuration")}
                placeholder={pauseDuration.toString()}
                min="0"
                max="60"
                className="w-full mt-1"
              />
              {pauseErrors.pauseDuration && <p className="text-xs text-destructive mt-1">{pauseErrors.pauseDuration.message}</p>}
            </div>
            <Button type="submit" variant="outline" size="sm">
              <Clock className="mr-2 h-4 w-4" /> Set
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
